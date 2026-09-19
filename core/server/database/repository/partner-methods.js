// Parceiros: cadastro de nomes (excluir só marca como removido).
// Os métodos entram em ProceduresPostgresRepository (this.db, this.runInTransaction…).

import "server-only";

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
};
