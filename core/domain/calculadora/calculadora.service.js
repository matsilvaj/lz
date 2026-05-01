import {
  SUREBET_MODEL_DEFAULT,
  SUREBET_MODEL_ZERO_ZERO,
} from "../shared/constants.js";
import {
  parseBoolean,
  parseNumber,
  parseText,
  roundTo,
} from "../shared/normalizers.js";

export function normalizeSurebetLine(line) {
  return {
    odd: parseNumber(line?.odd),
    stake: parseNumber(line?.stake),
    responsabilidade: parseNumber(
      line?.responsabilidade ?? line?.resp ?? line?.inp_resp ?? 0,
    ),
    tipo: parseText(line?.tipo ?? "B").toUpperCase().startsWith("L") ? "L" : "B",
    aumento_percentual: parseNumber(line?.aumento_percentual ?? line?.aum),
    comissao_percentual: parseNumber(line?.comissao_percentual ?? line?.com),
    cashback_percentual: parseNumber(line?.cashback_percentual ?? line?.cash),
    freebet: parseBoolean(line?.freebet_somente_lucro ?? line?.freebet),
  };
}

export function syncSurebetLineFields(line, source) {
  const normalized = normalizeSurebetLine(line);
  const odd = normalized.odd;

  if (normalized.tipo === "B") {
    normalized.responsabilidade = 0;
    return normalized;
  }

  if (odd <= 1) {
    return normalized;
  }

  if (["stake", "odd"].includes(source) && normalized.stake) {
    normalized.responsabilidade = roundTo(normalized.stake * (odd - 1));
  } else if (
    ["resp", "responsabilidade"].includes(source) &&
    normalized.responsabilidade
  ) {
    normalized.stake = roundTo(normalized.responsabilidade / (odd - 1));
  }

  return normalized;
}

export function calculateWeightedAverage(bets) {
  let weightedSum = 0;
  let totalValue = 0;

  for (const bet of bets ?? []) {
    const value = parseNumber(Array.isArray(bet) ? bet[0] : bet?.valor);
    const odd = parseNumber(Array.isArray(bet) ? bet[1] : bet?.odd);
    weightedSum += value * odd;
    totalValue += value;
  }

  return {
    odd_media: totalValue > 0 ? weightedSum / totalValue : 0,
    volume_total: totalValue,
    soma_produtos: weightedSum,
  };
}

export function calculateSurebet(
  lines,
  baseIndex = 0,
  model = SUREBET_MODEL_DEFAULT,
) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new Error("Informe ao menos uma linha para calcular a surebet.");
  }

  const normalizedLines = lines.map(normalizeSurebetLine);
  const safeBaseIndex =
    baseIndex >= 0 && baseIndex < normalizedLines.length ? baseIndex : 0;
  const baseStake = parseNumber(normalizedLines[safeBaseIndex].stake);

  if (baseStake <= 0) {
    throw new Error("Informe um stake base válido para calcular a surebet.");
  }

  const calculations = normalizedLines.map((line) => {
    const effectiveOdd =
      1 + (line.odd - 1) * (1 + line.aumento_percentual / 100);

    if (line.tipo === "L") {
      return {
        ...line,
        odd_efetiva: effectiveOdd,
        M:
          effectiveOdd -
          1 +
          (1 - line.comissao_percentual / 100) -
          (effectiveOdd - 1) * (line.cashback_percentual / 100),
        k: effectiveOdd - 1,
        b: (effectiveOdd - 1) * (line.cashback_percentual / 100),
      };
    }

    if (line.freebet) {
      return {
        ...line,
        odd_efetiva: effectiveOdd,
        M: (effectiveOdd - 1) * (1 - line.comissao_percentual / 100),
        k: 0,
        b: 0,
      };
    }

    return {
      ...line,
      odd_efetiva: effectiveOdd,
      M:
        1 +
        (effectiveOdd - 1) * (1 - line.comissao_percentual / 100) -
        line.cashback_percentual / 100,
      k: 1,
      b: line.cashback_percentual / 100,
    };
  });

  const stakes = calculations.map((calculation, index) =>
    index === safeBaseIndex || calculation.stake > 0 ? calculation.stake : 0,
  );

  if (String(model).includes(SUREBET_MODEL_ZERO_ZERO)) {
    let sumW = 0;

    for (let index = 1; index < calculations.length; index += 1) {
      const current = calculations[index];
      if (current.M > 0) {
        sumW += (current.k - current.b) / current.M;
      }
    }

    if (safeBaseIndex === 0) {
      const first = calculations[0];
      const numerator = baseStake * (first.M - (first.k - first.b));
      const otherNetReturn = sumW > 0 ? numerator / sumW : 0;

      for (let index = 1; index < calculations.length; index += 1) {
        if (calculations[index].M > 0 && stakes[index] <= 0) {
          stakes[index] = otherNetReturn / calculations[index].M;
        }
      }
    } else {
      const otherNetReturn = baseStake * calculations[safeBaseIndex].M;

      for (let index = 1; index < calculations.length; index += 1) {
        if (
          index !== safeBaseIndex &&
          calculations[index].M > 0 &&
          stakes[index] <= 0
        ) {
          stakes[index] = otherNetReturn / calculations[index].M;
        }
      }

      const first = calculations[0];
      const numerator = otherNetReturn * sumW;
      const denominator = first.M - (first.k - first.b);
      stakes[0] = denominator !== 0 ? numerator / denominator : 0;
    }
  } else {
    const targetNetReturn = baseStake * calculations[safeBaseIndex].M;

    calculations.forEach((calculation, index) => {
      if (index !== safeBaseIndex && calculation.M > 0 && stakes[index] <= 0) {
        stakes[index] = targetNetReturn / calculation.M;
      }
    });
  }

  let totalCost = 0;
  let totalCashback = 0;
  const grossReturns = [];
  const monetaryReturns = [];
  const resultLines = [];

  calculations.forEach((calculation, index) => {
    const rawStake = index === safeBaseIndex ? baseStake : stakes[index];
    const finalStake =
      index === safeBaseIndex ? baseStake : roundTo(stakes[index]);

    const responsibility =
      calculation.tipo === "L"
        ? roundTo(rawStake * calculation.k)
        : 0;

    const cost = calculation.tipo === "L" ? responsibility : finalStake * calculation.k;
    const cashback =
      (calculation.tipo === "L" ? rawStake : finalStake) * calculation.b;
    const grossReturn =
      calculation.tipo === "L" ? rawStake * calculation.M : finalStake * calculation.M;

    totalCost += cost;
    totalCashback += cashback;
    grossReturns.push(grossReturn);
    monetaryReturns.push(grossReturn);

    resultLines.push({
      odd: calculation.odd,
      odd_efetiva: calculation.odd_efetiva,
      tipo: calculation.tipo,
      stake: finalStake,
      responsabilidade: responsibility,
      retorno_bruto: grossReturn,
      custo: cost,
      cashback,
      freebet: calculation.freebet,
      aumento_percentual: calculation.aumento_percentual,
      comissao_percentual: calculation.comissao_percentual,
      cashback_percentual: calculation.cashback_percentual,
      math: {
        M: calculation.M,
        k: calculation.k,
        b: calculation.b,
      },
    });
  });

  const effectiveInvestment = totalCost - totalCashback;
  const netProfits = grossReturns.map((value) => value - effectiveInvestment);

  resultLines.forEach((line, index) => {
    line.lucro_liquido = netProfits[index];
  });

  const validNetProfits = netProfits.filter(
    (_, index) => resultLines[index].math.M > 0,
  );
  const validReturns = monetaryReturns.filter(
    (_, index) => resultLines[index].math.M > 0,
  );

  const averageNetProfit =
    validNetProfits.length > 0
      ? validNetProfits.reduce((sum, value) => sum + value, 0) /
        validNetProfits.length
      : 0;

  const doubleGreenValue =
    validReturns.length > 0
      ? validReturns.reduce((sum, value) => sum + value, 0) / validReturns.length
      : 0;

  const referenceProfit =
    netProfits.length === 0
      ? 0
      : String(model).includes(SUREBET_MODEL_ZERO_ZERO)
        ? netProfits[1] ?? 0
        : Math.min(...netProfits);

  const referenceReturn =
    monetaryReturns.length === 0
      ? 0
      : String(model).includes(SUREBET_MODEL_ZERO_ZERO)
        ? monetaryReturns[1] ?? 0
        : Math.min(...monetaryReturns);

  return {
    modelo: model,
    indice_base: safeBaseIndex,
    investimento_efetivo: effectiveInvestment,
    retorno_referencia: referenceReturn,
    lucro_liquido: referenceProfit,
    lucro_percentual:
      effectiveInvestment > 0 ? (referenceProfit / effectiveInvestment) * 100 : 0,
    media_lucros: averageNetProfit,
    duplo_calculado_final: doubleGreenValue,
    linhas: resultLines,
  };
}
