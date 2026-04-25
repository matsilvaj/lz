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
  rankBookmakersByUsage,
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

export class ProceduresPostgresRepository {
  constructor(db) {
    if (!db || typeof db.query !== "function") {
      throw new Error("Informe uma conexao PostgreSQL compativel com query().");
    }

    this.db = db;
  }

  async initialize() {}

  async addBookmaker(name, executor = this.db) {
    const normalizedName = parseText(name).trim();
    if (!normalizedName) {
      return;
    }

    await executor.query(
      `
        INSERT INTO casas_de_apostas (nome)
        VALUES ($1)
        ON CONFLICT (nome) DO NOTHING
      `,
      [normalizedName],
    );
  }

  async deleteBookmaker(name, executor = this.db) {
    await executor.query("DELETE FROM casas_de_apostas WHERE nome = $1", [name]);
  }

  async listBookmakers(executor = this.db) {
    const { rows } = await executor.query(
      "SELECT nome FROM casas_de_apostas ORDER BY nome ASC",
    );

    return rows.map((row) => row.nome);
  }

  async listBookmakersWithBalance(executor = this.db) {
    const { rows } = await executor.query(
      "SELECT nome, saldo FROM casas_de_apostas ORDER BY nome ASC",
    );

    return rows.map((row) => ({
      nome: row.nome,
      saldo: parseNumber(row.saldo),
    }));
  }

  async updateBookmakerBalance(name, balance, executor = this.db) {
    await executor.query(
      "UPDATE casas_de_apostas SET saldo = $1 WHERE nome = $2",
      [parseNumber(balance), name],
    );
  }

  async listBookmakersRankedByUsage(executor = this.db) {
    const allBookmakers = await this.listBookmakers(executor);
    const { rows } = await executor.query(
      `
        SELECT casas_envolvidas, casa_destino_freebet
        FROM procedimentos_historico
      `,
    );

    return rankBookmakersByUsage(allBookmakers, rows);
  }

  async saveProcedure(data, executor = this.db) {
    const normalized = normalizeDatabaseData(data);
    const { rows } = await executor.query(
      `
        INSERT INTO procedimentos_historico (
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
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
        )
        RETURNING id
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
      ],
    );

    return Number(rows[0]?.id);
  }

  async saveFreebetConversion(data, originIds) {
    const ids = Array.isArray(originIds) ? originIds : [originIds];
    const payload = {
      ...data,
      id_freebet_origem: ids[0] ?? null,
    };

    let conversionId = null;

    await this.runInTransaction(async (executor) => {
      conversionId = await this.saveProcedure(payload, executor);

      for (const originId of ids) {
        await executor.query(
          `
            UPDATE procedimentos_historico
            SET status_freebet = $1
            WHERE id = $2
          `,
          [FREEBET_STATUS_USED, originId],
        );
      }
    });

    return conversionId;
  }

  async getProcedureById(procedureId, executor = this.db) {
    const { rows } = await executor.query(
      "SELECT * FROM procedimentos_historico WHERE id = $1",
      [procedureId],
    );

    const row = rows[0];
    return row ? { ...row } : null;
  }

  async listProcedures(executor = this.db) {
    const { rows } = await executor.query(
      "SELECT * FROM procedimentos_historico ORDER BY id DESC",
    );

    return rows.map((row) => enrichProcedure(row));
  }

  async listFilteredProcedures(searchText = "", types = [], houses = []) {
    return filterProcedures(
      await this.listProcedures(),
      searchText,
      types,
      houses,
    );
  }

  async updateProcedure(procedureId, data, executor = this.db) {
    const current = await this.getProcedureById(procedureId, executor);
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
      ],
    );
  }

  async deleteProcedure(procedureId, executor = this.db) {
    await executor.query("DELETE FROM procedimentos_historico WHERE id = $1", [
      procedureId,
    ]);
  }

  async captureAndDeleteProcedure(procedureId, executor = this.db) {
    const procedure = await this.getProcedureById(procedureId, executor);
    if (procedure) {
      await this.deleteProcedure(procedureId, executor);
    }

    return procedure;
  }

  async restoreProcedure(data, executor = this.db) {
    return this.saveProcedure(data, executor);
  }

  async updateDoubleStatus(procedureId, hitDouble, executor = this.db) {
    await executor.query(
      `
        UPDATE procedimentos_historico
        SET bateu_duplo = $1
        WHERE id = $2
      `,
      [parseBoolean(hitDouble), procedureId],
    );
  }

  async updateFreebetResult(procedureId, result, executor = this.db) {
    const status =
      result === FREEBET_RESULT_NO
        ? FREEBET_STATUS_FINISHED
        : FREEBET_STATUS_PENDING;

    await executor.query(
      `
        UPDATE procedimentos_historico
        SET ganhou_freebet = $1, status_freebet = $2
        WHERE id = $3
      `,
      [result, status, procedureId],
    );
  }

  async getFreebetState(procedureId, executor = this.db) {
    const { rows } = await executor.query(
      `
        SELECT id, ganhou_freebet, status_freebet
        FROM procedimentos_historico
        WHERE id = $1
      `,
      [procedureId],
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

  async getFreebetStates(procedureIds) {
    const ids = Array.isArray(procedureIds) ? procedureIds : [procedureIds];
    const states = await Promise.all(ids.map((id) => this.getFreebetState(id)));

    return states.filter(Boolean);
  }

  async restoreFreebetState(
    procedureId,
    freebetResult,
    freebetStatus,
    executor = this.db,
  ) {
    await executor.query(
      `
        UPDATE procedimentos_historico
        SET ganhou_freebet = $1, status_freebet = $2
        WHERE id = $3
      `,
      [freebetResult, freebetStatus, procedureId],
    );
  }

  async undoFreebetConversion(conversionId, originStates) {
    await this.runInTransaction(async (executor) => {
      await this.deleteProcedure(conversionId, executor);

      for (const state of originStates ?? []) {
        await this.restoreFreebetState(
          state.id,
          parseText(state.ganhou_freebet),
          parseText(state.status_freebet, FREEBET_STATUS_PENDING),
          executor,
        );
      }
    });
  }

  async listAvailableMonths(executor = this.db) {
    const { rows } = await executor.query(
      `
        SELECT DISTINCT mes_referencia
        FROM procedimentos_historico
        ORDER BY mes_referencia DESC
      `,
    );

    return rows.map((row) => row.mes_referencia);
  }

  async getMonthData(referenceMonth, executor = this.db) {
    const { rows } = await executor.query(
      `
        SELECT *
        FROM procedimentos_historico
        WHERE mes_referencia = $1
        ORDER BY id DESC
      `,
      [referenceMonth],
    );

    return rows.map((row) => enrichProcedure(row));
  }

  async listActiveFreebets(executor = this.db) {
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
        ORDER BY id DESC
      `,
    );

    return groupActiveFreebets(rows);
  }

  async listConvertedFreebets(executor = this.db) {
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
        WHERE c.tipo_procedimento = 'Coletar Freebet'
          AND c.status_freebet IN ('Usada', 'Finalizada')
        ORDER BY c.id DESC
      `,
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
