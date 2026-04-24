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
import {
  BOOKMAKERS_TABLE_MIGRATIONS,
  CREATE_BOOKMAKERS_TABLE_SQL,
  CREATE_PROCEDURES_TABLE_SQL,
  PROCEDURES_TABLE_MIGRATIONS,
} from "./schema.js";

function normalizeDatabaseData(data = {}) {
  return {
    data_operacao: formatOperationDate(data.data_operacao),
    tipo_procedimento: parseText(data.tipo_procedimento),
    casas_envolvidas: normalizeHouses(data.casas_envolvidas),
    jogo_time_pa: parseText(data.jogo_time_pa),
    lucro_final: parseNumber(data.lucro_final),
    bateu_duplo: parseBoolean(data.bateu_duplo) ? 1 : 0,
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

export class ProceduresSqliteRepository {
  constructor(db) {
    if (!db || typeof db.prepare !== "function") {
      throw new Error("Informe uma conexao SQLite compativel com prepare().");
    }

    this.db = db;
  }

  initialize() {
    this.createTables();
    this.updateSchema();
  }

  createTables() {
    this.db.prepare(CREATE_BOOKMAKERS_TABLE_SQL).run();
    this.db.prepare(CREATE_PROCEDURES_TABLE_SQL).run();
  }

  updateSchema() {
    const procedureColumns = this.getTableColumns("Procedimentos_Historico");
    for (const migration of PROCEDURES_TABLE_MIGRATIONS) {
      if (!procedureColumns.includes(migration.column)) {
        this.db.prepare(migration.sql).run();
      }
    }

    const bookmakerColumns = this.getTableColumns("Casas_de_Apostas");
    for (const migration of BOOKMAKERS_TABLE_MIGRATIONS) {
      if (!bookmakerColumns.includes(migration.column)) {
        this.db.prepare(migration.sql).run();
      }
    }
  }

  getTableColumns(tableName) {
    return this.db
      .prepare(`PRAGMA table_info(${tableName})`)
      .all()
      .map((column) => column.name);
  }

  addBookmaker(name) {
    const normalizedName = parseText(name).trim();
    if (!normalizedName) {
      return;
    }

    try {
      this.db
        .prepare("INSERT INTO Casas_de_Apostas (nome) VALUES (?)")
        .run(normalizedName);
    } catch (error) {
      if (!String(error.message).toLowerCase().includes("unique")) {
        throw error;
      }
    }
  }

  deleteBookmaker(name) {
    this.db.prepare("DELETE FROM Casas_de_Apostas WHERE nome = ?").run(name);
  }

  listBookmakers() {
    return this.db
      .prepare("SELECT nome FROM Casas_de_Apostas ORDER BY nome ASC")
      .all()
      .map((row) => row.nome);
  }

  listBookmakersWithBalance() {
    return this.db
      .prepare("SELECT nome, saldo FROM Casas_de_Apostas ORDER BY nome ASC")
      .all()
      .map((row) => ({
        nome: row.nome,
        saldo: parseNumber(row.saldo),
      }));
  }

  updateBookmakerBalance(name, balance) {
    this.db
      .prepare("UPDATE Casas_de_Apostas SET saldo = ? WHERE nome = ?")
      .run(parseNumber(balance), name);
  }

  listBookmakersRankedByUsage() {
    const allBookmakers = this.listBookmakers();
    const rows = this.db
      .prepare(
        "SELECT casas_envolvidas, casa_destino_freebet FROM Procedimentos_Historico",
      )
      .all();

    return rankBookmakersByUsage(allBookmakers, rows);
  }

  saveProcedure(data) {
    const normalized = normalizeDatabaseData(data);
    const result = this.db
      .prepare(
        `
        INSERT INTO Procedimentos_Historico (
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
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
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
      );

    return Number(result.lastInsertRowid);
  }

  saveFreebetConversion(data, originIds) {
    const ids = Array.isArray(originIds) ? originIds : [originIds];
    const payload = {
      ...data,
      id_freebet_origem: ids[0] ?? null,
    };

    let conversionId = null;
    this.runInTransaction(() => {
      conversionId = this.saveProcedure(payload);
      for (const originId of ids) {
        this.db
          .prepare(
            "UPDATE Procedimentos_Historico SET status_freebet = ? WHERE id = ?",
          )
          .run(FREEBET_STATUS_USED, originId);
      }
    });

    return conversionId;
  }

  getProcedureById(procedureId) {
    const row = this.db
      .prepare("SELECT * FROM Procedimentos_Historico WHERE id = ?")
      .get(procedureId);

    return row ? { ...row } : null;
  }

  listProcedures() {
    return this.db
      .prepare("SELECT * FROM Procedimentos_Historico ORDER BY id DESC")
      .all()
      .map((row) => enrichProcedure(row));
  }

  listFilteredProcedures(searchText = "", types = [], houses = []) {
    return filterProcedures(this.listProcedures(), searchText, types, houses);
  }

  updateProcedure(procedureId, data) {
    const current = this.getProcedureById(procedureId);
    if (!current) {
      throw new Error(`Procedimento ${procedureId} nao encontrado.`);
    }

    const normalized = normalizeDatabaseData({
      ...current,
      ...data,
    });

    this.db
      .prepare(
        `
        UPDATE Procedimentos_Historico SET
          data_operacao = ?,
          tipo_procedimento = ?,
          casas_envolvidas = ?,
          jogo_time_pa = ?,
          lucro_final = ?,
          bateu_duplo = ?,
          condicao_freebet = ?,
          valor_freebet_coletada = ?,
          observacao = ?,
          mes_referencia = ?,
          casa_destino_freebet = ?,
          status_freebet = ?,
          id_freebet_origem = ?,
          valor_da_freebet = ?,
          ganhou_freebet = ?
        WHERE id = ?
      `,
      )
      .run(
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
      );
  }

  deleteProcedure(procedureId) {
    this.db
      .prepare("DELETE FROM Procedimentos_Historico WHERE id = ?")
      .run(procedureId);
  }

  captureAndDeleteProcedure(procedureId) {
    const procedure = this.getProcedureById(procedureId);
    if (procedure) {
      this.deleteProcedure(procedureId);
    }

    return procedure;
  }

  restoreProcedure(data) {
    return this.saveProcedure(data);
  }

  updateDoubleStatus(procedureId, hitDouble) {
    this.db
      .prepare("UPDATE Procedimentos_Historico SET bateu_duplo = ? WHERE id = ?")
      .run(parseBoolean(hitDouble) ? 1 : 0, procedureId);
  }

  updateFreebetResult(procedureId, result) {
    const status =
      result === FREEBET_RESULT_NO
        ? FREEBET_STATUS_FINISHED
        : FREEBET_STATUS_PENDING;

    this.db
      .prepare(
        `
        UPDATE Procedimentos_Historico
        SET ganhou_freebet = ?, status_freebet = ?
        WHERE id = ?
      `,
      )
      .run(result, status, procedureId);
  }

  getFreebetState(procedureId) {
    const row = this.db
      .prepare(
        `
        SELECT id, ganhou_freebet, status_freebet
        FROM Procedimentos_Historico
        WHERE id = ?
      `,
      )
      .get(procedureId);

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      ganhou_freebet: parseText(row.ganhou_freebet),
      status_freebet: parseText(row.status_freebet, FREEBET_STATUS_NA),
    };
  }

  getFreebetStates(procedureIds) {
    const ids = Array.isArray(procedureIds) ? procedureIds : [procedureIds];
    return ids
      .map((id) => this.getFreebetState(id))
      .filter(Boolean);
  }

  restoreFreebetState(procedureId, freebetResult, freebetStatus) {
    this.db
      .prepare(
        `
        UPDATE Procedimentos_Historico
        SET ganhou_freebet = ?, status_freebet = ?
        WHERE id = ?
      `,
      )
      .run(freebetResult, freebetStatus, procedureId);
  }

  undoFreebetConversion(conversionId, originStates) {
    this.runInTransaction(() => {
      this.deleteProcedure(conversionId);

      for (const state of originStates ?? []) {
        this.restoreFreebetState(
          state.id,
          parseText(state.ganhou_freebet),
          parseText(state.status_freebet, FREEBET_STATUS_PENDING),
        );
      }
    });
  }

  listAvailableMonths() {
    return this.db
      .prepare(
        "SELECT DISTINCT mes_referencia FROM Procedimentos_Historico ORDER BY id DESC",
      )
      .all()
      .map((row) => row.mes_referencia);
  }

  getMonthData(referenceMonth) {
    return this.db
      .prepare(
        "SELECT * FROM Procedimentos_Historico WHERE mes_referencia = ? ORDER BY id DESC",
      )
      .all(referenceMonth)
      .map((row) => enrichProcedure(row));
  }

  listActiveFreebets() {
    const rows = this.db
      .prepare(
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
        FROM Procedimentos_Historico
        WHERE tipo_procedimento = 'Coletar Freebet'
          AND status_freebet = 'Pendente'
        ORDER BY id DESC
      `,
      )
      .all();

    return groupActiveFreebets(rows);
  }

  listConvertedFreebets() {
    const rows = this.db
      .prepare(
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
        FROM Procedimentos_Historico c
        LEFT JOIN Procedimentos_Historico v
          ON v.id_freebet_origem = c.id
         AND v.tipo_procedimento = 'Converter Freebet'
        WHERE c.tipo_procedimento = 'Coletar Freebet'
          AND c.status_freebet IN ('Usada', 'Finalizada')
        ORDER BY c.id DESC
      `,
      )
      .all();

    return buildConvertedFreebetsHistory(rows);
  }

  runInTransaction(callback) {
    if (typeof this.db.transaction === "function") {
      return this.db.transaction(callback)();
    }

    return callback();
  }
}
