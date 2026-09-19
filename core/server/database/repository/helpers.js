// Funções auxiliares do repositório PostgreSQL.

import "server-only";
import {
  FREEBET_STATUS_NA,
  PROCEDURE_STATUSES,
  PROCEDURE_STATUS_DONE,
} from "../../../domain/shared/constants.js";
import {
  formatOperationDate,
  formatReferenceMonth,
  normalizeHouses,
  parseBoolean,
  parseNumber,
  parseText,
} from "../../../domain/shared/normalizers.js";
import {
  calculateAdjustedOdd,
} from "../../../domain/shared/odds.js";

export function buildRealProfitSql(alias = "") {
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

export function normalizePositiveInteger(value, defaultValue) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function normalizeTextArray(value) {
  return Array.from(new Set((Array.isArray(value) ? value : [value])
    .map((item) => parseText(item).trim())
    .filter(Boolean)));
}

export function normalizeIsoDate(value) {
  const text = parseText(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/u.test(text) ? text : "";
}

export function createFreebetConversionBatchId() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `conversion-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function normalizeDatabaseData(data = {}) {
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

export function normalizeProcedureStatus(value, fallback = PROCEDURE_STATUS_DONE) {
  const status = parseText(value).trim();
  return PROCEDURE_STATUSES.includes(status) ? status : fallback;
}

export function normalizeUserId(userId) {
  return parseText(userId).trim();
}

export function isUndefinedTableError(error) {
  return error && typeof error === "object" && error.code === "42P01";
}

export const PROCEDURE_DETAIL_SCOPES = new Set([
  "sports",
  "freebet_collection",
  "freebet_conversion",
]);
export const PROCEDURE_DETAIL_ROLES = new Set(["principal", "protecao", "filha"]);

export function normalizeProcedureDetailScope(value) {
  const scope = parseText(value).trim();
  return PROCEDURE_DETAIL_SCOPES.has(scope) ? scope : "sports";
}

export function normalizeProcedureDetailRole(value) {
  const role = parseText(value).trim();
  return PROCEDURE_DETAIL_ROLES.has(role) ? role : "principal";
}

export function normalizeProcedureDetailSide(value) {
  return parseText(value).trim() === "lay" ? "lay" : "back";
}

export function normalizeProcedureResultKey(value, fallback = "principal") {
  const key = parseText(value).trim();

  if (key === "principal" || key === "defeat" || /^protection-\d+$/u.test(key)) {
    return key;
  }

  return fallback;
}

export function normalizeSelectedProcedureResultKey(value) {
  return normalizeProcedureResultKey(value, "");
}

// Parceiro da entrada: id positivo ou null (casa do próprio usuário).
export function normalizeEntryPartnerId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function normalizeProcedureDetailEntries(entries) {
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
      cashbackLossOnly: parseBoolean(
        entry?.cashbackLossOnly ?? entry?.cashback_apenas_perda,
      ),
      freebet: parseBoolean(entry?.freebet ?? entry?.freebet_somente_lucro),
      operationDate: parseText(entry?.operationDate ?? entry?.data_operacao).trim(),
      partnerId: normalizeEntryPartnerId(entry?.partnerId ?? entry?.parceiro_id),
    }))
    .filter((entry) => entry.resultKey !== "defeat");
}

export function calculateProcedureEntryPayout(entry, selectedKeys) {
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

export function normalizeProcedureDetailResults(results) {
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

export function buildProcedureBookmakerBalanceCte() {
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
        AND e.parceiro_id IS NULL
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

export function buildProcedureBookmakerSettlements(details) {
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

    // Bet365 do usuário e Bet365 de um parceiro são bancas diferentes.
    const settlementKey = `${house.toLowerCase()}::${entry.partnerId ?? ""}`;
    const current = settlementsByHouse.get(settlementKey) ?? {
      house,
      partnerId: entry.partnerId,
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

    settlementsByHouse.set(settlementKey, current);
  }

  return [...settlementsByHouse.values()].filter(
    (settlement) =>
      Math.abs(settlement.stake) >= 0.005 || Math.abs(settlement.payout) >= 0.005,
  );
}

export function toDetailInput(entry) {
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
    cashbackLossOnly: parseBoolean(
      entry?.cashback_apenas_perda ?? entry?.cashbackLossOnly,
    ),
    freebet: parseBoolean(entry?.freebet_somente_lucro ?? entry?.freebet),
    operationDate: parseText(entry?.data_operacao ?? entry?.operationDate).trim(),
    partnerId: normalizeEntryPartnerId(entry?.parceiro_id ?? entry?.partnerId),
  };
}

export function toResultInput(result) {
  return {
    scope: parseText(result?.escopo ?? result?.scope),
    resultKey: parseText(result?.resultado_chave ?? result?.resultKey),
  };
}

export function scaleDetailInput(entry, ratio) {
  return {
    ...entry,
    value: Number((parseNumber(entry.value) * ratio).toFixed(2)),
  };
}

export function calculateScopeProfit(entries, results, scope) {
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

export function getProcedureScopeEntries(procedure, scope) {
  return (Array.isArray(procedure?.entradas) ? procedure.entradas : []).filter(
    (entry) => parseText(entry?.escopo ?? entry?.scope) === scope,
  );
}

export function getProcedureScopeResults(procedure, scope) {
  return (Array.isArray(procedure?.resultados) ? procedure.resultados : []).filter(
    (result) => parseText(result?.escopo ?? result?.scope) === scope,
  );
}

export function hasProcedureScopeEntries(procedure, scope) {
  return getProcedureScopeEntries(procedure, scope).length > 0;
}

export function hasProcedureScopeResults(procedure, scope) {
  return getProcedureScopeResults(procedure, scope).length > 0;
}

export function getProcedureScopeDate(procedure, scope, fallback = "") {
  const entryDate = getProcedureScopeEntries(procedure, scope)
    .map((entry) => parseText(entry?.data_operacao ?? entry?.operationDate).trim())
    .find(Boolean);

  return entryDate || parseText(fallback).trim();
}

export function getProcedureScopeProfit(procedure, scope, fallback = 0) {
  if (!hasProcedureScopeResults(procedure, scope)) {
    return parseNumber(fallback);
  }

  return calculateScopeProfit(
    (procedure?.entradas ?? []).map(toDetailInput),
    (procedure?.resultados ?? []).map(toResultInput),
    scope,
  );
}
