// Sessão ativa do usuário (um acesso por conta).
// Os métodos entram em ProceduresPostgresRepository (this.db, this.runInTransaction…).

import "server-only";
import {
  parseText,
} from "../../../domain/shared/normalizers.js";

import {
  normalizeUserId,
} from "./helpers.js";

export const sessionMethods = {
  async setActiveUserSession(userId, sessionId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedSessionId = parseText(sessionId).trim().slice(0, 128);

    if (!normalizedUserId || !normalizedSessionId) {
      return;
    }

    await executor.query(
      `
        INSERT INTO user_active_sessions (
          user_id,
          session_id,
          created_at,
          updated_at,
          last_seen_at
        )
        VALUES ($1, $2, NOW(), NOW(), NOW())
        ON CONFLICT (user_id) DO UPDATE
        SET
          session_id = EXCLUDED.session_id,
          created_at = CASE
            WHEN user_active_sessions.session_id <> EXCLUDED.session_id
              THEN NOW()
            ELSE user_active_sessions.created_at
          END,
          updated_at = NOW(),
          last_seen_at = NOW()
      `,
      [normalizedUserId, normalizedSessionId],
    );
  },

  async isActiveUserSession(userId, sessionId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedSessionId = parseText(sessionId).trim().slice(0, 128);

    if (!normalizedUserId || !normalizedSessionId) {
      return false;
    }

    const { rows } = await executor.query(
      `
        WITH active_session AS (
          SELECT user_id
          FROM user_active_sessions
          WHERE user_id = $1
            AND session_id = $2
        ),
        touched_session AS (
          UPDATE user_active_sessions
          SET last_seen_at = NOW()
          WHERE user_id = $1
            AND session_id = $2
            AND last_seen_at < NOW() - INTERVAL '2 minutes'
          RETURNING user_id
        )
        SELECT EXISTS (SELECT 1 FROM active_session) AS active
      `,
      [normalizedUserId, normalizedSessionId],
    );

    return Boolean(rows[0]?.active);
  },

  async clearActiveUserSession(userId, sessionId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedSessionId = parseText(sessionId).trim().slice(0, 128);

    if (!normalizedUserId || !normalizedSessionId) {
      return;
    }

    await executor.query(
      `
        DELETE FROM user_active_sessions
        WHERE user_id = $1
          AND session_id = $2
      `,
      [normalizedUserId, normalizedSessionId],
    );
  },
};
