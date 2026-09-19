// Parceiros: cadastro de nomes (excluir só marca como removido).
// Os métodos entram em ProceduresPostgresRepository (this.db, this.runInTransaction…).

import "server-only";

import { PROCEDURE_STATUS_PENDING } from "../../../domain/shared/constants.js";
import { parseBoolean, parseNumber, parseText } from "../../../domain/shared/normalizers.js";
import { normalizePartnerName } from "../../../domain/shared/partner-name.js";

import { normalizeUserId } from "./helpers.js";

function toPartner(row) {
  return {
    id: Number(row.id),
    name: row.nome,
    bookmakersCount: Number(row.bookmakers_count ?? 0),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

const MAX_BALANCE = 9_999_999;

function normalizeBalance(value) {
  return Math.min(Math.max(parseNumber(value), 0), MAX_BALANCE);
}

function normalizePartnerId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : 0;
}

export const partnerMethods = {
  async listPartners(userId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);

    if (!normalizedUserId) {
      return [];
    }

    const { rows } = await executor.query(
      `
        SELECT
          p.id,
          p.nome,
          p.created_at,
          (SELECT COUNT(*) FROM parceiros_bancas pb WHERE pb.parceiro_id = p.id) AS bookmakers_count
        FROM parceiros p
        WHERE p.user_id = $1
          AND p.removido_em IS NULL
        ORDER BY lower(p.nome) ASC
        LIMIT 200
      `,
      [normalizedUserId],
    );

    return rows.map(toPartner);
  },

  // { partner } quando cria; { error: "duplicate" | "invalid" } quando não.
  async createPartner(userId, name, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedName = normalizePartnerName(name);

    if (!normalizedUserId || !normalizedName) {
      return { error: "invalid" };
    }

    // Nome repetido não gera erro (não invalida uma transação em andamento).
    const { rows } = await executor.query(
      `
        INSERT INTO parceiros (user_id, nome)
        VALUES ($1, $2)
        ON CONFLICT (user_id, lower(nome)) WHERE removido_em IS NULL DO NOTHING
        RETURNING id, nome, created_at
      `,
      [normalizedUserId, normalizedName],
    );

    return rows[0] ? { partner: toPartner(rows[0]) } : { error: "duplicate" };
  },

  async renamePartner(userId, partnerId, name, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedId = normalizePartnerId(partnerId);
    const normalizedName = normalizePartnerName(name);

    if (!normalizedUserId || !normalizedId || !normalizedName) {
      return { error: "invalid" };
    }

    const { rows } = await executor.query(
      `
        WITH duplicate AS (
          SELECT 1
          FROM parceiros
          WHERE user_id = $1
            AND lower(nome) = lower($3)
            AND id <> $2
            AND removido_em IS NULL
        ),
        updated AS (
          UPDATE parceiros
          SET nome = $3
          WHERE id = $2
            AND user_id = $1
            AND removido_em IS NULL
            AND NOT EXISTS (SELECT 1 FROM duplicate)
          RETURNING id
        )
        SELECT
          EXISTS (SELECT 1 FROM duplicate) AS duplicate,
          EXISTS (SELECT 1 FROM updated) AS updated
      `,
      [normalizedUserId, normalizedId, normalizedName],
    );

    if (rows[0]?.duplicate) {
      return { error: "duplicate" };
    }

    return rows[0]?.updated ? { ok: true } : { error: "not_found" };
  },

  async removePartner(userId, partnerId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedId = normalizePartnerId(partnerId);

    if (!normalizedUserId || !normalizedId) {
      return false;
    }

    const { rowCount } = await executor.query(
      `
        UPDATE parceiros
        SET removido_em = NOW()
        WHERE id = $2
          AND user_id = $1
          AND removido_em IS NULL
      `,
      [normalizedUserId, normalizedId],
    );

    return rowCount > 0;
  },

  // Casas atreladas a parceiros ativos, com saldo próprio.
  async listPartnerBookmakers(userId, workspaceId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (!normalizedUserId || normalizedWorkspaceId <= 0) {
      return [];
    }

    await this.reconcileProcedureBookmakerApplications(
      normalizedUserId,
      normalizedWorkspaceId,
      executor,
    );

    // Saldo exibido: o maior entre o informado e o que os procedimentos pendentes exigem.
    const { rows } = await executor.query(
      `
        WITH result_summary AS (
          SELECT
            procedimento_id,
            escopo,
            BOOL_OR(resultado_chave = 'defeat') AS defeat_selected,
            COUNT(*) FILTER (WHERE resultado_chave <> 'defeat') AS selected_count
          FROM procedimentos_resultados
          WHERE user_id = $1
            AND base_id = $2
          GROUP BY procedimento_id, escopo
        ),
        pending AS (
          SELECT
            e.parceiro_id,
            ca.id AS bookmaker_id,
            SUM(
              CASE
                WHEN COALESCE(rs.defeat_selected, false)
                  OR COALESCE(rs.selected_count, 0) > 0
                  OR COALESCE(e.freebet_somente_lucro, false)
                THEN 0
                ELSE e.valor
              END
            ) AS pending_required
          FROM procedimentos_entradas e
          INNER JOIN casas_de_apostas ca
            ON lower(ca.nome) = lower(btrim(e.casa))
          LEFT JOIN result_summary rs
            ON rs.procedimento_id = e.procedimento_id
           AND rs.escopo = e.escopo
          WHERE e.user_id = $1
            AND e.base_id = $2
            AND e.parceiro_id IS NOT NULL
            AND btrim(e.casa) <> ''
          GROUP BY e.parceiro_id, ca.id
        ),
        banks AS (
          SELECT parceiro_id, bookmaker_id FROM parceiros_bancas WHERE user_id = $1 AND base_id = $2
          UNION
          SELECT parceiro_id, bookmaker_id FROM pending WHERE pending_required >= 0.005
        )
        SELECT
          ca.nome,
          GREATEST(COALESCE(pb.saldo, 0), COALESCE(pe.pending_required, 0), 0) AS saldo,
          p.id AS parceiro_id,
          p.nome AS parceiro_nome
        FROM banks b
        INNER JOIN parceiros p
          ON p.id = b.parceiro_id
         AND p.user_id = $1
         AND p.removido_em IS NULL
        INNER JOIN casas_de_apostas ca
          ON ca.id = b.bookmaker_id
        LEFT JOIN parceiros_bancas pb
          ON pb.user_id = $1
         AND pb.base_id = $2
         AND pb.parceiro_id = b.parceiro_id
         AND pb.bookmaker_id = b.bookmaker_id
        LEFT JOIN pending pe
          ON pe.parceiro_id = b.parceiro_id
         AND pe.bookmaker_id = b.bookmaker_id
        ORDER BY lower(ca.nome) ASC, lower(p.nome) ASC
      `,
      [normalizedUserId, normalizedWorkspaceId],
    );

    return rows.map((row) => ({
      nome: row.nome,
      saldo: parseNumber(row.saldo),
      partnerId: Number(row.parceiro_id),
      partnerName: row.parceiro_nome,
    }));
  },

  // Adiciona a casa ao parceiro ou define o saldo dela. Só aceita parceiro ativo do próprio usuário.
  async savePartnerBookmaker(userId, workspaceId, partnerId, name, balance, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);
    const normalizedPartnerId = normalizePartnerId(partnerId);
    const normalizedName = parseText(name).trim();

    if (!normalizedUserId || normalizedWorkspaceId <= 0 || !normalizedPartnerId || !normalizedName) {
      return false;
    }

    await this.reconcileProcedureBookmakerApplications(
      normalizedUserId,
      normalizedWorkspaceId,
      executor,
    );

    const normalizedBalance = normalizeBalance(balance);
    const { rows: savedRows } = await executor.query(
      `
        INSERT INTO parceiros_bancas (user_id, base_id, parceiro_id, bookmaker_id, saldo)
        SELECT $1, $2, p.id, ca.id, $5
        FROM parceiros p
        INNER JOIN casas_de_apostas ca
          ON lower(ca.nome) = lower($4)
        WHERE p.id = $3
          AND p.user_id = $1
          AND p.removido_em IS NULL
        ON CONFLICT (base_id, parceiro_id, bookmaker_id)
        DO UPDATE SET saldo = EXCLUDED.saldo
        WHERE parceiros_bancas.user_id = EXCLUDED.user_id
        RETURNING bookmaker_id
      `,
      [normalizedUserId, normalizedWorkspaceId, normalizedPartnerId, normalizedName, normalizedBalance],
    );

    if (!savedRows[0]) {
      return false;
    }

    await executor.query(
      `
        INSERT INTO procedimentos_parceiros_aplicacoes (
          procedimento_id, user_id, base_id, parceiro_id, bookmaker_id,
          saldo_delta, saldo_anterior, saldo_resultante
        )
        SELECT DISTINCT e.procedimento_id, e.user_id, e.base_id, e.parceiro_id, ca.id, 0, $5::double precision, $5::double precision
        FROM procedimentos_entradas e
        INNER JOIN casas_de_apostas ca
          ON lower(ca.nome) = lower(btrim(e.casa))
        WHERE e.user_id = $1
          AND e.base_id = $2
          AND e.parceiro_id = $3
          AND ca.id = $4
          AND EXISTS (
            SELECT 1
            FROM procedimentos_resultados r
            WHERE r.procedimento_id = e.procedimento_id
              AND r.user_id = e.user_id
              AND r.base_id = e.base_id
              AND r.escopo = e.escopo
          )
        ON CONFLICT (procedimento_id, parceiro_id, bookmaker_id)
        DO UPDATE SET
          saldo_delta = 0,
          saldo_anterior = EXCLUDED.saldo_anterior,
          saldo_resultante = EXCLUDED.saldo_resultante,
          atualizado_em = now()
        WHERE procedimentos_parceiros_aplicacoes.user_id = EXCLUDED.user_id
      `,
      [
        normalizedUserId,
        normalizedWorkspaceId,
        normalizedPartnerId,
        parseNumber(savedRows[0].bookmaker_id),
        normalizedBalance,
      ],
    );

    return true;
  },

  async deletePartnerBookmaker(userId, workspaceId, partnerId, name, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);
    const normalizedPartnerId = normalizePartnerId(partnerId);
    const normalizedName = parseText(name).trim();

    if (!normalizedUserId || normalizedWorkspaceId <= 0 || !normalizedPartnerId || !normalizedName) {
      return { deleted: false, blockedByPending: false };
    }

    const { rows: pendingRows } = await executor.query(
      `
        SELECT EXISTS (
          SELECT 1
          FROM procedimentos_entradas e
          INNER JOIN procedimentos_historico p
            ON p.id = e.procedimento_id
           AND p.user_id = e.user_id
           AND p.base_id = e.base_id
          WHERE e.user_id = $1
            AND e.base_id = $2
            AND e.parceiro_id = $3
            AND lower(btrim(e.casa)) = lower($4)
            AND (
              p.status_procedimento = $5
              OR NOT EXISTS (
                SELECT 1
                FROM procedimentos_resultados r
                WHERE r.procedimento_id = e.procedimento_id
                  AND r.user_id = e.user_id
                  AND r.base_id = e.base_id
                  AND r.escopo = e.escopo
              )
            )
          LIMIT 1
        ) AS has_pending
      `,
      [normalizedUserId, normalizedWorkspaceId, normalizedPartnerId, normalizedName, PROCEDURE_STATUS_PENDING],
    );

    if (parseBoolean(pendingRows[0]?.has_pending)) {
      return { deleted: false, blockedByPending: true };
    }

    const { rowCount } = await executor.query(
      `
        DELETE FROM parceiros_bancas pb
        USING casas_de_apostas ca
        WHERE pb.bookmaker_id = ca.id
          AND pb.user_id = $1
          AND pb.base_id = $2
          AND pb.parceiro_id = $3
          AND lower(ca.nome) = lower($4)
      `,
      [normalizedUserId, normalizedWorkspaceId, normalizedPartnerId, normalizedName],
    );

    return { deleted: rowCount > 0, blockedByPending: false };
  },

  // Ids de parceiros do usuário (inclusive removidos, para editar procedimentos antigos).
  async listPartnerIds(userId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);

    if (!normalizedUserId) {
      return [];
    }

    const { rows } = await executor.query(
      "SELECT id FROM parceiros WHERE user_id = $1",
      [normalizedUserId],
    );

    return rows.map((row) => Number(row.id));
  },

  // Acerto de um procedimento na casa do parceiro (mesma regra das casas do usuário).
  async applyPartnerSettlement(procedureId, settlement, bookmakerId, userId, workspaceId, executor = this.db) {
    const partnerId = normalizePartnerId(settlement?.partnerId);

    if (!partnerId) {
      return;
    }

    const existing = await executor.query(
      `
        SELECT 1
        FROM procedimentos_parceiros_aplicacoes
        WHERE procedimento_id = $1
          AND user_id = $2
          AND base_id = $3
          AND parceiro_id = $4
          AND bookmaker_id = $5
        FOR UPDATE
      `,
      [procedureId, userId, workspaceId, partnerId, bookmakerId],
    );

    if (existing.rows.length > 0) {
      return;
    }

    const balanceResult = await executor.query(
      `
        SELECT saldo
        FROM parceiros_bancas
        WHERE user_id = $1
          AND base_id = $2
          AND parceiro_id = $3
          AND bookmaker_id = $4
        FOR UPDATE
      `,
      [userId, workspaceId, partnerId, bookmakerId],
    );
    const previousBalance = parseNumber(balanceResult.rows[0]?.saldo);
    const nextBalance = Math.max(
      Math.max(previousBalance, settlement.stake) - settlement.stake + settlement.payout,
      0,
    );
    const delta = nextBalance - previousBalance;

    if (Math.abs(delta) >= 0.005) {
      await executor.query(
        `
          INSERT INTO parceiros_bancas (user_id, base_id, parceiro_id, bookmaker_id, saldo)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (base_id, parceiro_id, bookmaker_id)
          DO UPDATE SET saldo = EXCLUDED.saldo
          WHERE parceiros_bancas.user_id = EXCLUDED.user_id
        `,
        [userId, workspaceId, partnerId, bookmakerId, nextBalance],
      );
    }

    await executor.query(
      `
        INSERT INTO procedimentos_parceiros_aplicacoes (
          procedimento_id, user_id, base_id, parceiro_id, bookmaker_id,
          saldo_delta, saldo_anterior, saldo_resultante
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (procedimento_id, parceiro_id, bookmaker_id)
        DO UPDATE SET
          saldo_delta = EXCLUDED.saldo_delta,
          saldo_anterior = EXCLUDED.saldo_anterior,
          saldo_resultante = EXCLUDED.saldo_resultante,
          atualizado_em = now()
      `,
      [procedureId, userId, workspaceId, partnerId, bookmakerId, delta, previousBalance, nextBalance],
    );
  },

  // Desfaz o que o procedimento aplicou nas casas de parceiros (ao editar ou excluir).
  async reversePartnerApplications(procedureId, userId, workspaceId, executor = this.db) {
    const { rows } = await executor.query(
      `
        SELECT parceiro_id, bookmaker_id, SUM(saldo_delta) AS saldo_delta
        FROM procedimentos_parceiros_aplicacoes
        WHERE procedimento_id = $1
          AND user_id = $2
          AND base_id = $3
        GROUP BY parceiro_id, bookmaker_id
      `,
      [procedureId, userId, workspaceId],
    );

    if (rows.length > 0) {
      await executor.query(
        `
          UPDATE parceiros_bancas AS pb
          SET saldo = GREATEST(pb.saldo - applied.saldo_delta, 0)
          FROM (
            SELECT *
            FROM unnest($3::bigint[], $4::bigint[], $5::double precision[])
              AS item(parceiro_id, bookmaker_id, saldo_delta)
          ) AS applied
          WHERE pb.user_id = $1
            AND pb.base_id = $2
            AND pb.parceiro_id = applied.parceiro_id
            AND pb.bookmaker_id = applied.bookmaker_id
        `,
        [
          userId,
          workspaceId,
          rows.map((row) => Number(row.parceiro_id)),
          rows.map((row) => Number(row.bookmaker_id)),
          rows.map((row) => parseNumber(row.saldo_delta)),
        ],
      );
    }

    await executor.query(
      `
        DELETE FROM procedimentos_parceiros_aplicacoes
        WHERE procedimento_id = $1
          AND user_id = $2
          AND base_id = $3
      `,
      [procedureId, userId, workspaceId],
    );
  },
};
