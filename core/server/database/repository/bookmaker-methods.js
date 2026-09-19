// Bancas: cadastro, saldos e notas.
// Os métodos entram em ProceduresPostgresRepository (this.db, this.runInTransaction…).

import "server-only";
import {
  PROCEDURE_STATUS_PENDING,
} from "../../../domain/shared/constants.js";
import {
  parseBoolean,
  parseNumber,
  parseText,
} from "../../../domain/shared/normalizers.js";

import {
  buildProcedureBookmakerBalanceCte,
  isUndefinedTableError,
  normalizeUserId,
} from "./helpers.js";

export const bookmakerMethods = {
  async addBookmaker(name, userId, workspaceId, balance = 0, executor = this.db) {
    const normalizedName = parseText(name).trim();
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);
    const normalizedBalance = Math.min(Math.max(parseNumber(balance), 0), 9_999_999);

    if (!normalizedName || !normalizedUserId || normalizedWorkspaceId <= 0) {
      return;
    }

    if (executor === this.db && typeof this.db.connect === "function") {
      return this.runInTransaction((transaction) =>
        this.addBookmaker(
          normalizedName,
          normalizedUserId,
          normalizedWorkspaceId,
          normalizedBalance,
          transaction,
        ),
      );
    }

    await this.reconcileProcedureBookmakerApplications(
      normalizedUserId,
      normalizedWorkspaceId,
      executor,
    );

    const { rows } = await executor.query(
      `
        INSERT INTO usuarios_bancas (user_id, base_id, bookmaker_id, saldo)
        SELECT $1, $2, id, $4
        FROM casas_de_apostas
        WHERE lower(nome) = lower($3)
        ON CONFLICT (base_id, bookmaker_id)
        DO UPDATE SET saldo = EXCLUDED.saldo
        WHERE usuarios_bancas.user_id = EXCLUDED.user_id
        RETURNING bookmaker_id
      `,
      [normalizedUserId, normalizedWorkspaceId, normalizedName, normalizedBalance],
    );

    const bookmakerId = parseNumber(rows[0]?.bookmaker_id);
    if (bookmakerId > 0) {
      await this.rebaseBookmakerApplications(
        bookmakerId,
        normalizedBalance,
        normalizedUserId,
        normalizedWorkspaceId,
        executor,
      );
    }
  },

  async deleteBookmaker(name, userId, workspaceId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);
    const normalizedName = parseText(name).trim();

    if (!normalizedName || !normalizedUserId || normalizedWorkspaceId <= 0) {
      return { deleted: false, blockedByPending: false };
    }

    if (executor === this.db && typeof this.db.connect === "function") {
      return this.runInTransaction((transaction) =>
        this.deleteBookmaker(
          normalizedName,
          normalizedUserId,
          normalizedWorkspaceId,
          transaction,
        ),
      );
    }

    await this.reconcileProcedureBookmakerApplications(
      normalizedUserId,
      normalizedWorkspaceId,
      executor,
    );

    const hasPendingProcedures = await this.bookmakerHasPendingProcedures(
      normalizedName,
      normalizedUserId,
      normalizedWorkspaceId,
      executor,
    );

    if (hasPendingProcedures) {
      return { deleted: false, blockedByPending: true };
    }

    const { rows } = await executor.query(
      `
        SELECT id
        FROM casas_de_apostas
        WHERE lower(nome) = lower($1)
        LIMIT 1
      `,
      [normalizedName],
    );
    const bookmakerId = parseNumber(rows[0]?.id);

    if (bookmakerId > 0) {
      await this.rebaseBookmakerApplications(
        bookmakerId,
        0,
        normalizedUserId,
        normalizedWorkspaceId,
        executor,
      );
    }

    const result = await executor.query(
      `
        DELETE FROM usuarios_bancas ub
        USING casas_de_apostas ca
        WHERE ub.bookmaker_id = ca.id
          AND ub.user_id = $1
          AND ub.base_id = $2
          AND lower(ca.nome) = lower($3)
      `,
      [normalizedUserId, normalizedWorkspaceId, normalizedName],
    );

    return { deleted: result.rowCount > 0, blockedByPending: false };
  },

  async listBookmakers(executor = this.db) {
    const { rows } = await executor.query(
      "SELECT nome FROM casas_de_apostas ORDER BY nome ASC",
    );

    return rows.map((row) => row.nome);
  },

  async listBookmakersWithBalance(userId, workspaceId, executor = this.db) {
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

    let rows;

    try {
      const procedureBalanceCte = buildProcedureBookmakerBalanceCte();
      const result = await executor.query(
        `
          WITH manual_balances AS (
            SELECT ca.id AS bookmaker_id, ca.nome, ub.saldo
            FROM usuarios_bancas ub
            INNER JOIN casas_de_apostas ca
              ON ca.id = ub.bookmaker_id
            WHERE ub.user_id = $1
              AND ub.base_id = $2
          ),
          ${procedureBalanceCte},
          bookmaker_ids AS (
            SELECT bookmaker_id FROM manual_balances
            UNION
            SELECT bookmaker_id FROM procedure_balances
          ),
          bookmaker_totals AS (
            SELECT
              COALESCE(mb.nome, pb.nome) AS nome,
              GREATEST(
                COALESCE(mb.saldo, 0),
                COALESCE(pb.pending_required, 0),
                0
              ) AS saldo
            FROM bookmaker_ids bi
            LEFT JOIN manual_balances mb
              ON mb.bookmaker_id = bi.bookmaker_id
            LEFT JOIN procedure_balances pb
              ON pb.bookmaker_id = bi.bookmaker_id
          )
          SELECT
            nome,
            saldo
          FROM bookmaker_totals
          WHERE saldo > 0.005
          ORDER BY lower(nome) ASC
        `,
        [normalizedUserId, normalizedWorkspaceId],
      );
      rows = result.rows;
    } catch (error) {
      if (!isUndefinedTableError(error)) {
        throw error;
      }

      const result = await executor.query(
        `
          SELECT
            ca.nome,
            ub.saldo
          FROM usuarios_bancas ub
          INNER JOIN casas_de_apostas ca
            ON ca.id = ub.bookmaker_id
          WHERE ub.user_id = $1
            AND ub.base_id = $2
            AND ub.saldo > 0.005
          ORDER BY ca.nome ASC
        `,
        [normalizedUserId, normalizedWorkspaceId],
      );
      rows = result.rows;
    }

    return rows.map((row) => ({
      nome: row.nome,
      saldo: parseNumber(row.saldo),
    }));
  },

  async updateBookmakerBalance(name, balance, userId, workspaceId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);
    const normalizedName = parseText(name).trim();
    const normalizedBalance = Math.min(Math.max(parseNumber(balance), 0), 9_999_999);

    if (!normalizedName || !normalizedUserId || normalizedWorkspaceId <= 0) {
      return;
    }

    if (executor === this.db && typeof this.db.connect === "function") {
      return this.runInTransaction((transaction) =>
        this.updateBookmakerBalance(
          normalizedName,
          normalizedBalance,
          normalizedUserId,
          normalizedWorkspaceId,
          transaction,
        ),
      );
    }

    await this.reconcileProcedureBookmakerApplications(
      normalizedUserId,
      normalizedWorkspaceId,
      executor,
    );

    try {
      const { rows } = await executor.query(
        `
          INSERT INTO usuarios_bancas (user_id, base_id, bookmaker_id, saldo)
          SELECT $1, $2, ca.id, $3
          FROM casas_de_apostas ca
          WHERE lower(ca.nome) = lower($4)
          ON CONFLICT (base_id, bookmaker_id)
          DO UPDATE SET saldo = EXCLUDED.saldo
          WHERE usuarios_bancas.user_id = EXCLUDED.user_id
          RETURNING bookmaker_id
        `,
        [normalizedUserId, normalizedWorkspaceId, normalizedBalance, normalizedName],
      );

      const bookmakerId = parseNumber(rows[0]?.bookmaker_id);
      if (bookmakerId > 0) {
        await this.rebaseBookmakerApplications(
          bookmakerId,
          normalizedBalance,
          normalizedUserId,
          normalizedWorkspaceId,
          executor,
        );
      }
    } catch (error) {
      if (!isUndefinedTableError(error)) {
        throw error;
      }

      await executor.query(
        `
          INSERT INTO usuarios_bancas (user_id, base_id, bookmaker_id, saldo)
          SELECT $1, $2, ca.id, $3
          FROM casas_de_apostas ca
          WHERE lower(ca.nome) = lower($4)
          ON CONFLICT (base_id, bookmaker_id)
          DO UPDATE SET saldo = EXCLUDED.saldo
          WHERE usuarios_bancas.user_id = EXCLUDED.user_id
        `,
        [normalizedUserId, normalizedWorkspaceId, normalizedBalance, normalizedName],
      );
    }
  },

  async rebaseBookmakerApplications(
    bookmakerId,
    balance,
    userId,
    workspaceId,
    executor = this.db,
  ) {
    const normalizedBookmakerId = parseNumber(bookmakerId);
    const normalizedBalance = Math.min(Math.max(parseNumber(balance), 0), 9_999_999);
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (
      normalizedBookmakerId <= 0 ||
      !normalizedUserId ||
      normalizedWorkspaceId <= 0
    ) {
      return;
    }

    try {
      await executor.query(
        `
          WITH target_bookmaker AS (
            SELECT id, nome
            FROM casas_de_apostas
            WHERE id = $3
          ),
          settled_procedures AS (
            SELECT DISTINCT
              e.procedimento_id,
              e.user_id,
              e.base_id,
              tb.id AS bookmaker_id
            FROM procedimentos_entradas e
            INNER JOIN target_bookmaker tb
              ON lower(tb.nome) = lower(btrim(e.casa))
            WHERE e.user_id = $1
              AND e.base_id = $2
              AND btrim(e.casa) <> ''
              AND e.parceiro_id IS NULL
              AND EXISTS (
                SELECT 1
                FROM procedimentos_resultados r
                WHERE r.procedimento_id = e.procedimento_id
                  AND r.user_id = e.user_id
                  AND r.base_id = e.base_id
                  AND r.escopo = e.escopo
              )
          )
          INSERT INTO procedimentos_bancas_aplicacoes (
            procedimento_id,
            user_id,
            base_id,
            bookmaker_id,
            saldo_delta,
            saldo_anterior,
            saldo_resultante
          )
          SELECT
            procedimento_id,
            user_id,
            base_id,
            bookmaker_id,
            0,
            $4,
            $4
          FROM settled_procedures
          ON CONFLICT (procedimento_id, bookmaker_id)
          DO UPDATE SET
            saldo_delta = 0,
            saldo_anterior = EXCLUDED.saldo_anterior,
            saldo_resultante = EXCLUDED.saldo_resultante,
            atualizado_em = now()
          WHERE procedimentos_bancas_aplicacoes.user_id = EXCLUDED.user_id
            AND procedimentos_bancas_aplicacoes.base_id = EXCLUDED.base_id
        `,
        [
          normalizedUserId,
          normalizedWorkspaceId,
          normalizedBookmakerId,
          normalizedBalance,
        ],
      );
    } catch (error) {
      if (isUndefinedTableError(error)) {
        return;
      }

      throw error;
    }
  },

  async bookmakerHasPendingProcedures(
    name,
    userId,
    workspaceId,
    executor = this.db,
  ) {
    const normalizedName = parseText(name).trim();
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (!normalizedName || !normalizedUserId || normalizedWorkspaceId <= 0) {
      return false;
    }

    try {
      const { rows } = await executor.query(
        `
          SELECT EXISTS (
            SELECT 1
            FROM procedimentos_entradas e
            INNER JOIN procedimentos_historico p
              ON p.id = e.procedimento_id
             AND p.user_id = e.user_id
             AND p.base_id = e.base_id
            INNER JOIN casas_de_apostas ca
              ON lower(ca.nome) = lower(btrim(e.casa))
            WHERE e.user_id = $1
              AND e.base_id = $2
              AND lower(ca.nome) = lower($3)
              AND btrim(e.casa) <> ''
              AND e.parceiro_id IS NULL
              AND (
                p.status_procedimento = $4
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
        [
          normalizedUserId,
          normalizedWorkspaceId,
          normalizedName,
          PROCEDURE_STATUS_PENDING,
        ],
      );

      return parseBoolean(rows[0]?.has_pending);
    } catch (error) {
      if (isUndefinedTableError(error)) {
        return false;
      }

      throw error;
    }
  },

  async getBookmakersNotes(userId, workspaceId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (!normalizedUserId || normalizedWorkspaceId <= 0) {
      return "";
    }

    const { rows } = await executor.query(
      `
        SELECT texto
        FROM usuarios_observacoes_bancas
        WHERE user_id = $1
          AND base_id = $2
      `,
      [normalizedUserId, normalizedWorkspaceId],
    );

    return parseText(rows[0]?.texto);
  },

  async updateBookmakersNotes(userId, workspaceId, notes, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (!normalizedUserId || normalizedWorkspaceId <= 0) {
      return;
    }

    await executor.query(
      `
        INSERT INTO usuarios_observacoes_bancas (user_id, base_id, texto)
        VALUES ($1, $2, $3)
        ON CONFLICT (base_id)
        DO UPDATE SET texto = EXCLUDED.texto
        WHERE usuarios_observacoes_bancas.user_id = EXCLUDED.user_id
      `,
      [normalizedUserId, normalizedWorkspaceId, parseText(notes)],
    );
  },
};
