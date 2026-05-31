import "server-only";
import {
  CASINO_PROCEDURE_TYPES,
  FREEBET_CONDITION_CONVERSION_ONLY,
  FREEBET_RESULT_NO,
  FREEBET_STATUS_FINISHED,
  FREEBET_STATUS_NA,
  FREEBET_STATUS_PENDING,
  FREEBET_STATUS_USED,
  PROCEDURE_STATUS_DONE,
  PROCEDURE_STATUS_PENDING,
  PROCEDURE_STATUSES,
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
  collectionFinishedWithoutFreebet,
  groupActiveFreebets,
} from "../../domain/freebets/freebets.service.js";
import {
  enrichProcedure,
} from "../../domain/procedimentos/procedimentos.service.js";

function buildRealProfitSql(alias = "") {
  const prefix = alias ? `${alias}.` : "";

  return `
    COALESCE(${prefix}lucro_final, 0) +
    CASE
      WHEN COALESCE(${prefix}bateu_duplo, false) THEN
        CASE
          WHEN COALESCE(${prefix}valor_freebet_coletada, 0) <> 0
            THEN COALESCE(${prefix}valor_freebet_coletada, 0)
          WHEN ${prefix}tipo_procedimento = 'Coletar Freebet'
            THEN COALESCE(${prefix}valor_da_freebet, 0)
          ELSE 0
        END
      ELSE 0
    END
  `;
}

function normalizePositiveInteger(value, defaultValue) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeTextArray(value) {
  return Array.from(new Set((Array.isArray(value) ? value : [value])
    .map((item) => parseText(item).trim())
    .filter(Boolean)));
}

function normalizeIsoDate(value) {
  const text = parseText(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/u.test(text) ? text : "";
}

function createFreebetConversionBatchId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `conversion-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeDatabaseData(data = {}) {
  return {
    data_operacao: formatOperationDate(data.data_operacao),
    tipo_procedimento: parseText(data.tipo_procedimento),
    casas_envolvidas: normalizeHouses(data.casas_envolvidas),
    jogo_time_pa: parseText(data.jogo_time_pa),
    jogo_coleta_freebet: parseText(data.jogo_coleta_freebet),
    jogo_conversao_freebet: parseText(data.jogo_conversao_freebet),
    lote_conversao_freebet: parseText(data.lote_conversao_freebet),
    lucro_final: parseNumber(data.lucro_final),
    bateu_duplo: parseBoolean(data.bateu_duplo),
    condicao_freebet: parseText(data.condicao_freebet),
    valor_freebet_coletada: parseNumber(data.valor_freebet_coletada),
    observacao: parseText(data.observacao),
    mes_referencia: formatReferenceMonth(data.mes_referencia),
    casa_destino_freebet: parseText(data.casa_destino_freebet),
    status_freebet: parseText(data.status_freebet, FREEBET_STATUS_NA),
    status_procedimento: normalizeProcedureStatus(
      data.status_procedimento,
      PROCEDURE_STATUS_DONE,
    ),
    id_freebet_origem:
      data.id_freebet_origem === undefined ? null : data.id_freebet_origem,
    valor_da_freebet: parseNumber(data.valor_da_freebet),
    ganhou_freebet: parseText(data.ganhou_freebet),
  };
}

function normalizeProcedureStatus(value, fallback = PROCEDURE_STATUS_DONE) {
  const status = parseText(value).trim();
  return PROCEDURE_STATUSES.includes(status) ? status : fallback;
}

function normalizeUserId(userId) {
  return parseText(userId).trim();
}

function isUndefinedTableError(error) {
  return error && typeof error === "object" && error.code === "42P01";
}

const PROCEDURE_DETAIL_SCOPES = new Set([
  "sports",
  "freebet_collection",
  "freebet_conversion",
]);
const PROCEDURE_DETAIL_ROLES = new Set(["principal", "protecao"]);

function normalizeProcedureDetailScope(value) {
  const scope = parseText(value).trim();
  return PROCEDURE_DETAIL_SCOPES.has(scope) ? scope : "sports";
}

function normalizeProcedureDetailRole(value) {
  const role = parseText(value).trim();
  return PROCEDURE_DETAIL_ROLES.has(role) ? role : "principal";
}

function normalizeProcedureDetailSide(value) {
  return parseText(value).trim() === "lay" ? "lay" : "back";
}

function normalizeProcedureResultKey(value, fallback = "principal") {
  const key = parseText(value).trim();

  if (key === "principal" || key === "defeat" || /^protection-\d+$/u.test(key)) {
    return key;
  }

  return fallback;
}

function normalizeSelectedProcedureResultKey(value) {
  return normalizeProcedureResultKey(value, "");
}

function normalizeProcedureDetailEntries(entries) {
  return (Array.isArray(entries) ? entries : [])
    .slice(0, 80)
    .map((entry, index) => ({
      scope: normalizeProcedureDetailScope(entry?.scope),
      role: normalizeProcedureDetailRole(entry?.role),
      order: clamp(Math.trunc(parseNumber(entry?.order)), 0, 50),
      resultKey: normalizeProcedureResultKey(entry?.resultKey, `protection-${index}`),
      house: parseText(entry?.house).trim(),
      value: parseNumber(entry?.value),
      odd: parseNumber(entry?.odd),
      side: normalizeProcedureDetailSide(entry?.side),
      layOdd: parseNumber(entry?.layOdd),
      commission: parseNumber(entry?.commission),
      increase: parseNumber(entry?.increase ?? entry?.aumento_percentual),
      cashback: parseNumber(entry?.cashback ?? entry?.cashback_percentual),
      freebet: parseBoolean(entry?.freebet ?? entry?.freebet_somente_lucro),
      operationDate: parseText(entry?.operationDate ?? entry?.data_operacao).trim(),
    }))
    .filter((entry) => entry.resultKey !== "defeat");
}

function calculateAdjustedOdd(odd, increase) {
  if (odd <= 1) {
    return odd;
  }

  return 1 + (odd - 1) * (1 + increase / 100);
}

function calculateProcedureEntryPayout(entry, selectedKeys) {
  if (entry.side === "lay" && !selectedKeys.has(entry.resultKey)) {
    const baseOdd = entry.layOdd > 1 ? entry.layOdd : entry.odd;
    const effectiveOdd = calculateAdjustedOdd(baseOdd, entry.increase);

    if (effectiveOdd <= 1) {
      return 0;
    }

    const layStake = entry.value / (effectiveOdd - 1);
    const commissionMultiplier = 1 - Math.max(entry.commission, 0) / 100;
    const cashbackRate = Math.max(entry.cashback, 0) / 100;

    return (
      layStake *
      (effectiveOdd - 1 + commissionMultiplier - (effectiveOdd - 1) * cashbackRate)
    );
  }

  if (entry.side !== "lay" && selectedKeys.has(entry.resultKey)) {
    const effectiveOdd = calculateAdjustedOdd(entry.odd, entry.increase);
    const commissionMultiplier = 1 - Math.max(entry.commission, 0) / 100;
    const cashbackRate = Math.max(entry.cashback, 0) / 100;

    if (entry.freebet) {
      return entry.value * ((effectiveOdd - 1) * commissionMultiplier);
    }

    return (
      entry.value *
      (1 + (effectiveOdd - 1) * commissionMultiplier - cashbackRate)
    );
  }

  return 0;
}

function normalizeProcedureDetailResults(results) {
  return (Array.isArray(results) ? results : [])
    .slice(0, 80)
    .map((result) => {
      const resultKey = normalizeSelectedProcedureResultKey(result?.resultKey);

      if (!resultKey) {
        return null;
      }

      return {
        scope: normalizeProcedureDetailScope(result?.scope),
        resultKey,
      };
    })
    .filter(Boolean);
}

function buildProcedureBookmakerBalanceCte() {
  return `
    procedure_result_summary AS (
      SELECT
        procedimento_id,
        escopo,
        BOOL_OR(resultado_chave = 'defeat') AS defeat_selected,
        COUNT(*) FILTER (WHERE resultado_chave <> 'defeat') AS selected_count,
        ARRAY_AGG(resultado_chave) FILTER (WHERE resultado_chave <> 'defeat') AS selected_keys
      FROM procedimentos_resultados
      WHERE user_id = $1
        AND base_id = $2
      GROUP BY procedimento_id, escopo
    ),
    procedure_entry_values AS (
      SELECT
        ca.id AS bookmaker_id,
        ca.nome,
        CASE
          WHEN COALESCE(rs.defeat_selected, false)
            OR COALESCE(rs.selected_count, 0) > 0
            OR COALESCE(e.freebet_somente_lucro, false)
          THEN 0
          ELSE e.valor
        END AS pending_required,
        COALESCE(rs.selected_count, 0) AS selected_count
      FROM procedimentos_entradas e
      INNER JOIN casas_de_apostas ca
        ON lower(ca.nome) = lower(btrim(e.casa))
      LEFT JOIN procedure_result_summary rs
        ON rs.procedimento_id = e.procedimento_id
       AND rs.escopo = e.escopo
      WHERE e.user_id = $1
        AND e.base_id = $2
        AND btrim(e.casa) <> ''
    ),
    procedure_balances AS (
      SELECT
        bookmaker_id,
        nome,
        SUM(pending_required) AS pending_required
      FROM procedure_entry_values
      GROUP BY bookmaker_id, nome
      HAVING ABS(SUM(pending_required)) >= 0.005
    )
  `;
}

function buildProcedureBookmakerSettlements(details) {
  const entries = normalizeProcedureDetailEntries(details?.entries);
  const results = normalizeProcedureDetailResults(details?.results);
  const resultsByScope = new Map();

  for (const result of results) {
    const scopeResults = resultsByScope.get(result.scope) ?? {
      defeatSelected: false,
      selectedKeys: new Set(),
    };

    if (result.resultKey === "defeat") {
      scopeResults.defeatSelected = true;
      scopeResults.selectedKeys.clear();
    } else if (!scopeResults.defeatSelected) {
      scopeResults.selectedKeys.add(result.resultKey);
    }

    resultsByScope.set(result.scope, scopeResults);
  }

  const settlementsByHouse = new Map();

  for (const entry of entries) {
    const house = parseText(entry.house).trim();
    const scopeResults = resultsByScope.get(entry.scope);

    if (
      !house ||
      !scopeResults ||
      (!scopeResults.defeatSelected && scopeResults.selectedKeys.size === 0)
    ) {
      continue;
    }

    const current = settlementsByHouse.get(house.toLowerCase()) ?? {
      house,
      stake: 0,
      payout: 0,
    };
    current.stake += entry.freebet ? 0 : Math.max(entry.value, 0);

    if (!scopeResults.defeatSelected) {
      current.payout += calculateProcedureEntryPayout(
        entry,
        scopeResults.selectedKeys,
      );
    }

    settlementsByHouse.set(house.toLowerCase(), current);
  }

  return [...settlementsByHouse.values()].filter(
    (settlement) =>
      Math.abs(settlement.stake) >= 0.005 || Math.abs(settlement.payout) >= 0.005,
  );
}

function toDetailInput(entry) {
  return {
    scope: parseText(entry?.escopo ?? entry?.scope),
    role: parseText(entry?.tipo_entrada ?? entry?.role),
    order: parseNumber(entry?.ordem ?? entry?.order),
    resultKey: parseText(entry?.resultado_chave ?? entry?.resultKey),
    house: parseText(entry?.casa ?? entry?.house),
    value: parseNumber(entry?.valor ?? entry?.value),
    odd: parseNumber(entry?.odd),
    side: parseText(entry?.lado ?? entry?.side),
    layOdd: parseNumber(entry?.odd_lay ?? entry?.layOdd),
    commission: parseNumber(entry?.comissao_percentual ?? entry?.commission),
    increase: parseNumber(entry?.aumento_percentual ?? entry?.increase),
    cashback: parseNumber(entry?.cashback_percentual ?? entry?.cashback),
    freebet: parseBoolean(entry?.freebet_somente_lucro ?? entry?.freebet),
    operationDate: parseText(entry?.data_operacao ?? entry?.operationDate).trim(),
  };
}

function toResultInput(result) {
  return {
    scope: parseText(result?.escopo ?? result?.scope),
    resultKey: parseText(result?.resultado_chave ?? result?.resultKey),
  };
}

function scaleDetailInput(entry, ratio) {
  return {
    ...entry,
    value: Number((parseNumber(entry.value) * ratio).toFixed(2)),
  };
}

function calculateScopeProfit(entries, results, scope) {
  const normalizedEntries = normalizeProcedureDetailEntries(entries)
    .filter((entry) => entry.scope === scope);
  const scopeResults = normalizeProcedureDetailResults(results)
    .filter((result) => result.scope === scope);

  if (scopeResults.length === 0) {
    return 0;
  }

  const defeatSelected = scopeResults.some((result) => result.resultKey === "defeat");
  const selectedKeys = new Set(
    defeatSelected
      ? []
      : scopeResults
          .map((result) => result.resultKey)
          .filter((resultKey) => resultKey !== "defeat"),
  );
  const stake = normalizedEntries.reduce(
    (sum, entry) => sum + (entry.freebet ? 0 : Math.max(entry.value, 0)),
    0,
  );
  const payout = defeatSelected
    ? 0
    : normalizedEntries.reduce(
        (sum, entry) => sum + calculateProcedureEntryPayout(entry, selectedKeys),
        0,
      );

  return Number((payout - stake).toFixed(2));
}

function getProcedureScopeEntries(procedure, scope) {
  return (Array.isArray(procedure?.entradas) ? procedure.entradas : []).filter(
    (entry) => parseText(entry?.escopo ?? entry?.scope) === scope,
  );
}

function getProcedureScopeResults(procedure, scope) {
  return (Array.isArray(procedure?.resultados) ? procedure.resultados : []).filter(
    (result) => parseText(result?.escopo ?? result?.scope) === scope,
  );
}

function hasProcedureScopeEntries(procedure, scope) {
  return getProcedureScopeEntries(procedure, scope).length > 0;
}

function hasProcedureScopeResults(procedure, scope) {
  return getProcedureScopeResults(procedure, scope).length > 0;
}

function getProcedureScopeDate(procedure, scope, fallback = "") {
  const entryDate = getProcedureScopeEntries(procedure, scope)
    .map((entry) => parseText(entry?.data_operacao ?? entry?.operationDate).trim())
    .find(Boolean);

  return entryDate || parseText(fallback).trim();
}

function getProcedureScopeProfit(procedure, scope, fallback = 0) {
  if (!hasProcedureScopeResults(procedure, scope)) {
    return parseNumber(fallback);
  }

  return calculateScopeProfit(
    (procedure?.entradas ?? []).map(toDetailInput),
    (procedure?.resultados ?? []).map(toResultInput),
    scope,
  );
}

export class ProceduresPostgresRepository {
  constructor(db) {
    if (!db || typeof db.query !== "function") {
      throw new Error("Informe uma conexão PostgreSQL compatível com query().");
    }

    this.db = db;
  }

  async initialize() {}

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
  }

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
  }

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
  }

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
  }

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
        WHERE usuarios_observacoes_bancas.user_id = EXCLUDED.user_id
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
          jogo_coleta_freebet,
          jogo_conversao_freebet,
          lote_conversao_freebet,
          lucro_final,
          bateu_duplo,
          condicao_freebet,
          valor_freebet_coletada,
          observacao,
          mes_referencia,
          casa_destino_freebet,
          status_freebet,
          status_procedimento,
          id_freebet_origem,
          valor_da_freebet,
          ganhou_freebet
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
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
        normalized.jogo_coleta_freebet,
        normalized.jogo_conversao_freebet,
        normalized.lote_conversao_freebet,
        normalized.lucro_final,
        normalized.bateu_duplo,
        normalized.condicao_freebet,
        normalized.valor_freebet_coletada,
        normalized.observacao,
        normalized.mes_referencia,
        normalized.casa_destino_freebet,
        normalized.status_freebet,
        normalized.status_procedimento,
        normalized.id_freebet_origem,
        normalized.valor_da_freebet,
        normalized.ganhou_freebet,
      ],
    );

    return Number(rows[0]?.id);
  }

  async saveProcedureWithDetails(data, details, userId, workspaceId) {
    let procedureId = null;

    await this.runInTransaction(async (executor) => {
      procedureId = await this.saveProcedure(data, userId, workspaceId, executor);
      await this.replaceProcedureDetails(
        procedureId,
        details,
        userId,
        workspaceId,
        executor,
      );
      await this.applyProcedureBookmakerApplications(
        procedureId,
        details,
        userId,
        workspaceId,
        executor,
      );
    });

    return procedureId;
  }

  async replaceProcedureDetails(
    procedureId,
    details,
    userId,
    workspaceId,
    executor = this.db,
  ) {
    const normalizedProcedureId = parseNumber(procedureId);
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (
      !Number.isInteger(normalizedProcedureId) ||
      normalizedProcedureId <= 0 ||
      !normalizedUserId ||
      normalizedWorkspaceId <= 0
    ) {
      return;
    }

    const entries = normalizeProcedureDetailEntries(details?.entries);
    const results = normalizeProcedureDetailResults(details?.results);

    await executor.query(
      `
        DELETE FROM procedimentos_resultados
        WHERE procedimento_id = $1
          AND user_id = $2
          AND base_id = $3
      `,
      [normalizedProcedureId, normalizedUserId, normalizedWorkspaceId],
    );
    await executor.query(
      `
        DELETE FROM procedimentos_entradas
        WHERE procedimento_id = $1
          AND user_id = $2
          AND base_id = $3
      `,
      [normalizedProcedureId, normalizedUserId, normalizedWorkspaceId],
    );

    if (entries.length > 0) {
      await executor.query(
        `
          INSERT INTO procedimentos_entradas (
            procedimento_id,
            user_id,
            base_id,
            escopo,
            tipo_entrada,
            ordem,
            resultado_chave,
            casa,
            valor,
            odd,
            lado,
            odd_lay,
            comissao_percentual,
            aumento_percentual,
            cashback_percentual,
            freebet_somente_lucro,
            data_operacao
          )
          SELECT
            $1,
            $2,
            $3,
            entry.escopo,
            entry.tipo_entrada,
            entry.ordem,
            entry.resultado_chave,
            entry.casa,
            entry.valor,
            entry.odd,
            entry.lado,
            entry.odd_lay,
            entry.comissao_percentual,
            entry.aumento_percentual,
            entry.cashback_percentual,
            entry.freebet_somente_lucro,
            entry.data_operacao
          FROM unnest(
            $4::text[],
            $5::text[],
            $6::integer[],
            $7::text[],
            $8::text[],
            $9::double precision[],
            $10::double precision[],
            $11::text[],
            $12::double precision[],
            $13::double precision[],
            $14::double precision[],
            $15::double precision[],
            $16::boolean[],
            $17::text[]
          ) AS entry(
            escopo,
            tipo_entrada,
            ordem,
            resultado_chave,
            casa,
            valor,
            odd,
            lado,
            odd_lay,
            comissao_percentual,
            aumento_percentual,
            cashback_percentual,
            freebet_somente_lucro,
            data_operacao
          )
        `,
        [
          normalizedProcedureId,
          normalizedUserId,
          normalizedWorkspaceId,
          entries.map((entry) => entry.scope),
          entries.map((entry) => entry.role),
          entries.map((entry) => entry.order),
          entries.map((entry) => entry.resultKey),
          entries.map((entry) => entry.house),
          entries.map((entry) => entry.value),
          entries.map((entry) => entry.odd),
          entries.map((entry) => entry.side),
          entries.map((entry) => entry.layOdd),
          entries.map((entry) => entry.commission),
          entries.map((entry) => entry.increase),
          entries.map((entry) => entry.cashback),
          entries.map((entry) => entry.freebet),
          entries.map((entry) => entry.operationDate),
        ],
      );
    }

    if (results.length > 0) {
      await executor.query(
        `
          INSERT INTO procedimentos_resultados (
            procedimento_id,
            user_id,
            base_id,
            escopo,
            resultado_chave
          )
          SELECT
            $1,
            $2,
            $3,
            result.escopo,
            result.resultado_chave
          FROM unnest(
            $4::text[],
            $5::text[]
          ) AS result(escopo, resultado_chave)
          ON CONFLICT (procedimento_id, escopo, resultado_chave) DO NOTHING
        `,
        [
          normalizedProcedureId,
          normalizedUserId,
          normalizedWorkspaceId,
          results.map((result) => result.scope),
          results.map((result) => result.resultKey),
        ],
      );
    }
  }

  async reverseProcedureBookmakerApplications(
    procedureId,
    userId,
    workspaceId,
    executor = this.db,
  ) {
    const normalizedProcedureId = parseNumber(procedureId);
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (
      !Number.isInteger(normalizedProcedureId) ||
      normalizedProcedureId <= 0 ||
      !normalizedUserId ||
      normalizedWorkspaceId <= 0
    ) {
      return false;
    }

    try {
      const { rows } = await executor.query(
        `
          SELECT bookmaker_id, SUM(saldo_delta) AS saldo_delta
          FROM procedimentos_bancas_aplicacoes
          WHERE procedimento_id = $1
            AND user_id = $2
            AND base_id = $3
          GROUP BY bookmaker_id
        `,
        [normalizedProcedureId, normalizedUserId, normalizedWorkspaceId],
      );

      if (rows.length > 0) {
        await executor.query(
          `
            UPDATE usuarios_bancas AS ub
            SET saldo = GREATEST(ub.saldo - applied.saldo_delta, 0)
            FROM (
              SELECT *
              FROM unnest($3::bigint[], $4::double precision[])
                AS item(bookmaker_id, saldo_delta)
            ) AS applied
            WHERE ub.user_id = $1
              AND ub.base_id = $2
              AND ub.bookmaker_id = applied.bookmaker_id
          `,
          [
            normalizedUserId,
            normalizedWorkspaceId,
            rows.map((row) => parseNumber(row.bookmaker_id)),
            rows.map((row) => parseNumber(row.saldo_delta)),
          ],
        );
      }

      await executor.query(
        `
          DELETE FROM procedimentos_bancas_aplicacoes
          WHERE procedimento_id = $1
            AND user_id = $2
            AND base_id = $3
        `,
        [normalizedProcedureId, normalizedUserId, normalizedWorkspaceId],
      );

      return true;
    } catch (error) {
      if (isUndefinedTableError(error)) {
        return false;
      }

      throw error;
    }
  }

  async applyProcedureBookmakerApplications(
    procedureId,
    details,
    userId,
    workspaceId,
    executor = this.db,
  ) {
    const normalizedProcedureId = parseNumber(procedureId);
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (
      !Number.isInteger(normalizedProcedureId) ||
      normalizedProcedureId <= 0 ||
      !normalizedUserId ||
      normalizedWorkspaceId <= 0
    ) {
      return;
    }

    const settlements = buildProcedureBookmakerSettlements(details);
    if (settlements.length === 0) {
      return;
    }

    try {
      const bookmakerResult = await executor.query(
        `
          SELECT id, lower(nome) AS chave
          FROM casas_de_apostas
          WHERE lower(nome) = ANY($1::text[])
        `,
        [settlements.map((settlement) => settlement.house.toLowerCase())],
      );
      const bookmakerIdsByHouse = new Map(
        bookmakerResult.rows.map((row) => [
          parseText(row.chave),
          parseNumber(row.id),
        ]),
      );

      for (const settlement of settlements) {
        const bookmakerId = bookmakerIdsByHouse.get(settlement.house.toLowerCase());

        if (!bookmakerId) {
          continue;
        }

        const applicationResult = await executor.query(
          `
            SELECT 1
            FROM procedimentos_bancas_aplicacoes
            WHERE procedimento_id = $1
              AND user_id = $2
              AND base_id = $3
              AND bookmaker_id = $4
            FOR UPDATE
          `,
          [
            normalizedProcedureId,
            normalizedUserId,
            normalizedWorkspaceId,
            bookmakerId,
          ],
        );

        if (applicationResult.rows.length > 0) {
          continue;
        }

        const balanceResult = await executor.query(
          `
            SELECT saldo
            FROM usuarios_bancas
            WHERE user_id = $1
              AND base_id = $2
              AND bookmaker_id = $3
            FOR UPDATE
          `,
          [normalizedUserId, normalizedWorkspaceId, bookmakerId],
        );
        const previousBalance = parseNumber(balanceResult.rows[0]?.saldo);
        const nextBalance = Math.max(
          Math.max(previousBalance, settlement.stake) -
            settlement.stake +
            settlement.payout,
          0,
        );
        const delta = nextBalance - previousBalance;

        if (Math.abs(delta) >= 0.005) {
          await executor.query(
            `
              INSERT INTO usuarios_bancas (user_id, base_id, bookmaker_id, saldo)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT (base_id, bookmaker_id)
              DO UPDATE SET saldo = EXCLUDED.saldo
              WHERE usuarios_bancas.user_id = EXCLUDED.user_id
            `,
            [normalizedUserId, normalizedWorkspaceId, bookmakerId, nextBalance],
          );
        }

        await executor.query(
          `
            INSERT INTO procedimentos_bancas_aplicacoes (
              procedimento_id,
              user_id,
              base_id,
              bookmaker_id,
              saldo_delta,
              saldo_anterior,
              saldo_resultante
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (procedimento_id, bookmaker_id)
            DO UPDATE SET
              saldo_delta = EXCLUDED.saldo_delta,
              saldo_anterior = EXCLUDED.saldo_anterior,
              saldo_resultante = EXCLUDED.saldo_resultante,
              atualizado_em = now()
          `,
          [
            normalizedProcedureId,
            normalizedUserId,
            normalizedWorkspaceId,
            bookmakerId,
            delta,
            previousBalance,
            nextBalance,
          ],
        );
      }
    } catch (error) {
      if (isUndefinedTableError(error)) {
        return;
      }

      throw error;
    }
  }

  async reconcileProcedureBookmakerApplications(
    userId,
    workspaceId,
    executor = this.db,
  ) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (!normalizedUserId || normalizedWorkspaceId <= 0) {
      return;
    }

    try {
      const reconcile = async (transaction) => {
        const { rows } = await transaction.query(
          `
            SELECT p.*
            FROM procedimentos_historico p
            WHERE p.user_id = $1
              AND p.base_id = $2
              AND EXISTS (
                SELECT 1
                FROM procedimentos_entradas e
                WHERE e.procedimento_id = p.id
                  AND e.user_id = p.user_id
                  AND e.base_id = p.base_id
              )
              AND EXISTS (
                SELECT 1
                FROM procedimentos_resultados r
                WHERE r.procedimento_id = p.id
                  AND r.user_id = p.user_id
                  AND r.base_id = p.base_id
              )
              AND EXISTS (
                SELECT 1
                FROM procedimentos_entradas e
                INNER JOIN casas_de_apostas ca
                  ON lower(ca.nome) = lower(btrim(e.casa))
                WHERE e.procedimento_id = p.id
                  AND e.user_id = p.user_id
                  AND e.base_id = p.base_id
                  AND btrim(e.casa) <> ''
                  AND EXISTS (
                    SELECT 1
                    FROM procedimentos_resultados r
                    WHERE r.procedimento_id = e.procedimento_id
                      AND r.user_id = e.user_id
                      AND r.base_id = e.base_id
                      AND r.escopo = e.escopo
                  )
                  AND NOT EXISTS (
                    SELECT 1
                    FROM procedimentos_bancas_aplicacoes a
                    WHERE a.procedimento_id = e.procedimento_id
                      AND a.user_id = e.user_id
                      AND a.base_id = e.base_id
                      AND a.bookmaker_id = ca.id
                  )
              )
            ORDER BY p.id ASC
          `,
          [normalizedUserId, normalizedWorkspaceId],
        );

        const rowsWithDetails = await this.attachProcedureDetails(rows, transaction);

        for (const procedure of rowsWithDetails) {
          await this.applyProcedureBookmakerApplications(
            procedure.id,
            {
              entries: (procedure.entradas ?? []).map((entry) => ({
                scope: entry.escopo,
                role: entry.tipo_entrada,
                order: entry.ordem,
                resultKey: entry.resultado_chave,
                house: entry.casa,
                value: entry.valor,
                odd: entry.odd,
                side: entry.lado,
                layOdd: entry.odd_lay,
                commission: entry.comissao_percentual,
                increase: entry.aumento_percentual,
                cashback: entry.cashback_percentual,
                freebet: entry.freebet_somente_lucro,
              })),
              results: (procedure.resultados ?? []).map((result) => ({
                scope: result.escopo,
                resultKey: result.resultado_chave,
              })),
            },
            normalizedUserId,
            normalizedWorkspaceId,
            transaction,
          );
        }
      };

      if (executor === this.db && typeof this.db.connect === "function") {
        await this.runInTransaction(reconcile);
      } else {
        await reconcile(executor);
      }
    } catch (error) {
      if (isUndefinedTableError(error)) {
        return;
      }

      throw error;
    }
  }

  async saveFreebetConversion(data, originIds, userId, workspaceId, details = null) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);
    const ids = (Array.isArray(originIds) ? originIds : [originIds])
      .map((id) => parseNumber(id))
      .filter((id) => Number.isInteger(id) && id > 0);
    const conversionEntries = normalizeProcedureDetailEntries(details?.entries)
      .filter((entry) => entry.scope === "freebet_conversion");
    const conversionResults = normalizeProcedureDetailResults(details?.results)
      .filter((result) => result.scope === "freebet_conversion");

    if (ids.length === 0) {
      return null;
    }

    await this.runInTransaction(async (executor) => {
      const { rows } = await executor.query(
        `
          SELECT *
          FROM procedimentos_historico
          WHERE id = ANY($1::bigint[])
            AND tipo_procedimento = 'Coletar Freebet'
            AND user_id = $2
            AND base_id = $3
          ORDER BY id ASC
        `,
        [ids, normalizedUserId, normalizedWorkspaceId],
      );
      const origins = await this.attachProcedureDetails(rows, executor);

      if (origins.length === 0) {
        return;
      }

      const totalFreebetValue = origins.reduce(
        (sum, origin) => sum + Math.max(parseNumber(origin.valor_da_freebet), 0),
        0,
      );
      const hasConversionResult = conversionResults.length > 0;
      const conversionBatchId =
        parseText(data.lote_conversao_freebet) ||
        origins
          .map((origin) => parseText(origin.lote_conversao_freebet))
          .find(Boolean) ||
        createFreebetConversionBatchId();

      for (const origin of origins) {
        const originId = parseNumber(origin.id);
        const originFreebetValue = Math.max(parseNumber(origin.valor_da_freebet), 0);
        const ratio = totalFreebetValue > 0
          ? originFreebetValue / totalFreebetValue
          : 1 / origins.length;
        const preservedEntries = (origin.entradas ?? [])
          .map(toDetailInput)
          .filter((entry) => entry.scope !== "freebet_conversion");
        const preservedResults = (origin.resultados ?? [])
          .map(toResultInput)
          .filter((result) => result.scope !== "freebet_conversion");
        const scaledConversionEntries = conversionEntries.map((entry) =>
          scaleDetailInput(entry, ratio),
        );
        const nextDetails = {
          entries: [...preservedEntries, ...scaledConversionEntries],
          results: [...preservedResults, ...conversionResults],
        };
        const hasCollectionResult = preservedResults.some(
          (result) => result.scope === "freebet_collection",
        );
        const collectionProfit = hasCollectionResult
          ? calculateScopeProfit(nextDetails.entries, nextDetails.results, "freebet_collection")
          : parseNumber(origin.lucro_final);
        const conversionProfit = hasConversionResult
          ? calculateScopeProfit(nextDetails.entries, nextDetails.results, "freebet_conversion")
          : 0;
        const nextPayload = {
          ...origin,
          data_operacao: parseText(data.data_operacao) || origin.data_operacao,
          casas_envolvidas: parseText(data.casas_envolvidas) || origin.casas_envolvidas,
          jogo_time_pa: origin.jogo_time_pa,
          jogo_coleta_freebet:
            parseText(origin.jogo_coleta_freebet) ||
            parseText(data.jogo_coleta_freebet) ||
            origin.jogo_time_pa,
          jogo_conversao_freebet:
            parseText(data.jogo_conversao_freebet) ||
            parseText(data.jogo_time_pa) ||
            parseText(origin.jogo_conversao_freebet),
          lote_conversao_freebet: conversionBatchId,
          observacao: parseText(data.observacao) || origin.observacao,
          condicao_freebet: parseText(data.condicao_freebet) || origin.condicao_freebet,
          lucro_final: Number((collectionProfit + conversionProfit).toFixed(2)),
          status_freebet: hasConversionResult
            ? FREEBET_STATUS_FINISHED
            : FREEBET_STATUS_USED,
          status_procedimento: hasConversionResult
            ? PROCEDURE_STATUS_DONE
            : PROCEDURE_STATUS_PENDING,
        };

        await this.reverseProcedureBookmakerApplications(
          originId,
          normalizedUserId,
          normalizedWorkspaceId,
          executor,
        );
        await this.updateProcedure(
          originId,
          nextPayload,
          normalizedUserId,
          normalizedWorkspaceId,
          executor,
        );
        await this.replaceProcedureDetails(
          originId,
          nextDetails,
          normalizedUserId,
          normalizedWorkspaceId,
          executor,
        );
        await this.applyProcedureBookmakerApplications(
          originId,
          nextDetails,
          normalizedUserId,
          normalizedWorkspaceId,
          executor,
        );
      }
    });

    return ids[0] ?? null;
  }

  async attachProcedureDetails(rows, executor = this.db) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const procedureIds = sourceRows
      .map((row) => parseNumber(row?.id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (procedureIds.length === 0) {
      return sourceRows;
    }

    let entriesResult;
    let resultsResult;

    try {
      entriesResult = await executor.query(
        `
          SELECT
            procedimento_id,
            escopo,
            tipo_entrada,
            ordem,
            resultado_chave,
            casa,
            valor,
            odd,
            lado,
            odd_lay,
            comissao_percentual,
            aumento_percentual,
            cashback_percentual,
            freebet_somente_lucro,
            data_operacao
          FROM procedimentos_entradas
          WHERE procedimento_id = ANY($1::bigint[])
          ORDER BY procedimento_id ASC, escopo ASC, ordem ASC, id ASC
        `,
        [procedureIds],
      );
      resultsResult = await executor.query(
        `
          SELECT procedimento_id, escopo, resultado_chave
          FROM procedimentos_resultados
          WHERE procedimento_id = ANY($1::bigint[])
          ORDER BY procedimento_id ASC, escopo ASC, id ASC
        `,
        [procedureIds],
      );
    } catch (error) {
      if (isUndefinedTableError(error)) {
        return sourceRows;
      }

      throw error;
    }

    const entriesByProcedure = new Map();
    const resultsByProcedure = new Map();

    for (const entry of entriesResult.rows) {
      const procedureId = parseNumber(entry.procedimento_id);
      const current = entriesByProcedure.get(procedureId) ?? [];
      current.push({
        escopo: parseText(entry.escopo),
        tipo_entrada: parseText(entry.tipo_entrada),
        ordem: parseNumber(entry.ordem),
        resultado_chave: parseText(entry.resultado_chave),
        casa: parseText(entry.casa),
        valor: parseNumber(entry.valor),
        odd: parseNumber(entry.odd),
        lado: normalizeProcedureDetailSide(entry.lado),
        odd_lay: parseNumber(entry.odd_lay),
        comissao_percentual: parseNumber(entry.comissao_percentual),
        aumento_percentual: parseNumber(entry.aumento_percentual),
        cashback_percentual: parseNumber(entry.cashback_percentual),
        freebet_somente_lucro: parseBoolean(entry.freebet_somente_lucro),
        data_operacao: parseText(entry.data_operacao).trim(),
      });
      entriesByProcedure.set(procedureId, current);
    }

    for (const result of resultsResult.rows) {
      const procedureId = parseNumber(result.procedimento_id);
      const current = resultsByProcedure.get(procedureId) ?? [];
      current.push({
        escopo: parseText(result.escopo),
        resultado_chave: parseText(result.resultado_chave),
      });
      resultsByProcedure.set(procedureId, current);
    }

    return sourceRows.map((row) => {
      const procedureId = parseNumber(row?.id);

      return {
        ...row,
        entradas: entriesByProcedure.get(procedureId) ?? [],
        resultados: resultsByProcedure.get(procedureId) ?? [],
      };
    });
  }

  async getProcedureById(procedureId, userId, workspaceId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);
    const { rows } = await executor.query(
      "SELECT * FROM procedimentos_historico WHERE id = $1 AND user_id = $2 AND base_id = $3",
      [procedureId, normalizedUserId, normalizedWorkspaceId],
    );

    const row = (await this.attachProcedureDetails(rows, executor))[0];
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

    const rowsWithDetails = await this.attachProcedureDetails(rows, executor);
    return rowsWithDetails.map((row) => enrichProcedure(row));
  }

  async listFilteredProcedures(userId, workspaceId, filters = {}, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (!normalizedUserId || normalizedWorkspaceId <= 0) {
      return {
        items: [],
        page: 1,
        pageSize: 30,
        pageCount: 1,
        totalItems: 0,
      };
    }

    const searchText = parseText(filters.searchText).trim();
    const types = [
      ...new Set(
        normalizeTextArray(filters.types).flatMap((type) =>
          type === "Cassino" ? CASINO_PROCEDURE_TYPES : [type],
        ),
      ),
    ];
    const houses = normalizeTextArray(filters.houses);
    const statuses = normalizeTextArray(filters.statuses).filter((status) =>
      PROCEDURE_STATUSES.includes(status),
    );
    const dateFrom = normalizeIsoDate(filters.dateFrom);
    const dateTo = normalizeIsoDate(filters.dateTo);
    const pageSize = clamp(normalizePositiveInteger(filters.pageSize, 30), 20, 50);
    const requestedPage = normalizePositiveInteger(filters.page, 1);
    const params = [normalizedUserId, normalizedWorkspaceId];
    const conditions = ["user_id = $1", "base_id = $2"];
    const addParam = (value) => {
      params.push(value);
      return `$${params.length}`;
    };
    const buildDateCondition = (operator, placeholder) => `
      (
        (
          data_operacao ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
          AND to_date(data_operacao, 'DD/MM/YYYY') ${operator} ${placeholder}::date
        )
        OR EXISTS (
          SELECT 1
          FROM procedimentos_entradas pe
          WHERE pe.procedimento_id = procedimentos_historico.id
            AND pe.user_id = $1
            AND pe.base_id = $2
            AND pe.data_operacao ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
            AND to_date(pe.data_operacao, 'DD/MM/YYYY') ${operator} ${placeholder}::date
        )
      )
    `;

    if (searchText) {
      const placeholder = addParam(`%${searchText}%`);
      conditions.push(`
        (
          tipo_procedimento ILIKE ${placeholder}
          OR jogo_time_pa ILIKE ${placeholder}
          OR jogo_coleta_freebet ILIKE ${placeholder}
          OR jogo_conversao_freebet ILIKE ${placeholder}
          OR casas_envolvidas ILIKE ${placeholder}
        )
      `);
    }

    if (types.length > 0) {
      conditions.push(`tipo_procedimento = ANY(${addParam(types)}::text[])`);
    }

    if (houses.length > 0) {
      conditions.push(
        `casas_envolvidas ILIKE ANY(${addParam(houses.map((house) => `%${house}%`))}::text[])`,
      );
    }

    if (statuses.length > 0) {
      conditions.push(`status_procedimento = ANY(${addParam(statuses)}::text[])`);
    }

    if (dateFrom) {
      conditions.push(buildDateCondition(">=", addParam(dateFrom)));
    }

    if (dateTo) {
      conditions.push(buildDateCondition("<=", addParam(dateTo)));
    }

    const whereClause = conditions.join(" AND ");
    const countResult = await executor.query(
      `
        SELECT COUNT(*)::integer AS total
        FROM procedimentos_historico
        WHERE ${whereClause}
      `,
      params,
    );
    const totalItems = parseNumber(countResult.rows[0]?.total);
    const pageCount = Math.max(Math.ceil(totalItems / pageSize), 1);
    const page = clamp(requestedPage, 1, pageCount);
    const rowParams = [...params, pageSize, (page - 1) * pageSize];
    const limitPlaceholder = `$${rowParams.length - 1}`;
    const offsetPlaceholder = `$${rowParams.length}`;
    const { rows } = await executor.query(
      `
        SELECT *
        FROM procedimentos_historico
        WHERE ${whereClause}
        ORDER BY id DESC
        LIMIT ${limitPlaceholder}
        OFFSET ${offsetPlaceholder}
      `,
      rowParams,
    );

    const rowsWithDetails = await this.attachProcedureDetails(rows, executor);

    return {
      items: rowsWithDetails.map((row) => enrichProcedure(row)),
      page,
      pageSize,
      pageCount,
      totalItems,
    };
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
          jogo_coleta_freebet = $5,
          jogo_conversao_freebet = $6,
          lote_conversao_freebet = $7,
          lucro_final = $8,
          bateu_duplo = $9,
          condicao_freebet = $10,
          valor_freebet_coletada = $11,
          observacao = $12,
          mes_referencia = $13,
          casa_destino_freebet = $14,
          status_freebet = $15,
          status_procedimento = $16,
          id_freebet_origem = $17,
          valor_da_freebet = $18,
          ganhou_freebet = $19
        WHERE id = $20
          AND user_id = $21
          AND base_id = $22
      `,
      [
        normalized.data_operacao,
        normalized.tipo_procedimento,
        normalized.casas_envolvidas,
        normalized.jogo_time_pa,
        normalized.jogo_coleta_freebet,
        normalized.jogo_conversao_freebet,
        normalized.lote_conversao_freebet,
        normalized.lucro_final,
        normalized.bateu_duplo,
        normalized.condicao_freebet,
        normalized.valor_freebet_coletada,
        normalized.observacao,
        normalized.mes_referencia,
        normalized.casa_destino_freebet,
        normalized.status_freebet,
        normalized.status_procedimento,
        normalized.id_freebet_origem,
        normalized.valor_da_freebet,
        normalized.ganhou_freebet,
        procedureId,
        normalizeUserId(userId),
        parseNumber(workspaceId),
      ],
    );
  }

  async updateProcedureWithDetails(procedureId, data, details, userId, workspaceId) {
    await this.runInTransaction(async (executor) => {
      await this.reverseProcedureBookmakerApplications(
        procedureId,
        userId,
        workspaceId,
        executor,
      );
      await this.updateProcedure(procedureId, data, userId, workspaceId, executor);
      await this.replaceProcedureDetails(
        procedureId,
        details,
        userId,
        workspaceId,
        executor,
      );
      await this.applyProcedureBookmakerApplications(
        procedureId,
        details,
        userId,
        workspaceId,
        executor,
      );
    });
  }

  async deleteProcedure(procedureId, userId, workspaceId, executor = this.db) {
    await this.reverseProcedureBookmakerApplications(
      procedureId,
      userId,
      workspaceId,
      executor,
    );
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
    const ids = (Array.isArray(procedureIds) ? procedureIds : [procedureIds])
      .map((id) => parseNumber(id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (ids.length === 0) {
      return [];
    }

    const { rows } = await this.db.query(
      `
        SELECT id, ganhou_freebet, status_freebet
        FROM procedimentos_historico
        WHERE id = ANY($1::bigint[])
          AND user_id = $2
          AND base_id = $3
        ORDER BY id ASC
      `,
      [ids, normalizeUserId(userId), parseNumber(workspaceId)],
    );

    return rows.map((row) => ({
      id: row.id,
      ganhou_freebet: parseText(row.ganhou_freebet),
      status_freebet: parseText(row.status_freebet, FREEBET_STATUS_NA),
    }));
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

  async restoreFreebetStates(originStates, userId, workspaceId, executor = this.db) {
    const states = (originStates ?? [])
      .map((state) => ({
        id: parseNumber(state?.id),
        ganhou_freebet: parseText(state?.ganhou_freebet),
        status_freebet: parseText(state?.status_freebet, FREEBET_STATUS_PENDING),
      }))
      .filter((state) => Number.isInteger(state.id) && state.id > 0);

    if (states.length === 0) {
      return;
    }

    await executor.query(
      `
        UPDATE procedimentos_historico AS p
        SET ganhou_freebet = state.ganhou_freebet,
            status_freebet = state.status_freebet
        FROM (
          SELECT *
          FROM unnest($1::bigint[], $2::text[], $3::text[])
            AS state(id, ganhou_freebet, status_freebet)
        ) AS state
        WHERE p.id = state.id
          AND p.user_id = $4
          AND p.base_id = $5
      `,
      [
        states.map((state) => state.id),
        states.map((state) => state.ganhou_freebet),
        states.map((state) => state.status_freebet),
        normalizeUserId(userId),
        parseNumber(workspaceId),
      ],
    );
  }

  async undoFreebetConversion(conversionId, originStates, userId, workspaceId) {
    await this.runInTransaction(async (executor) => {
      await this.deleteProcedure(conversionId, userId, workspaceId, executor);
      await this.restoreFreebetStates(originStates, userId, workspaceId, executor);
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

    const rowsWithDetails = await this.attachProcedureDetails(rows, executor);
    return rowsWithDetails.map((row) => enrichProcedure(row));
  }

  async listHistoryMonths(userId, workspaceId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (!normalizedUserId || normalizedWorkspaceId <= 0) {
      return [];
    }

    const realProfitSql = buildRealProfitSql();
    const { rows } = await executor.query(
      `
        WITH scoped AS (
          SELECT
            CASE
              WHEN NULLIF(mes_referencia, '') IS NOT NULL THEN mes_referencia
              WHEN data_operacao ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
                THEN substring(data_operacao FROM 4 FOR 7)
              ELSE ''
            END AS reference_month,
            ${realProfitSql} AS lucro_real_calculado
          FROM procedimentos_historico
          WHERE user_id = $1
            AND base_id = $2
        )
        SELECT
          reference_month,
          COALESCE(SUM(lucro_real_calculado), 0) AS profit,
          COUNT(*)::integer AS count
        FROM scoped
        GROUP BY reference_month
      `,
      [normalizedUserId, normalizedWorkspaceId],
    );

    return rows.map((row) => ({
      value: parseText(row.reference_month),
      profit: parseNumber(row.profit),
      count: parseNumber(row.count),
    }));
  }

  async listHistoryOperationsByMonth(referenceMonth, userId, workspaceId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);
    const normalizedReferenceMonth = parseText(referenceMonth).trim();

    if (!normalizedUserId || normalizedWorkspaceId <= 0) {
      return [];
    }

    if (!normalizedReferenceMonth) {
      return this.listProcedures(normalizedUserId, normalizedWorkspaceId, executor);
    }

    const { rows } = await executor.query(
      `
        SELECT *
        FROM procedimentos_historico
        WHERE user_id = $1
          AND base_id = $2
          AND (
            mes_referencia = $3
            OR (
              (mes_referencia IS NULL OR mes_referencia = '')
              AND data_operacao ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
              AND substring(data_operacao FROM 4 FOR 7) = $3
            )
          )
        ORDER BY id DESC
      `,
      [normalizedUserId, normalizedWorkspaceId, normalizedReferenceMonth],
    );

    const rowsWithDetails = await this.attachProcedureDetails(rows, executor);
    return rowsWithDetails.map((row) => enrichProcedure(row));
  }

  async getDashboardProcedureStats(referenceMonth, todayLabel, userId, workspaceId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (!referenceMonth || !normalizedUserId || normalizedWorkspaceId <= 0) {
      return {
        metrics: [],
        daily: [],
      };
    }

    const realProfitSql = buildRealProfitSql();
    const params = [referenceMonth, normalizedUserId, normalizedWorkspaceId, todayLabel];
    const [metricsResult, dailyResult] = await Promise.all([
      executor.query(
        `
          WITH month_rows AS (
            SELECT
              data_operacao,
              tipo_procedimento,
              ${realProfitSql} AS lucro_real_calculado
            FROM procedimentos_historico
            WHERE mes_referencia = $1
              AND user_id = $2
              AND base_id = $3
          )
          SELECT
            CASE
              WHEN GROUPING(tipo_procedimento) = 1 THEN 'Todos'
              ELSE tipo_procedimento
            END AS filtro,
            COALESCE(SUM(lucro_real_calculado), 0) AS monthly_profit,
            COUNT(*)::integer AS monthly_procedure_count,
            COUNT(DISTINCT NULLIF(data_operacao, ''))::integer AS active_days,
            COALESCE(SUM(lucro_real_calculado) FILTER (WHERE data_operacao = $4), 0) AS today_profit,
            (COUNT(*) FILTER (WHERE data_operacao = $4))::integer AS procedures_today
          FROM month_rows
          GROUP BY GROUPING SETS ((tipo_procedimento), ())
        `,
        params,
      ),
      executor.query(
        `
          WITH month_rows AS (
            SELECT
              data_operacao,
              tipo_procedimento,
              ${realProfitSql} AS lucro_real_calculado
            FROM procedimentos_historico
            WHERE mes_referencia = $1
              AND user_id = $2
              AND base_id = $3
              AND NULLIF(data_operacao, '') IS NOT NULL
          )
          SELECT
            CASE
              WHEN GROUPING(tipo_procedimento) = 1 THEN 'Todos'
              ELSE tipo_procedimento
            END AS filtro,
            data_operacao,
            COALESCE(SUM(lucro_real_calculado), 0) AS profit,
            COUNT(*)::integer AS volume
          FROM month_rows
          GROUP BY GROUPING SETS ((tipo_procedimento, data_operacao), (data_operacao))
          ORDER BY data_operacao ASC
        `,
        params.slice(0, 3),
      ),
    ]);

    return {
      metrics: metricsResult.rows,
      daily: dailyResult.rows,
    };
  }

  async getConvertedFreebetDailyProfit(referenceMonth, userId, workspaceId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (!referenceMonth || !normalizedUserId || normalizedWorkspaceId <= 0) {
      return [];
    }

    const collectionProfitSql = buildRealProfitSql("c");
    const conversionProfitSql = buildRealProfitSql("v");
    const { rows } = await executor.query(
      `
        SELECT
          v.data_operacao,
          COALESCE(SUM((${collectionProfitSql}) + (${conversionProfitSql})), 0) AS value,
          COUNT(*)::integer AS count
        FROM procedimentos_historico c
        INNER JOIN procedimentos_historico v
          ON v.id_freebet_origem = c.id
         AND v.tipo_procedimento = 'Converter Freebet'
         AND v.user_id = c.user_id
         AND v.base_id = c.base_id
        WHERE c.tipo_procedimento = 'Coletar Freebet'
          AND c.status_freebet IN ('Usada', 'Finalizada')
          AND v.mes_referencia = $1
          AND c.user_id = $2
          AND c.base_id = $3
        GROUP BY v.data_operacao
        ORDER BY v.data_operacao ASC
      `,
      [referenceMonth, normalizedUserId, normalizedWorkspaceId],
    );

    return rows;
  }

  async getFreebetsSummary(userId, workspaceId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (!normalizedUserId || normalizedWorkspaceId <= 0) {
      return {
        pendingConfirmationCount: 0,
        convertibleCount: 0,
        convertibleValue: 0,
        convertedCount: 0,
        convertedProfit: 0,
        activeProfit: 0,
      };
    }

    const realProfitSql = buildRealProfitSql();
    const { rows } = await executor.query(
      `
        WITH scoped AS (
          SELECT
            *,
            ${realProfitSql} AS lucro_real_calculado
          FROM procedimentos_historico
          WHERE user_id = $1
            AND base_id = $2
        ),
        collection_state AS (
          SELECT
            scoped.*,
            EXISTS (
              SELECT 1
              FROM procedimentos_resultados r
              WHERE r.procedimento_id = scoped.id
                AND r.escopo = 'freebet_collection'
            ) AS coleta_resolvida,
            EXISTS (
              SELECT 1
              FROM procedimentos_resultados r
              WHERE r.procedimento_id = scoped.id
                AND r.escopo = 'freebet_collection'
                AND r.resultado_chave = 'principal'
            ) AS coleta_principal
          FROM scoped
        ),
        converted AS (
          SELECT
            c.id,
            c.lucro_real_calculado + COALESCE(v.lucro_real_calculado, 0) AS lucro_total
          FROM collection_state c
          LEFT JOIN collection_state v
            ON v.id_freebet_origem = c.id
           AND v.tipo_procedimento = 'Converter Freebet'
          WHERE c.tipo_procedimento = 'Coletar Freebet'
            AND (
              c.status_freebet IN ('Usada', 'Finalizada')
              OR (
                c.status_freebet = 'Pendente'
                AND c.condicao_freebet = 'Apenas se perder a aposta'
                AND c.coleta_principal
              )
            )
        )
        SELECT
          (COUNT(*) FILTER (
            WHERE tipo_procedimento = 'Coletar Freebet'
              AND status_freebet = 'Pendente'
              AND NOT coleta_resolvida
          ))::integer AS pending_confirmation_count,
          (COUNT(*) FILTER (
            WHERE tipo_procedimento = 'Coletar Freebet'
              AND status_freebet = 'Pendente'
              AND coleta_resolvida
              AND NOT (
                condicao_freebet = 'Apenas se perder a aposta'
                AND coleta_principal
              )
          ))::integer AS convertible_count,
          COALESCE(SUM(valor_da_freebet) FILTER (
            WHERE tipo_procedimento = 'Coletar Freebet'
              AND status_freebet = 'Pendente'
              AND coleta_resolvida
              AND NOT (
                condicao_freebet = 'Apenas se perder a aposta'
                AND coleta_principal
              )
          ), 0) AS convertible_value,
          COALESCE(SUM(lucro_real_calculado) FILTER (
            WHERE tipo_procedimento = 'Coletar Freebet'
              AND status_freebet = 'Pendente'
              AND NOT (
                condicao_freebet = 'Apenas se perder a aposta'
                AND coleta_principal
              )
          ), 0) AS active_profit,
          (SELECT COUNT(*)::integer FROM converted) AS converted_count,
          (SELECT COALESCE(SUM(lucro_total), 0) FROM converted) AS converted_profit
        FROM collection_state
      `,
      [normalizedUserId, normalizedWorkspaceId],
    );

    const row = rows[0] ?? {};

    return {
      pendingConfirmationCount: parseNumber(row.pending_confirmation_count),
      convertibleCount: parseNumber(row.convertible_count),
      convertibleValue: parseNumber(row.convertible_value),
      convertedCount: parseNumber(row.converted_count),
      convertedProfit: parseNumber(row.converted_profit),
      activeProfit: parseNumber(row.active_profit),
    };
  }

  async listActiveFreebets(userId, workspaceId, executor = this.db) {
    const { rows } = await executor.query(
      `
        SELECT
          *
        FROM procedimentos_historico
        WHERE tipo_procedimento = 'Coletar Freebet'
          AND status_freebet IN ('Pendente', 'Usada')
          AND user_id = $1
          AND base_id = $2
        ORDER BY id DESC
      `,
      [normalizeUserId(userId), parseNumber(workspaceId)],
    );

    const rowsWithDetails = await this.attachProcedureDetails(rows, executor);
    return groupActiveFreebets(rowsWithDetails);
  }

  async listConvertedFreebets(userId, workspaceId, options = {}, executor = this.db) {
    if (options && typeof options.query === "function") {
      executor = options;
      options = {};
    }

    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);
    const params = [normalizedUserId, normalizedWorkspaceId];
    const limit = normalizePositiveInteger(options?.limit, 0);
    const { rows } = await executor.query(
      `
        SELECT *
        FROM procedimentos_historico c
        WHERE c.tipo_procedimento = 'Coletar Freebet'
          AND c.status_freebet IN ('Pendente', 'Usada', 'Finalizada')
          AND c.user_id = $1
          AND c.base_id = $2
        ORDER BY c.id DESC
      `,
      params,
    );

    const collections = await this.attachProcedureDetails(rows, executor);
    const collectionIds = collections
      .map((collection) => parseNumber(collection.id))
      .filter((id) => Number.isInteger(id) && id > 0);
    let legacyConversions = [];

    if (collectionIds.length > 0) {
      const legacyResult = await executor.query(
        `
          SELECT *
          FROM procedimentos_historico
          WHERE id_freebet_origem = ANY($1::bigint[])
            AND tipo_procedimento = 'Converter Freebet'
            AND user_id = $2
            AND base_id = $3
          ORDER BY id DESC
        `,
        [collectionIds, normalizedUserId, normalizedWorkspaceId],
      );
      legacyConversions = await this.attachProcedureDetails(legacyResult.rows, executor);
    }

    const legacyByOrigin = new Map();
    for (const conversion of legacyConversions) {
      const originId = parseNumber(conversion.id_freebet_origem);
      if (!legacyByOrigin.has(originId)) {
        legacyByOrigin.set(originId, conversion);
      }
    }

    const historyRows = [];
    for (const collection of collections) {
      const collectionId = parseNumber(collection.id);
      const legacyConversion = legacyByOrigin.get(collectionId);
      const conversionOnly =
        parseText(collection.condicao_freebet) ===
        FREEBET_CONDITION_CONVERSION_ONLY;
      const hasSyncedConversion =
        hasProcedureScopeEntries(collection, "freebet_conversion") ||
        hasProcedureScopeResults(collection, "freebet_conversion");
      const conversionResolved = hasProcedureScopeResults(
        collection,
        "freebet_conversion",
      );
      const finishedWithoutFreebet =
        !conversionOnly &&
        ((
          parseText(collection.status_freebet) === FREEBET_STATUS_FINISHED &&
          parseText(collection.ganhou_freebet) === FREEBET_RESULT_NO
        ) ||
          collectionFinishedWithoutFreebet(collection));
      const onlyCollectionFinished =
        finishedWithoutFreebet &&
        !hasSyncedConversion &&
        !legacyConversion;

      if (!onlyCollectionFinished && !legacyConversion && !conversionResolved) {
        continue;
      }

      const hasCollectionDetails = hasProcedureScopeResults(
        collection,
        "freebet_collection",
      );
      const collectionProfit = conversionOnly
        ? 0
        : hasCollectionDetails
          ? getProcedureScopeProfit(collection, "freebet_collection")
          : parseNumber(collection.lucro_final);
      const conversionProfit = hasSyncedConversion
        ? getProcedureScopeProfit(collection, "freebet_conversion")
        : parseNumber(legacyConversion?.lucro_final);

      historyRows.push({
        procedimento_id: collectionId,
        data_coleta: conversionOnly
          ? ""
          : getProcedureScopeDate(
              collection,
              "freebet_collection",
              collection.data_operacao,
            ),
        data_conversao: hasSyncedConversion
          ? getProcedureScopeDate(collection, "freebet_conversion")
          : parseText(legacyConversion?.data_operacao),
        casa: parseText(collection.casa_destino_freebet, "Desconhecida") || "Desconhecida",
        valor_freebet: parseNumber(collection.valor_da_freebet),
        lucro_base_coleta: collectionProfit,
        bateu_duplo_coleta: hasCollectionDetails
          ? false
          : parseBoolean(collection.bateu_duplo),
        valor_duplo_coleta: hasCollectionDetails
          ? 0
          : parseNumber(collection.valor_freebet_coletada),
        lucro_base_conversao: conversionProfit,
        bateu_duplo_conversao: hasSyncedConversion
          ? false
          : parseBoolean(legacyConversion?.bateu_duplo),
        valor_duplo_conversao: hasSyncedConversion
          ? 0
          : parseNumber(legacyConversion?.valor_freebet_coletada),
        status_freebet: parseText(collection.status_freebet),
        condicao_freebet: parseText(collection.condicao_freebet),
        ganhou_freebet: finishedWithoutFreebet
          ? FREEBET_RESULT_NO
          : parseText(collection.ganhou_freebet),
        procedimento: collection,
      });
    }

    const history = buildConvertedFreebetsHistory(historyRows);
    return limit > 0 ? history.slice(0, limit) : history;
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
