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

// O cashback tem dois regimes. O padrao e a casa pagar a promocao em qualquer
// resultado, e nesse caso o credito vale em todos os cenarios. Marcada a opcao
// "apenas se perder", a casa so paga quando aquela aposta perde: o credito sai
// da divisao dos stakes e entra apenas nos cenarios das outras casas. Ausencia
// do campo cai no padrao, entao parseBoolean ja resolve.
export function normalizeSurebetLine(line) {
  return {
    cashback_apenas_perda: parseBoolean(
      line?.cashback_apenas_perda ?? line?.cashbackLossOnly,
    ),
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

export const MAX_SUREBET_CHILD_LINES = 5;

function buildLineMath(line) {
  const effectiveOdd = 1 + (line.odd - 1) * (1 + line.aumento_percentual / 100);

  // Mesmo modelo do calculateSurebet: M sem cashback; bGarantido só quando a casa paga em qualquer resultado.
  if (line.tipo === "L") {
    const cashbackCredit = (effectiveOdd - 1) * (line.cashback_percentual / 100);

    return {
      ...line,
      odd_efetiva: effectiveOdd,
      M: effectiveOdd - 1 + (1 - line.comissao_percentual / 100),
      k: effectiveOdd - 1,
      b: cashbackCredit,
      bGarantido: line.cashback_apenas_perda ? 0 : cashbackCredit,
    };
  }

  if (line.freebet) {
    return {
      ...line,
      odd_efetiva: effectiveOdd,
      M: (effectiveOdd - 1) * (1 - line.comissao_percentual / 100),
      k: 0,
      b: 0,
      bGarantido: 0,
    };
  }

  const cashbackCredit = line.cashback_percentual / 100;

  return {
    ...line,
    odd_efetiva: effectiveOdd,
    M: 1 + (effectiveOdd - 1) * (1 - line.comissao_percentual / 100),
    k: 1,
    b: cashbackCredit,
    bGarantido: line.cashback_apenas_perda ? 0 : cashbackCredit,
  };
}

function buildMemberResult(calculation, rawStake, finalStake) {
  const responsibility =
    calculation.tipo === "L" ? roundTo(rawStake * calculation.k) : 0;
  const cost =
    calculation.tipo === "L" ? responsibility : finalStake * calculation.k;
  const cashback =
    (calculation.tipo === "L" ? rawStake : finalStake) * calculation.b;
  const winCashback = calculation.cashback_apenas_perda ? 0 : cashback;
  const grossReturn =
    (calculation.tipo === "L" ? rawStake : finalStake) * calculation.M -
    (cashback - winCashback);

  return {
    odd: calculation.odd,
    odd_efetiva: calculation.odd_efetiva,
    tipo: calculation.tipo,
    stake: finalStake,
    responsabilidade: responsibility,
    retorno_bruto: grossReturn,
    custo: cost,
    cashback,
    cashback_no_cenario: winCashback,
    freebet: calculation.freebet,
    aumento_percentual: calculation.aumento_percentual,
    comissao_percentual: calculation.comissao_percentual,
    cashback_percentual: calculation.cashback_percentual,
    cashback_apenas_perda: calculation.cashback_apenas_perda,
    math: {
      M: calculation.M,
      k: calculation.k,
      b: calculation.b,
      bGarantido: calculation.bGarantido,
    },
  };
}

function hasChildLines(lines) {
  return lines.some((line) => Array.isArray(line?.filhas) && line.filhas.length > 0);
}

export function normalizeProfitTarget(target) {
  const mode = parseText(target?.modo).trim();
  const value = parseNumber(target?.valor);

  if (mode === "zerar") {
    return { modo: "zerar", valor: 0 };
  }

  if (mode === "valor" || mode === "percentual") {
    return { modo: mode, valor: value };
  }

  return { modo: "normal", valor: 0 };
}

function hasProfitTargets(lines) {
  return lines.some((line) => normalizeProfitTarget(line?.lucro_alvo).modo !== "normal");
}

// Lucro de cada resultado = alpha + beta * P, onde P é o lucro das casas em "normal".
function getProfitCoefficients(target) {
  if (target.modo === "zerar") {
    return { alpha: 0, beta: 0 };
  }

  if (target.modo === "valor") {
    return { alpha: target.valor, beta: 0 };
  }

  if (target.modo === "percentual") {
    return { alpha: 0, beta: target.valor / 100 };
  }

  return { alpha: 0, beta: 1 };
}

// Resolve I (investimento efetivo) e P com: retorno da base = I + lucro da base, e
// I = custos travados + soma dos custos das linhas livres (lineares no retorno de cada grupo).
function solveGroupStakes(groups, targets, baseIndex) {
  const stakes = groups.map((group) => group.map((member) => Math.max(member.stake, 0)));
  const netCostFactor = (member) => member.k - member.bGarantido;
  const baseReturn = groups[baseIndex].reduce(
    (total, member, index) => total + stakes[baseIndex][index] * member.M,
    0,
  );
  let fixedCost = 0;
  let freeWeight = 0;
  let constantTerm = 0;
  let profitTerm = 0;
  const freeGroups = [];

  groups.forEach((group, groupIndex) => {
    const freeIndexes =
      groupIndex === baseIndex
        ? []
        : group
            .map((member, index) => (stakes[groupIndex][index] <= 0 && member.M > 0 ? index : -1))
            .filter((index) => index >= 0);
    const lockedReturn = group.reduce(
      (total, member, index) => total + stakes[groupIndex][index] * member.M,
      0,
    );

    fixedCost += group.reduce(
      (total, member, index) => total + stakes[groupIndex][index] * netCostFactor(member),
      0,
    );

    if (freeIndexes.length === 0) {
      return;
    }

    const weight = freeIndexes.reduce(
      (total, index) =>
        total + netCostFactor(group[index]) / group[index].M / freeIndexes.length,
      0,
    );
    const { alpha, beta } = getProfitCoefficients(targets[groupIndex]);

    freeWeight += weight;
    constantTerm += weight * (alpha - lockedReturn);
    profitTerm += weight * beta;
    freeGroups.push({ groupIndex, freeIndexes, lockedReturn, alpha, beta });
  });

  const base = getProfitCoefficients(targets[baseIndex]);
  const remainingWeight = 1 - freeWeight;
  const denominator = base.beta * remainingWeight + profitTerm;
  let profit = 0;
  let investment;

  if (Math.abs(denominator) > 1e-9) {
    profit =
      ((baseReturn - base.alpha) * remainingWeight - (fixedCost + constantTerm)) /
      denominator;
    investment = baseReturn - base.alpha - base.beta * profit;
  } else {
    investment =
      Math.abs(remainingWeight) > 1e-9
        ? (fixedCost + constantTerm) / remainingWeight
        : baseReturn - base.alpha;
  }

  for (const { groupIndex, freeIndexes, lockedReturn, alpha, beta } of freeGroups) {
    const groupReturn = investment + alpha + beta * profit;
    const share = Math.max(groupReturn - lockedReturn, 0) / freeIndexes.length;

    for (const index of freeIndexes) {
      stakes[groupIndex][index] = share / groups[groupIndex][index].M;
    }
  }

  return stakes;
}

// Cada linha mãe e suas filhas cobrem o mesmo resultado: o retorno do grupo é a soma.
// Na casa base todas as stakes são digitadas; nas demais, stake 0 significa linha livre.
function calculateSurebetWithChildren(lines, baseIndex) {
  const groups = lines.map((line) => [
    normalizeSurebetLine(line),
    ...(Array.isArray(line?.filhas) ? line.filhas : [])
      .slice(0, MAX_SUREBET_CHILD_LINES)
      .map(normalizeSurebetLine),
  ].map(buildLineMath));
  const safeBaseIndex = baseIndex >= 0 && baseIndex < groups.length ? baseIndex : 0;
  const baseGroup = groups[safeBaseIndex];

  if (baseGroup[0].stake <= 0) {
    throw new Error("Informe um stake base válido para calcular a surebet.");
  }

  const groupStakes = solveGroupStakes(
    groups,
    lines.map((line) => normalizeProfitTarget(line?.lucro_alvo)),
    safeBaseIndex,
  );

  let totalCost = 0;
  let totalCashback = 0;
  const groupResults = groups.map((group, groupIndex) => {
    const members = group.map((member, memberIndex) => {
      const rawStake = groupStakes[groupIndex][memberIndex];
      const finalStake =
        groupIndex === safeBaseIndex ? rawStake : roundTo(rawStake);
      const result = buildMemberResult(member, rawStake, finalStake);

      totalCost += result.custo;
      totalCashback += result.cashback;
      return result;
    });

    return members;
  });

  const effectiveInvestment = totalCost - totalCashback;
  const resultLines = groupResults.map(([mother, ...children]) => {
    const members = [mother, ...children];
    const groupReturn = members.reduce((total, member) => total + member.retorno_bruto, 0);
    const groupCost = members.reduce((total, member) => total + member.custo, 0);
    const groupCashback = members.reduce((total, member) => total + member.cashback, 0);

    return {
      ...mother,
      retorno_grupo: groupReturn,
      custo_grupo: groupCost,
      cashback_grupo: groupCashback,
      lucro_liquido: groupReturn - effectiveInvestment,
      filhas: children,
    };
  });
  const validLines = resultLines.filter((line) => line.math.M > 0);
  const netProfits = resultLines.map((line) => line.lucro_liquido);
  const referenceProfit = netProfits.length ? Math.min(...netProfits) : 0;

  return {
    modelo: SUREBET_MODEL_DEFAULT,
    indice_base: safeBaseIndex,
    investimento_efetivo: effectiveInvestment,
    retorno_referencia: resultLines.length
      ? Math.min(...resultLines.map((line) => line.retorno_grupo))
      : 0,
    lucro_liquido: referenceProfit,
    lucro_percentual:
      effectiveInvestment > 0 ? (referenceProfit / effectiveInvestment) * 100 : 0,
    media_lucros: validLines.length
      ? validLines.reduce((total, line) => total + line.lucro_liquido, 0) / validLines.length
      : 0,
    duplo_calculado_final: validLines.length
      ? validLines.reduce((total, line) => total + line.retorno_grupo, 0) / validLines.length
      : 0,
    linhas: resultLines,
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

  if (
    !String(model).includes(SUREBET_MODEL_ZERO_ZERO) &&
    (hasChildLines(lines) || hasProfitTargets(lines))
  ) {
    return calculateSurebetWithChildren(lines, baseIndex);
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

    // `M` e o retorno bruto por unidade de stake e e o que iguala os cenarios
    // na hora de dividir os stakes. O cashback fica fora dele: quando a
    // promocao so vale na derrota, ela nao pode financiar o cenario em que a
    // propria casa ganha — esse cenario tem que fechar como se o cashback nao
    // existisse, e o credito aparece inteiro nos cenarios das outras casas.
    // `b` guarda o cashback para o calculo do valor recebido, e `bGarantido`
    // so e diferente de zero quando a casa paga em qualquer resultado, unico
    // caso em que o credito pode entrar no rateio.
    if (line.tipo === "L") {
      const cashbackCredit = (effectiveOdd - 1) * (line.cashback_percentual / 100);

      return {
        ...line,
        odd_efetiva: effectiveOdd,
        M: effectiveOdd - 1 + (1 - line.comissao_percentual / 100),
        k: effectiveOdd - 1,
        b: cashbackCredit,
        bGarantido: line.cashback_apenas_perda ? 0 : cashbackCredit,
      };
    }

    if (line.freebet) {
      return {
        ...line,
        odd_efetiva: effectiveOdd,
        M: (effectiveOdd - 1) * (1 - line.comissao_percentual / 100),
        k: 0,
        b: 0,
        bGarantido: 0,
      };
    }

    const cashbackCredit = line.cashback_percentual / 100;

    return {
      ...line,
      odd_efetiva: effectiveOdd,
      M: 1 + (effectiveOdd - 1) * (1 - line.comissao_percentual / 100),
      k: 1,
      b: cashbackCredit,
      bGarantido: line.cashback_apenas_perda ? 0 : cashbackCredit,
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
        sumW += (current.k - current.bGarantido) / current.M;
      }
    }

    if (safeBaseIndex === 0) {
      const first = calculations[0];
      const numerator = baseStake * (first.M - (first.k - first.bGarantido));
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
      const denominator = first.M - (first.k - first.bGarantido);
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
    // Cashback creditado no cenario em que esta propria linha ganha: zero
    // quando a casa so paga na derrota.
    const winCashback = calculation.cashback_apenas_perda ? 0 : cashback;
    // O total de cashback entra no investimento efetivo de todos os cenarios,
    // entao a linha que nao recebe o proprio credito devolve ele aqui.
    const grossReturn =
      (calculation.tipo === "L" ? rawStake : finalStake) * calculation.M -
      (cashback - winCashback);

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
      cashback_no_cenario: winCashback,
      freebet: calculation.freebet,
      aumento_percentual: calculation.aumento_percentual,
      comissao_percentual: calculation.comissao_percentual,
      cashback_percentual: calculation.cashback_percentual,
      cashback_apenas_perda: calculation.cashback_apenas_perda,
      math: {
        M: calculation.M,
        k: calculation.k,
        b: calculation.b,
        bGarantido: calculation.bGarantido,
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
