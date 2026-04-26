import "server-only";
import {
  FREEBET_RESULT_NO,
  FREEBET_STATUS_FINISHED,
  FREEBET_STATUS_NA,
  FREEBET_STATUS_PENDING,
  FREEBET_STATUS_USED,
} from "../../domain/shared/constants.js";
import {
  formatOperationDate,
  formatReferenceMonth,
  normalizeHouses,
  parseBoolean,
  parseNumber,
  parseText,
} from "../../domain/shared/normalizers.js";
import {
  buildConvertedFreebetsHistory,
  groupActiveFreebets,
} from "../../domain/freebets/freebets.service.js";
import {
  enrichProcedure,
  filterProcedures,
} from "../../domain/procedimentos/procedimentos.service.js";

function normalizeDatabaseData(data = {}) {
  return {
    data_operacao: formatOperationDate(data.data_operacao),
    tipo_procedimento: parseText(data.tipo_procedimento),
    casas_envolvidas: normalizeHouses(data.casas_envolvidas),
    jogo_time_pa: parseText(data.jogo_time_pa),
    lucro_final: parseNumber(data.lucro_final),
    bateu_duplo: parseBoolean(data.bateu_duplo),
    condicao_freebet: parseText(data.condicao_freebet),
    valor_freebet_coletada: parseNumber(data.valor_freebet_coletada),
    observacao: parseText(data.observacao),
    mes_referencia: formatReferenceMonth(data.mes_referencia),
    casa_destino_freebet: parseText(data.casa_destino_freebet),
    status_freebet: parseText(data.status_freebet, FREEBET_STATUS_NA),
    id_freebet_origem:
      data.id_freebet_origem === undefined ? null : data.id_freebet_origem,
    valor_da_freebet: parseNumber(data.valor_da_freebet),
    ganhou_freebet: parseText(data.ganhou_freebet),
  };
}

function normalizeUserId(userId) {
  return parseText(userId).trim();
}

export class ProceduresPostgresRepository {
  constructor(db) {
    if (!db || typeof db.query !== "function") {
      throw new Error("Informe uma conexão PostgreSQL compatível com query().");
    }

    this.db = db;
  }

  async initialize() {}

  async addBookmaker(name, userId, workspaceId, executor = this.db) {
    const normalizedName = parseText(name).trim();
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (!normalizedName || !normalizedUserId || normalizedWorkspaceId <= 0) {
      return;
    }

    await executor.query(
      `
        INSERT INTO usuarios_bancas (user_id, base_id, bookmaker_id)
        SELECT $1, $2, id
        FROM casas_de_apostas
        WHERE lower(nome) = lower($3)
        ON CONFLICT (base_id, bookmaker_id) DO NOTHING
      `,
      [normalizedUserId, normalizedWorkspaceId, normalizedName],
    );
  }

  async deleteBookmaker(name, userId, workspaceId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (!normalizedUserId || normalizedWorkspaceId <= 0) {
      return;
    }

    await executor.query(
      `
        DELETE FROM usuarios_bancas ub
        USING casas_de_apostas ca
        WHERE ub.bookmaker_id = ca.id
          AND ub.user_id = $1
          AND ub.base_id = $2
          AND lower(ca.nome) = lower($3)
      `,
      [normalizedUserId, normalizedWorkspaceId, name],
    );
  }

  async listBookmakers(executor = this.db) {
    const { rows } = await executor.query(
      "SELECT nome FROM casas_de_apostas ORDER BY nome ASC",
    );

    return rows.map((row) => row.nome);
  }

  async listBookmakersWithBalance(userId, workspaceId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (!normalizedUserId || normalizedWorkspaceId <= 0) {
      return [];
    }

    const { rows } = await executor.query(
      `
        SELECT ca.nome, ub.saldo
        FROM usuarios_bancas ub
        INNER JOIN casas_de_apostas ca
          ON ca.id = ub.bookmaker_id
        WHERE ub.user_id = $1
          AND ub.base_id = $2
        ORDER BY ca.nome ASC
      `,
      [normalizedUserId, normalizedWorkspaceId],
    );

    return rows.map((row) => ({
      nome: row.nome,
      saldo: parseNumber(row.saldo),
    }));
  }

  async updateBookmakerBalance(name, balance, userId, workspaceId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (!normalizedUserId || normalizedWorkspaceId <= 0) {
      return;
    }

    await executor.query(
      `
        UPDATE usuarios_bancas ub
        SET saldo = $1
        FROM casas_de_apostas ca
        WHERE ub.bookmaker_id = ca.id
          AND ub.user_id = $2
          AND ub.base_id = $3
          AND lower(ca.nome) = lower($4)
      `,
      [parseNumber(balance), normalizedUserId, normalizedWorkspaceId, name],
    );
  }

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
  }

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
      `,
      [normalizedUserId, normalizedWorkspaceId, parseText(notes)],
    );
  }

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
  }

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
  }

  async createWorkspace(userId, name, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedName = parseText(name).trim().replace(/\s+/g, " ");

    if (!normalizedUserId || !normalizedName) {
      return null;
    }

    const existing = await executor.query(
      `
        SELECT id, nome, created_at
        FROM bases_usuario
        WHERE user_id = $1
          AND lower(nome) = lower($2)
        LIMIT 1
      `,
      [normalizedUserId, normalizedName],
    );

    if (existing.rows[0]) {
      return {
        id: parseNumber(existing.rows[0].id),
        nome: parseText(existing.rows[0].nome),
        created_at: existing.rows[0].created_at,
      };
    }

    const { rows } = await executor.query(
      `
        INSERT INTO bases_usuario (user_id, nome)
        VALUES ($1, $2)
        RETURNING id, nome, created_at
      `,
      [normalizedUserId, normalizedName],
    );

    return {
      id: parseNumber(rows[0]?.id),
      nome: parseText(rows[0]?.nome),
      created_at: rows[0]?.created_at,
    };
  }

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
  }

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
  }

  async saveProcedure(data, userId, workspaceId, executor = this.db) {
    const normalized = normalizeDatabaseData(data);
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);
    const { rows } = await executor.query(
      `
        INSERT INTO procedimentos_historico (
          user_id,
          base_id,
          data_operacao,
          tipo_procedimento,
          casas_envolvidas,
          jogo_time_pa,
          lucro_final,
          bateu_duplo,
          condicao_freebet,
          valor_freebet_coletada,
          observacao,
          mes_referencia,
          casa_destino_freebet,
          status_freebet,
          id_freebet_origem,
          valor_da_freebet,
          ganhou_freebet
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        )
        RETURNING id
      `,
      [
        normalizedUserId,
        normalizedWorkspaceId,
        normalized.data_operacao,
        normalized.tipo_procedimento,
        normalized.casas_envolvidas,
        normalized.jogo_time_pa,
        normalized.lucro_final,
        normalized.bateu_duplo,
        normalized.condicao_freebet,
        normalized.valor_freebet_coletada,
        normalized.observacao,
        normalized.mes_referencia,
        normalized.casa_destino_freebet,
        normalized.status_freebet,
        normalized.id_freebet_origem,
        normalized.valor_da_freebet,
        normalized.ganhou_freebet,
      ],
    );

    return Number(rows[0]?.id);
  }

  async saveFreebetConversion(data, originIds, userId, workspaceId) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);
    const ids = Array.isArray(originIds) ? originIds : [originIds];
    const payload = {
      ...data,
      id_freebet_origem: ids[0] ?? null,
    };

    let conversionId = null;

    await this.runInTransaction(async (executor) => {
      conversionId = await this.saveProcedure(
        payload,
        normalizedUserId,
        normalizedWorkspaceId,
        executor,
      );

      for (const originId of ids) {
        await executor.query(
          `
            UPDATE procedimentos_historico
            SET status_freebet = $1
            WHERE id = $2
              AND user_id = $3
              AND base_id = $4
          `,
          [FREEBET_STATUS_USED, originId, normalizedUserId, normalizedWorkspaceId],
        );
      }
    });

    return conversionId;
  }

  async getProcedureById(procedureId, userId, workspaceId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);
    const { rows } = await executor.query(
      "SELECT * FROM procedimentos_historico WHERE id = $1 AND user_id = $2 AND base_id = $3",
      [procedureId, normalizedUserId, normalizedWorkspaceId],
    );

    const row = rows[0];
    return row ? { ...row } : null;
  }

  async listProcedures(userId, workspaceId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (!normalizedUserId || normalizedWorkspaceId <= 0) {
      return [];
    }

    const { rows } = await executor.query(
      "SELECT * FROM procedimentos_historico WHERE user_id = $1 AND base_id = $2 ORDER BY id DESC",
      [normalizedUserId, normalizedWorkspaceId],
    );

    return rows.map((row) => enrichProcedure(row));
  }

  async listFilteredProcedures(
    userId,
    workspaceId,
    searchText = "",
    types = [],
    houses = [],
  ) {
    return filterProcedures(
      await this.listProcedures(userId, workspaceId),
      searchText,
      types,
      houses,
    );
  }

  async updateProcedure(procedureId, data, userId, workspaceId, executor = this.db) {
    const current = await this.getProcedureById(procedureId, userId, workspaceId, executor);
    if (!current) {
      throw new Error(`Procedimento ${procedureId} nao encontrado.`);
    }

    const normalized = normalizeDatabaseData({
      ...current,
      ...data,
    });

    await executor.query(
      `
        UPDATE procedimentos_historico SET
          data_operacao = $1,
          tipo_procedimento = $2,
          casas_envolvidas = $3,
          jogo_time_pa = $4,
          lucro_final = $5,
          bateu_duplo = $6,
          condicao_freebet = $7,
          valor_freebet_coletada = $8,
          observacao = $9,
          mes_referencia = $10,
          casa_destino_freebet = $11,
          status_freebet = $12,
          id_freebet_origem = $13,
          valor_da_freebet = $14,
          ganhou_freebet = $15
        WHERE id = $16
          AND user_id = $17
          AND base_id = $18
      `,
      [
        normalized.data_operacao,
        normalized.tipo_procedimento,
        normalized.casas_envolvidas,
        normalized.jogo_time_pa,
        normalized.lucro_final,
        normalized.bateu_duplo,
        normalized.condicao_freebet,
        normalized.valor_freebet_coletada,
        normalized.observacao,
        normalized.mes_referencia,
        normalized.casa_destino_freebet,
        normalized.status_freebet,
        normalized.id_freebet_origem,
        normalized.valor_da_freebet,
        normalized.ganhou_freebet,
        procedureId,
        normalizeUserId(userId),
        parseNumber(workspaceId),
      ],
    );
  }

  async deleteProcedure(procedureId, userId, workspaceId, executor = this.db) {
    await executor.query(
      "DELETE FROM procedimentos_historico WHERE id = $1 AND user_id = $2 AND base_id = $3",
      [procedureId, normalizeUserId(userId), parseNumber(workspaceId)],
    );
  }

  async captureAndDeleteProcedure(procedureId, userId, workspaceId, executor = this.db) {
    const procedure = await this.getProcedureById(procedureId, userId, workspaceId, executor);
    if (procedure) {
      await this.deleteProcedure(procedureId, userId, workspaceId, executor);
    }

    return procedure;
  }

  async restoreProcedure(data, userId, workspaceId, executor = this.db) {
    return this.saveProcedure(data, userId, workspaceId, executor);
  }

  async updateDoubleStatus(procedureId, hitDouble, userId, workspaceId, executor = this.db) {
    await executor.query(
      `
        UPDATE procedimentos_historico
        SET bateu_duplo = $1
        WHERE id = $2
          AND user_id = $3
          AND base_id = $4
      `,
      [parseBoolean(hitDouble), procedureId, normalizeUserId(userId), parseNumber(workspaceId)],
    );
  }

  async updateFreebetResult(procedureId, result, userId, workspaceId, executor = this.db) {
    const status =
      result === FREEBET_RESULT_NO
        ? FREEBET_STATUS_FINISHED
        : FREEBET_STATUS_PENDING;

    await executor.query(
      `
        UPDATE procedimentos_historico
        SET ganhou_freebet = $1, status_freebet = $2
        WHERE id = $3
          AND user_id = $4
          AND base_id = $5
      `,
      [result, status, procedureId, normalizeUserId(userId), parseNumber(workspaceId)],
    );
  }

  async getFreebetState(procedureId, userId, workspaceId, executor = this.db) {
    const { rows } = await executor.query(
      `
        SELECT id, ganhou_freebet, status_freebet
        FROM procedimentos_historico
        WHERE id = $1
          AND user_id = $2
          AND base_id = $3
      `,
      [procedureId, normalizeUserId(userId), parseNumber(workspaceId)],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      ganhou_freebet: parseText(row.ganhou_freebet),
      status_freebet: parseText(row.status_freebet, FREEBET_STATUS_NA),
    };
  }

  async getFreebetStates(procedureIds, userId, workspaceId) {
    const ids = Array.isArray(procedureIds) ? procedureIds : [procedureIds];
    const states = await Promise.all(
      ids.map((id) => this.getFreebetState(id, userId, workspaceId)),
    );

    return states.filter(Boolean);
  }

  async restoreFreebetState(
    procedureId,
    freebetResult,
    freebetStatus,
    userId,
    workspaceId,
    executor = this.db,
  ) {
    await executor.query(
      `
        UPDATE procedimentos_historico
        SET ganhou_freebet = $1, status_freebet = $2
        WHERE id = $3
          AND user_id = $4
          AND base_id = $5
      `,
      [
        freebetResult,
        freebetStatus,
        procedureId,
        normalizeUserId(userId),
        parseNumber(workspaceId),
      ],
    );
  }

  async undoFreebetConversion(conversionId, originStates, userId, workspaceId) {
    await this.runInTransaction(async (executor) => {
      await this.deleteProcedure(conversionId, userId, workspaceId, executor);

      for (const state of originStates ?? []) {
        await this.restoreFreebetState(
          state.id,
          parseText(state.ganhou_freebet),
          parseText(state.status_freebet, FREEBET_STATUS_PENDING),
          userId,
          workspaceId,
          executor,
        );
      }
    });
  }

  async getMonthData(referenceMonth, userId, workspaceId, executor = this.db) {
    const { rows } = await executor.query(
      `
        SELECT *
        FROM procedimentos_historico
        WHERE mes_referencia = $1
          AND user_id = $2
          AND base_id = $3
        ORDER BY id DESC
      `,
      [referenceMonth, normalizeUserId(userId), parseNumber(workspaceId)],
    );

    return rows.map((row) => enrichProcedure(row));
  }

  async listActiveFreebets(userId, workspaceId, executor = this.db) {
    const { rows } = await executor.query(
      `
        SELECT
          id,
          data_operacao,
          casa_destino_freebet,
          valor_da_freebet,
          lucro_final,
          bateu_duplo,
          valor_freebet_coletada,
          condicao_freebet,
          ganhou_freebet
        FROM procedimentos_historico
        WHERE tipo_procedimento = 'Coletar Freebet'
          AND status_freebet = 'Pendente'
          AND user_id = $1
          AND base_id = $2
        ORDER BY id DESC
      `,
      [normalizeUserId(userId), parseNumber(workspaceId)],
    );

    return groupActiveFreebets(rows);
  }

  async listConvertedFreebets(userId, workspaceId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);
    const { rows } = await executor.query(
      `
        SELECT
          c.data_operacao AS data_coleta,
          v.data_operacao AS data_conversao,
          c.casa_destino_freebet AS casa,
          c.valor_da_freebet AS valor_freebet,
          c.lucro_final AS lucro_base_coleta,
          c.bateu_duplo AS bateu_duplo_coleta,
          c.valor_freebet_coletada AS valor_duplo_coleta,
          v.lucro_final AS lucro_base_conversao,
          v.bateu_duplo AS bateu_duplo_conversao,
          v.valor_freebet_coletada AS valor_duplo_conversao,
          c.status_freebet,
          c.ganhou_freebet
        FROM procedimentos_historico c
        LEFT JOIN procedimentos_historico v
          ON v.id_freebet_origem = c.id
         AND v.tipo_procedimento = 'Converter Freebet'
         AND v.user_id = c.user_id
         AND v.base_id = c.base_id
        WHERE c.tipo_procedimento = 'Coletar Freebet'
          AND c.status_freebet IN ('Usada', 'Finalizada')
          AND c.user_id = $1
          AND c.base_id = $2
        ORDER BY c.id DESC
      `,
      [normalizedUserId, normalizedWorkspaceId],
    );

    return buildConvertedFreebetsHistory(rows);
  }

  async runInTransaction(callback) {
    if (typeof this.db.connect !== "function") {
      return callback(this.db);
    }

    const client = await this.db.connect();

    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    if (typeof this.db.end === "function") {
      await this.db.end();
    }
  }
}
