// Favoritos, jogos mais acessados e filtros salvos do monitor.
// Os métodos entram em ProceduresPostgresRepository (this.db, this.runInTransaction…).

import "server-only";
import {
  parseText,
} from "../../../domain/shared/normalizers.js";

import {
  normalizeUserId,
} from "./helpers.js";

export const monitorMethods = {
  async listMonitorFavorites(userId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);

    if (!normalizedUserId) {
      return [];
    }

    const { rows } = await executor.query(
      `
        SELECT tipo, chave
        FROM user_monitor_favorites
        WHERE user_id = $1
        ORDER BY created_at ASC
        LIMIT 1000
      `,
      [normalizedUserId],
    );

    return rows.map((row) => ({ type: row.tipo, key: row.chave }));
  },

  async setMonitorFavorite(userId, type, key, favorite, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedType = type === "campeonato" ? "campeonato" : "jogo";
    const normalizedKey = parseText(key).trim().slice(0, 200);

    if (!normalizedUserId || !normalizedKey) {
      return;
    }

    if (favorite) {
      await executor.query(
        `
          INSERT INTO user_monitor_favorites (user_id, tipo, chave)
          VALUES ($1, $2, $3)
          ON CONFLICT (user_id, tipo, chave) DO NOTHING
        `,
        [normalizedUserId, normalizedType, normalizedKey],
      );
      return;
    }

    await executor.query(
      `
        DELETE FROM user_monitor_favorites
        WHERE user_id = $1
          AND tipo = $2
          AND chave = $3
      `,
      [normalizedUserId, normalizedType, normalizedKey],
    );
  },

  async recordMonitorEventView(userId, fixtureId, startsAt, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedFixtureId = parseText(fixtureId).trim().slice(0, 200);
    const startsAtDate = new Date(startsAt);

    if (!normalizedUserId || !normalizedFixtureId || Number.isNaN(startsAtDate.getTime())) {
      return;
    }

    await executor.query(
      `
        INSERT INTO monitor_event_views (user_id, fixture_id, starts_at, viewed_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id, fixture_id)
        DO UPDATE SET viewed_at = NOW(), starts_at = EXCLUDED.starts_at
      `,
      [normalizedUserId, normalizedFixtureId, startsAtDate.toISOString()],
    );

    // Limpeza leve: jogos que já começaram há mais de um dia não entram mais no ranking.
    if (Math.random() < 0.05) {
      await executor.query(
        "DELETE FROM monitor_event_views WHERE starts_at < NOW() - INTERVAL '1 day'",
      );
    }
  },

  // Jogos que mais usuários diferentes abriram nas últimas 24h e que ainda não começaram.
  async listTrendingMonitorFixtures(limit = 10, executor = this.db) {
    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const { rows } = await executor.query(
      `
        SELECT fixture_id
        FROM monitor_event_views
        WHERE viewed_at > NOW() - INTERVAL '24 hours'
          AND starts_at > NOW()
        GROUP BY fixture_id
        ORDER BY COUNT(*) DESC, MAX(viewed_at) DESC
        LIMIT $1
      `,
      [safeLimit],
    );

    return rows.map((row) => row.fixture_id);
  },

  async getFilterPreset(userId, screen, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedScreen = parseText(screen).trim().slice(0, 60);

    if (!normalizedUserId || !normalizedScreen) {
      return null;
    }

    const { rows } = await executor.query(
      `
        SELECT filtros
        FROM user_filter_presets
        WHERE user_id = $1
          AND tela = $2
      `,
      [normalizedUserId, normalizedScreen],
    );

    return rows[0]?.filtros ?? null;
  },

  async saveFilterPreset(userId, screen, filters, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedScreen = parseText(screen).trim().slice(0, 60);

    if (!normalizedUserId || !normalizedScreen) {
      return;
    }

    await executor.query(
      `
        INSERT INTO user_filter_presets (user_id, tela, filtros, created_at, updated_at)
        VALUES ($1, $2, $3::jsonb, NOW(), NOW())
        ON CONFLICT (user_id, tela) DO UPDATE
        SET filtros = EXCLUDED.filtros,
            updated_at = NOW()
      `,
      [normalizedUserId, normalizedScreen, JSON.stringify(filters ?? {})],
    );
  },

  async deleteFilterPreset(userId, screen, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedScreen = parseText(screen).trim().slice(0, 60);

    if (!normalizedUserId || !normalizedScreen) {
      return;
    }

    await executor.query(
      `
        DELETE FROM user_filter_presets
        WHERE user_id = $1
          AND tela = $2
      `,
      [normalizedUserId, normalizedScreen],
    );
  },
};
