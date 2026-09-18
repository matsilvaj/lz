import { calculateSurebet } from "@/core";

import { calculateAdjustedOdd } from "@/core/domain/shared/odds.js";

import {
  type BetSide,
  type SportResultSelection,
  normalizeCurrencyAmount,
  parseDecimalInput,
} from "./procedure-form-utils";

function calculateLayReturn(
  responsibility: number,
  effectiveOdd: number,
  commission: number,
  cashback: number,
  cashbackLossOnly: boolean,
) {
  if (responsibility <= 0 || effectiveOdd <= 1) {
    return 0;
  }

  const layStake = responsibility / (effectiveOdd - 1);
  const commissionMultiplier = 1 - commission / 100;
  // Cashback pago so na derrota nao existe no cenario em que o lay ganha.
  const cashbackRate = cashbackLossOnly ? 0 : cashback / 100;

  return (
    layStake *
    (effectiveOdd - 1 + commissionMultiplier + (effectiveOdd - 1) * cashbackRate)
  );
}

export function calculateSportsProfit(
  entries: Array<{
    resultId: SportResultSelection;
    stakeInput: string;
    oddInput: string;
    side: BetSide;
    layOddInput?: string;
    commissionInput?: string;
    increaseInput?: string;
    cashbackInput?: string;
    cashbackLossOnly?: boolean;
    freebet?: boolean;
  }>,
  selectedResults: SportResultSelection[],
) {
  const normalizedEntries = entries.map((entry) => {
    const side = entry.side === "lay" ? "lay" : "back";
    const riskValue = parseDecimalInput(entry.stakeInput);
    const layOddInput = entry.layOddInput ?? "";
    const odd =
      side === "lay"
        ? parseDecimalInput(layOddInput.trim() ? layOddInput : entry.oddInput)
        : parseDecimalInput(entry.oddInput);
    const increase = parseDecimalInput(entry.increaseInput ?? "");
    const cashback = parseDecimalInput(entry.cashbackInput ?? "");
    const effectiveOdd = calculateAdjustedOdd(odd, increase);
    const stake =
      side === "lay" && effectiveOdd > 1
        ? riskValue / (effectiveOdd - 1)
        : riskValue;

    return {
      ...entry,
      side,
      stake,
      responsibility: side === "lay" ? riskValue : 0,
      odd,
      effectiveOdd,
      commission: parseDecimalInput(entry.commissionInput ?? ""),
      increase,
      cashback,
      cashbackLossOnly: Boolean(entry.cashbackLossOnly),
      freebet: Boolean(entry.freebet),
    };
  });
  
  const baseIndex = normalizedEntries.findIndex((entry) => entry.stake > 0);
  const fallbackInvestment = normalizedEntries.reduce(
    (sum, entry) =>
      sum +
      (entry.side === "lay" ? entry.responsibility : entry.freebet ? 0 : entry.stake),
    0,
  );

  let investment = fallbackInvestment;
  let returnByIndex = new Map<number, number>();

  if (baseIndex >= 0) {
    try {
      const calculation = calculateSurebet(
        normalizedEntries.map((entry) => ({
          odd: entry.odd,
          stake: entry.stake,
          tipo: entry.side === "lay" ? "L" : "B",
          responsabilidade: entry.responsibility,
          aumento_percentual: entry.increase,
          comissao_percentual: entry.commission,
          cashback_percentual: entry.cashback,
          cashback_apenas_perda: entry.cashbackLossOnly,
          freebet: entry.freebet,
        })),
        baseIndex,
      );

      investment = Number(calculation?.investimento_efetivo ?? fallbackInvestment);
      
      returnByIndex = new Map(
        normalizedEntries.map((_, index) => {
          const lucroLiquido = Number(calculation?.linhas?.[index]?.lucro_liquido ?? 0);

          return [index, lucroLiquido + investment]; 
        }),
      );
    } catch {
      returnByIndex = new Map(
        normalizedEntries.map((entry, index) => {
          const layReturn = calculateLayReturn(
            entry.responsibility,
            entry.effectiveOdd,
            entry.commission,
            entry.cashback,
            entry.cashbackLossOnly,
          );
          const backReturn = entry.freebet
            ? entry.stake *
              ((entry.effectiveOdd - 1) * (1 - entry.commission / 100))
            : entry.stake *
              (1 +
                (entry.effectiveOdd - 1) * (1 - entry.commission / 100) +
                (entry.cashbackLossOnly ? 0 : entry.cashback / 100));

          return [index, entry.side === "lay" ? layReturn : backReturn];
        }),
      );
    }
  } else {
    returnByIndex = new Map(
      normalizedEntries.map((entry, index) => {
        const layReturn = calculateLayReturn(
          entry.responsibility,
          entry.effectiveOdd,
          entry.commission,
          entry.cashback,
          entry.cashbackLossOnly,
        );
        const backReturn = entry.freebet
          ? entry.stake *
            ((entry.effectiveOdd - 1) * (1 - entry.commission / 100))
          : entry.stake *
            (1 +
              (entry.effectiveOdd - 1) * (1 - entry.commission / 100) +
              (entry.cashbackLossOnly ? 0 : entry.cashback / 100));

        return [index, entry.side === "lay" ? layReturn : backReturn];
      }),
    );
  }

  if (selectedResults.length === 0) {
    return 0;
  }

  const selectedResultSet = new Set(selectedResults);
  const selectedReturns = normalizedEntries
    .map((entry, index) =>
      selectedResultSet.has(entry.resultId) ? (returnByIndex.get(index) ?? 0) : null,
    )
    .filter((value): value is number => value !== null);

  if (selectedReturns.length === 0) {

    return selectedResultSet.has("defeat") ? -investment : 0;
  }

  const totalGrossReturn = selectedReturns.reduce(
    (sum, returnVal) => sum + returnVal,
    0,
  );

  return normalizeCurrencyAmount(totalGrossReturn - investment);
}
