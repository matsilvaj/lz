// Workspaces do usuário.
// Os métodos entram em ProceduresPostgresRepository (this.db, this.runInTransaction…).

import "server-only";
import {
  parseNumber,
  parseText,
} from "../../../domain/shared/normalizers.js";

import {
  normalizeUserId,
} from "./helpers.js";

export const workspaceMethods = {
  async listWorkspaces(userId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);

    if (!normalizedUserId) {
      return [];
    }

    const { rows } = await executor.query(
      `
        SELECT id, nome, created_at
        FROM bases_usuario
        WHERE user_id = $1
        ORDER BY created_at ASC, id ASC
      `,
      [normalizedUserId],
    );

    return rows.map((row) => ({
      id: parseNumber(row.id),
      nome: parseText(row.nome),
      created_at: row.created_at,
    }));
  },

  async getWorkspaceById(userId, workspaceId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (!normalizedUserId || normalizedWorkspaceId <= 0) {
      return null;
    }

    const { rows } = await executor.query(
      `
        SELECT id, nome, created_at
        FROM bases_usuario
        WHERE user_id = $1
          AND id = $2
      `,
      [normalizedUserId, normalizedWorkspaceId],
    );

    const row = rows[0];

    if (!row) {
      return null;
    }

    return {
      id: parseNumber(row.id),
      nome: parseText(row.nome),
      created_at: row.created_at,
    };
  },

  async createWorkspace(userId, name, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedName = parseText(name).trim().replace(/\s+/g, " ");

    if (!normalizedUserId || !normalizedName) {
      return null;
    }

    const inserted = await executor.query(
      `
        INSERT INTO bases_usuario (user_id, nome)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        RETURNING id, nome, created_at
      `,
      [normalizedUserId, normalizedName],
    );

    const existing =
      inserted.rows[0] ??
      (
        await executor.query(
          `
            SELECT id, nome, created_at
            FROM bases_usuario
            WHERE user_id = $1
              AND lower(nome) = lower($2)
            LIMIT 1
          `,
          [normalizedUserId, normalizedName],
        )
      ).rows[0];

    if (!existing) {
      return null;
    }

    return {
      id: parseNumber(existing.id),
      nome: parseText(existing.nome),
      created_at: existing.created_at,
    };
  },

  async updateWorkspace(userId, workspaceId, name, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);
    const normalizedName = parseText(name).trim().replace(/\s+/g, " ");

    if (!normalizedUserId || normalizedWorkspaceId <= 0 || !normalizedName) {
      return null;
    }

    const current = await this.getWorkspaceById(
      normalizedUserId,
      normalizedWorkspaceId,
      executor,
    );

    if (!current) {
      return null;
    }

    const duplicate = await executor.query(
      `
        SELECT id
        FROM bases_usuario
        WHERE user_id = $1
          AND lower(nome) = lower($2)
          AND id <> $3
        LIMIT 1
      `,
      [normalizedUserId, normalizedName, normalizedWorkspaceId],
    );

    if (duplicate.rows[0]) {
      return current;
    }

    const { rows } = await executor.query(
      `
        UPDATE bases_usuario
        SET nome = $1
        WHERE user_id = $2
          AND id = $3
        RETURNING id, nome, created_at
      `,
      [normalizedName, normalizedUserId, normalizedWorkspaceId],
    );

    const row = rows[0];

    if (!row) {
      return null;
    }

    return {
      id: parseNumber(row.id),
      nome: parseText(row.nome),
      created_at: row.created_at,
    };
  },

  async deleteWorkspace(userId, workspaceId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (!normalizedUserId || normalizedWorkspaceId <= 0) {
      return;
    }

    await executor.query(
      `
        DELETE FROM bases_usuario
        WHERE user_id = $1
          AND id = $2
      `,
      [normalizedUserId, normalizedWorkspaceId],
    );
  },
};
