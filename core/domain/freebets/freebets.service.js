import {
  FREEBET_RESULT_NO,
  FREEBET_RESULT_YES,
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

export function groupActiveFreebets(rows) {
  const pendingConfirmation = [];
  const grouped = new Map();

  for (const row of rows ?? []) {
    const freebet = toPlainObject(row);
    const procedureId = Number(freebet.id);
    const operationDate = normalizeOperationDateLabel(freebet.data_operacao);
    const house = parseText(freebet.casa_destino_freebet, "Desconhecida") || "Desconhecida";
    const freebetValue = parseNumber(freebet.valor_da_freebet);
    const baseProfit = parseNumber(freebet.lucro_final);
    const hitDouble = parseBoolean(freebet.bateu_duplo);
    const doubleValue = resolveProcedureDoubleValue({
      tipo_procedimento: "Coletar Freebet",
      valor_freebet_coletada: freebet.valor_freebet_coletada,
      valor_da_freebet: freebet.valor_da_freebet,
    });
    const condition = parseText(freebet.condicao_freebet);
    const result = parseText(freebet.ganhou_freebet);
    const realProfit = calculateRealProfit(baseProfit, hitDouble, doubleValue);

    if (
      condition === "Apenas se perder a aposta" &&
      ![FREEBET_RESULT_YES, FREEBET_RESULT_NO].includes(result)
    ) {
      pendingConfirmation.push({
        id: procedureId,
        data: operationDate,
        casa: house,
        valor_fb: freebetValue,
        lucro_real: realProfit,
        ganhou: result,
      });
      continue;
    }

    if (!grouped.has(house)) {
      grouped.set(house, {
        data: operationDate,
        casa: house,
        ids: [],
        quantidade: 0,
        valor_total: 0,
        lucro_total: 0,
      });
    }

    const current = grouped.get(house);
    if (!current.data && operationDate) {
      current.data = operationDate;
    }
    current.ids.push(procedureId);
    current.quantidade += 1;
    current.valor_total += freebetValue;
    current.lucro_total += realProfit;
  }

  return {
    pendentes_confirmacao: pendingConfirmation,
    agrupadas_convertiveis: [...grouped.values()],
  };
}

export function buildConvertedFreebetsHistory(rows) {
  return (rows ?? []).map((row) => {
    const item = toPlainObject(row);
    const collectionDate = parseText(item.data_coleta);
    const conversionDate = parseText(item.data_conversao);
    const house = parseText(item.casa, "Desconhecida") || "Desconhecida";
    const freebetValue = parseNumber(item.valor_freebet);
    const collectionDoubleValue = resolveProcedureDoubleValue({
      tipo_procedimento: "Coletar Freebet",
      valor_freebet_coletada: item.valor_duplo_coleta,
      valor_da_freebet: item.valor_freebet,
    });
    const collectionProfit = calculateRealProfit(
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

    let dateText = `${collectionDate} -> -`;
    if (hasConversion) {
      dateText = `${collectionDate} -> ${conversionDate}`;
    } else if (status === FREEBET_STATUS_FINISHED && result === FREEBET_RESULT_NO) {
      dateText = `${collectionDate} -> ${FREEBET_RESULT_NO} ganhou`;
    }

    return {
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
    };
  });
}
