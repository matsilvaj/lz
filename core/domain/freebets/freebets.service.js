import {
  FREEBET_CONDITION_CONVERSION_ONLY,
  FREEBET_CONDITION_LOSS_ONLY,
  FREEBET_RESULT_NO,
  FREEBET_STATUS_FINISHED,
} from "../shared/constants.js";
import {
  parseBoolean,
  parseNumber,
  parseText,
  toPlainObject,
} from "../shared/normalizers.js";
import {
  calculateRealProfit,
  resolveProcedureDoubleValue,
} from "../procedimentos/procedimentos.service.js";

function normalizeOperationDateLabel(value) {
  if (value instanceof Date) {
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const year = value.getFullYear();
    return `${day}/${month}/${year}`;
  }

  const text = parseText(value).trim();

  if (!text) {
    return "";
  }

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(text)) {
    return text;
  }

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}/${month}/${year}`;
  }

  return text;
}

function getScopeEntries(freebet, scope) {
  return (Array.isArray(freebet.entradas) ? freebet.entradas : []).filter(
    (entry) => parseText(entry?.escopo) === scope,
  );
}

function getScopeResultKeys(freebet, scope) {
  return (Array.isArray(freebet.resultados) ? freebet.resultados : [])
    .filter((result) => parseText(result?.escopo) === scope)
    .map((result) => parseText(result?.resultado_chave))
    .filter(Boolean);
}

function getScopeDateLabel(freebet, scope, fallback = "") {
  const entryDate = getScopeEntries(freebet, scope)
    .map((entry) => parseText(entry?.data_operacao).trim())
    .find(Boolean);

  return normalizeOperationDateLabel(entryDate || fallback);
}

function formatResultKeyLabel(resultKey) {
  const key = parseText(resultKey);

  if (key === "principal") {
    return "Principal";
  }

  if (key === "defeat") {
    return "Derrota";
  }

  const protectionMatch = key.match(/^protection-(\d+)$/u);
  if (protectionMatch) {
    return `Proteção ${Number(protectionMatch[1]) + 1}`;
  }

  return key || "-";
}

function getScopeResultLabel(freebet, scope) {
  const results = getScopeResultKeys(freebet, scope);

  if (results.length === 0) {
    return "";
  }

  return results.map(formatResultKeyLabel).join(", ");
}

function hasScopeResult(freebet, scope) {
  return getScopeResultKeys(freebet, scope).length > 0;
}

function hasConversionDetails(freebet) {
  if (hasScopeResult(freebet, "freebet_conversion")) {
    return true;
  }

  return getScopeEntries(freebet, "freebet_conversion").some(
    (entry) =>
      parseText(entry?.casa).trim() ||
      parseNumber(entry?.odd) > 0 ||
      parseNumber(entry?.odd_lay) > 0 ||
      parseNumber(entry?.comissao_percentual) > 0 ||
      parseNumber(entry?.aumento_percentual) > 0 ||
      parseNumber(entry?.cashback_percentual) > 0 ||
      parseBoolean(entry?.freebet_somente_lucro),
  );
}

function isCollectionResolved(freebet) {
  return hasScopeResult(freebet, "freebet_collection");
}

function isConversionOnlyFreebet(freebet) {
  return (
    parseText(freebet.condicao_freebet) === FREEBET_CONDITION_CONVERSION_ONLY
  );
}

function didCollectionGenerateFreebet(freebet) {
  const condition = parseText(freebet.condicao_freebet);
  const results = getScopeResultKeys(freebet, "freebet_collection");

  if (results.length === 0) {
    return false;
  }

  if (condition === FREEBET_CONDITION_LOSS_ONLY && results.includes("principal")) {
    return false;
  }

  return true;
}

function didCollectionFinishWithoutFreebet(freebet) {
  return isCollectionResolved(freebet) && !didCollectionGenerateFreebet(freebet);
}

function buildFreebetItem(freebet) {
  const operationDate = normalizeOperationDateLabel(freebet.data_operacao);
  const collectionDate = getScopeDateLabel(
    freebet,
    "freebet_collection",
    freebet.data_operacao,
  );
  const conversionDate = getScopeDateLabel(freebet, "freebet_conversion");
  const house = parseText(freebet.casa_destino_freebet, "Desconhecida") || "Desconhecida";
  const freebetValue = parseNumber(freebet.valor_da_freebet);
  const baseProfit = parseNumber(freebet.lucro_final);
  const hitDouble = parseBoolean(freebet.bateu_duplo);
  const doubleValue = resolveProcedureDoubleValue({
    tipo_procedimento: "Coletar Freebet",
    valor_freebet_coletada: freebet.valor_freebet_coletada,
    valor_da_freebet: freebet.valor_da_freebet,
  });
  const realProfit = calculateRealProfit(baseProfit, hitDouble, doubleValue);
  const collectionResult = getScopeResultLabel(freebet, "freebet_collection");
  const conversionResult = getScopeResultLabel(freebet, "freebet_conversion");
  const conversionOnly = isConversionOnlyFreebet(freebet);
  const legacyGame = parseText(freebet.jogo_time_pa);
  const collectionGame =
    parseText(freebet.jogo_coleta_freebet) ||
    (conversionOnly ? "" : legacyGame);
  const conversionGame =
    parseText(freebet.jogo_conversao_freebet) ||
    (conversionOnly ? legacyGame : "");

  return {
    id: Number(freebet.id),
    data: operationDate,
    data_coleta: collectionDate,
    data_conversao: conversionDate,
    casa: house,
    valor_fb: freebetValue,
    lucro_real: realProfit,
    resultado_coleta: collectionResult || (conversionOnly ? "-" : "Aguardando"),
    resultado_conversao: conversionResult || "Aguardando",
    condicao: parseText(freebet.condicao_freebet),
    procedimento: {
      id: Number(freebet.id),
      tipo_procedimento: parseText(freebet.tipo_procedimento),
      data_operacao: operationDate,
      jogo_time_pa: parseText(freebet.jogo_time_pa),
      jogo_coleta_freebet: collectionGame,
      jogo_conversao_freebet: conversionGame,
      lote_conversao_freebet: parseText(freebet.lote_conversao_freebet),
      casas_envolvidas: parseText(freebet.casas_envolvidas),
      lucro_final: baseProfit,
      lucro_real: realProfit,
      observacao: parseText(freebet.observacao),
      valor_freebet_coletada: parseNumber(freebet.valor_freebet_coletada),
      casa_destino_freebet: house,
      valor_da_freebet: freebetValue,
      condicao_freebet: parseText(freebet.condicao_freebet),
      bateu_duplo: hitDouble,
      status_procedimento: parseText(freebet.status_procedimento),
      entradas: Array.isArray(freebet.entradas) ? freebet.entradas : [],
      resultados: Array.isArray(freebet.resultados) ? freebet.resultados : [],
    },
  };
}

export function groupActiveFreebets(rows) {
  const pendingConfirmation = [];
  const grouped = new Map();

  for (const row of rows ?? []) {
    const freebet = toPlainObject(row);
    const item = buildFreebetItem(freebet);
    const collectionResolved = isCollectionResolved(freebet);
    const generatedFreebet = didCollectionGenerateFreebet(freebet);
    const hasConversion = hasConversionDetails(freebet);
    const conversionResolved = hasScopeResult(freebet, "freebet_conversion");
    const conversionOnly = isConversionOnlyFreebet(freebet);

    if (conversionOnly) {
      if (conversionResolved) {
        continue;
      }

      pendingConfirmation.push({
        ...item,
        fase: "conversao",
        acao: "resultado_conversao",
      });
      continue;
    }

    if (!collectionResolved) {
      pendingConfirmation.push({
        ...item,
        fase: "coleta",
        acao: "resultado_coleta",
      });
      continue;
    }

    if (!generatedFreebet) {
      continue;
    }

    if (hasConversion && !conversionResolved) {
      pendingConfirmation.push({
        ...item,
        fase: "conversao",
        acao: "resultado_conversao",
      });
      continue;
    }

    if (hasConversion) {
      continue;
    }

    if (!grouped.has(item.casa)) {
      grouped.set(item.casa, {
        data: item.data,
        casa: item.casa,
        ids: [],
        itens: [],
        quantidade: 0,
        valor_total: 0,
        lucro_total: 0,
      });
    }

    const current = grouped.get(item.casa);
    if (!current.data && item.data_coleta) {
      current.data = item.data_coleta;
    }
    current.ids.push(item.id);
    current.itens.push(item);
    current.quantidade += 1;
    current.valor_total += item.valor_fb;
    current.lucro_total += item.lucro_real;
  }

  return {
    pendentes_confirmacao: pendingConfirmation,
    agrupadas_convertiveis: [...grouped.values()],
  };
}

export function buildConvertedFreebetsHistory(rows) {
  return (rows ?? []).map((row) => {
    const item = toPlainObject(row);
    const procedure = toPlainObject(item.procedimento);
    const editableProcedure =
      Object.keys(procedure).length > 0 ? buildFreebetItem(procedure).procedimento : null;
    const collectionDate = parseText(item.data_coleta);
    const conversionDate = parseText(item.data_conversao);
    const conversionOnly =
      parseText(item.condicao_freebet ?? procedure.condicao_freebet) ===
      FREEBET_CONDITION_CONVERSION_ONLY;
    const house = parseText(item.casa, "Desconhecida") || "Desconhecida";
    const freebetValue = parseNumber(item.valor_freebet);
    const collectionDoubleValue = resolveProcedureDoubleValue({
      tipo_procedimento: "Coletar Freebet",
      valor_freebet_coletada: item.valor_duplo_coleta,
      valor_da_freebet: item.valor_freebet,
    });
    const collectionProfit = conversionOnly
      ? 0
      : calculateRealProfit(
          item.lucro_base_coleta,
          item.bateu_duplo_coleta,
          collectionDoubleValue,
        );
    const hasConversion = conversionDate !== "" && conversionDate !== "None";
    const conversionProfit = hasConversion
      ? calculateRealProfit(
          item.lucro_base_conversao,
          item.bateu_duplo_conversao,
          item.valor_duplo_conversao,
        )
      : null;
    const totalProfit = collectionProfit + (conversionProfit ?? 0);
    const status = parseText(item.status_freebet);
    const result = parseText(item.ganhou_freebet);

    let dateText = `${collectionDate || "-"} -> -`;
    if (hasConversion) {
      dateText = `${collectionDate || "-"} -> ${conversionDate}`;
    } else if (status === FREEBET_STATUS_FINISHED && result === FREEBET_RESULT_NO) {
      dateText = `${collectionDate || "-"} -> ${FREEBET_RESULT_NO} ganhou`;
    }

    return {
      procedimento_id: parseNumber(
        item.procedimento_id ?? editableProcedure?.id ?? procedure.id ?? item.id,
      ),
      texto_data: dateText,
      data_coleta: collectionDate,
      data_conversao: hasConversion ? conversionDate : null,
      casa: house,
      valor_freebet: freebetValue,
      lucro_coleta: collectionProfit,
      lucro_conversao: conversionProfit,
      lucro_total: totalProfit,
      status_freebet: status,
      ganhou_freebet: result,
      tem_conversao: hasConversion,
      procedimento: editableProcedure,
    };
  });
}

export function collectionFinishedWithoutFreebet(freebet) {
  return didCollectionFinishWithoutFreebet(toPlainObject(freebet));
}
