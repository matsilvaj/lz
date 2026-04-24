import {
  FREEBET_STATUS_NA,
  FREEBET_STATUS_PENDING,
} from "../shared/constants.js";
import {
  formatOperationDate,
  formatReferenceMonth,
  normalizeHouses,
  parseBoolean,
  parseNumber,
  parseText,
} from "../shared/normalizers.js";

export function calculateRealProfit(baseProfit, hitDouble = false, doubleValue = 0) {
  const base = parseNumber(baseProfit);
  const doubleProfit = parseNumber(doubleValue);
  return base + (parseBoolean(hitDouble) ? doubleProfit : 0);
}

export function calculateProcedureBaseProfit(
  procedureType,
  entryValue,
  protections = [],
  equalProfit = true,
) {
  const entry = parseNumber(entryValue);

  if (procedureType === "Cassino") {
    return entry;
  }

  if (equalProfit) {
    return entry;
  }

  let sum = entry;
  let count = 1;

  for (const protection of protections ?? []) {
    const text = parseText(protection).trim();
    if (!text) {
      continue;
    }

    sum += parseNumber(protection);
    count += 1;
  }

  return count > 0 ? sum / count : 0;
}

export function buildProcedureData({
  procedureType,
  entryValue,
  game = "",
  houses = "",
  freebetCollectedValue = 0,
  freebetValue = 0,
  freebetCondition = "",
  note = "",
  freebetHouse = "",
  hitDouble = false,
  equalProfit = true,
  protections = [],
  operationDate = null,
  referenceMonth = null,
  freebetStatus = null,
  freebetResult = "",
  freebetOriginId = null,
}) {
  const baseProfit = calculateProcedureBaseProfit(
    procedureType,
    entryValue,
    protections,
    equalProfit,
  );

  let normalizedHouses = normalizeHouses(houses);
  const normalizedFreebetHouse = parseText(freebetHouse).trim();

  if (
    ["Coletar Freebet", "Converter Freebet"].includes(procedureType) &&
    !normalizedHouses &&
    normalizedFreebetHouse
  ) {
    normalizedHouses = normalizedFreebetHouse;
  }

  return {
    data_operacao: formatOperationDate(operationDate),
    tipo_procedimento: procedureType,
    casas_envolvidas: normalizedHouses,
    jogo_time_pa: procedureType === "Cassino" ? "-" : parseText(game),
    lucro_final: baseProfit,
    bateu_duplo: parseBoolean(hitDouble),
    condicao_freebet: parseText(freebetCondition),
    valor_freebet_coletada: parseNumber(freebetCollectedValue),
    observacao: parseText(note),
    mes_referencia: formatReferenceMonth(referenceMonth),
    casa_destino_freebet:
      ["Coletar Freebet", "Converter Freebet"].includes(procedureType)
        ? normalizedFreebetHouse
        : "",
    status_freebet:
      freebetStatus ??
      (procedureType === "Coletar Freebet" ? FREEBET_STATUS_PENDING : FREEBET_STATUS_NA),
    id_freebet_origem: freebetOriginId,
    valor_da_freebet: parseNumber(freebetValue),
    ganhou_freebet: parseText(freebetResult),
  };
}

export function suggestProcedureFromCalculator({
  baseProfit,
  useDouble = false,
  doubleValue = 0,
  freebetHouse = "",
}) {
  const normalizedHouse = parseText(freebetHouse).trim();
  const procedureType = normalizedHouse
    ? "Converter Freebet"
    : useDouble
      ? "Tentativa de Duplo"
      : "SureBet";

  return {
    tipo: procedureType,
    jogo: "",
    casas: normalizedHouse || "Nenhuma selecionada",
    lucro_base: Number(parseNumber(baseProfit).toFixed(2)),
    v_duplo: Number((useDouble ? parseNumber(doubleValue) : 0).toFixed(2)),
    obs: "",
    condicao: "",
    casa_fb: normalizedHouse,
  };
}

export function enrichProcedure(row) {
  const procedure = { ...toProcedureObject(row) };
  procedure.bateu_duplo = parseBoolean(procedure.bateu_duplo);
  procedure.lucro_real = calculateRealProfit(
    procedure.lucro_final,
    procedure.bateu_duplo,
    procedure.valor_freebet_coletada,
  );
  return procedure;
}

export function filterProcedures(procedures, searchText = "", types = [], houses = []) {
  const normalizedSearch = parseText(searchText).trim().toLowerCase();
  const typeSet = new Set(types ?? []);
  const selectedHouses = Array.from(houses ?? []);

  return (procedures ?? [])
    .map((item) => enrichProcedure(item))
    .filter((procedure) => {
      const game = parseText(procedure.jogo_time_pa).toLowerCase();
      const involvedHouses = parseText(procedure.casas_envolvidas);
      const involvedHousesLower = involvedHouses.toLowerCase();
      const type = parseText(procedure.tipo_procedimento);

      if (
        normalizedSearch &&
        !game.includes(normalizedSearch) &&
        !involvedHousesLower.includes(normalizedSearch)
      ) {
        return false;
      }

      if (typeSet.size > 0 && !typeSet.has(type)) {
        return false;
      }

      if (
        selectedHouses.length > 0 &&
        !selectedHouses.some((house) => involvedHouses.includes(house))
      ) {
        return false;
      }

      return true;
    });
}

export function rankBookmakersByUsage(allBookmakers, historyRows) {
  const frequency = Object.fromEntries((allBookmakers ?? []).map((bookmaker) => [bookmaker, 0]));

  for (const row of historyRows ?? []) {
    const procedure = toProcedureObject(row);
    const involvedHouses = parseText(procedure.casas_envolvidas);
    const freebetHouse = parseText(procedure.casa_destino_freebet);

    if (involvedHouses) {
      for (const house of involvedHouses.split(" | ")) {
        if (Object.hasOwn(frequency, house)) {
          frequency[house] += 1;
        }
      }
    }

    if (freebetHouse && Object.hasOwn(frequency, freebetHouse)) {
      frequency[freebetHouse] += 1;
    }
  }

  const ranked = [...(allBookmakers ?? [])].sort(
    (left, right) => (frequency[right] ?? 0) - (frequency[left] ?? 0),
  );

  return {
    frequencia: frequency,
    mais_usadas: ranked.slice(0, 9),
    todas: ranked.slice(9).sort((left, right) => left.localeCompare(right)),
  };
}

function toProcedureObject(row) {
  return row && typeof row === "object" ? { ...row } : {};
}
