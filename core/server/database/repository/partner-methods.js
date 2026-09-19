// Parceiros: cadastro de nomes (excluir só marca como removido).
// Os métodos entram em ProceduresPostgresRepository (this.db, this.runInTransaction…).

import "server-only";

import { parseNumber, parseText } from "../../../domain/shared/normalizers.js";
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

    const { rows } = await executor.query(
      `
        SELECT ca.nome, pb.saldo, p.id AS parceiro_id, p.nome AS parceiro_nome
        FROM parceiros_bancas pb
        INNER JOIN parceiros p
          ON p.id = pb.parceiro_id
         AND p.user_id = pb.user_id
         AND p.removido_em IS NULL
        INNER JOIN casas_de_apostas ca
          ON ca.id = pb.bookmaker_id
        WHERE pb.user_id = $1
          AND pb.base_id = $2
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

    const { rowCount } = await executor.query(
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
      `,
      [normalizedUserId, normalizedWorkspaceId, normalizedPartnerId, normalizedName, normalizeBalance(balance)],
    );

    return rowCount > 0;
  },

  async deletePartnerBookmaker(userId, workspaceId, partnerId, name, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);
    const normalizedPartnerId = normalizePartnerId(partnerId);
    const normalizedName = parseText(name).trim();

    if (!normalizedUserId || normalizedWorkspaceId <= 0 || !normalizedPartnerId || !normalizedName) {
      return false;
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

    return rowCount > 0;
  },
};
