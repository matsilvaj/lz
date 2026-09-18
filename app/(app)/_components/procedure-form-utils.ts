

export type SportResultSelection = "principal" | "defeat" | `protection-${number}`;

export type BetSide = "back" | "lay";

export function parseDecimalInput(value: string) {
  const parsed = Number.parseFloat(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeCurrencyAmount(value: number) {
  if (!Number.isFinite(value) || Math.abs(value) < 0.005) {
    return 0;
  }

  return value;
}
