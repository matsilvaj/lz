// Odd com aumento percentual aplicado só sobre o lucro (odd - 1).
export function calculateAdjustedOdd(odd, increase) {
  if (odd <= 1) {
    return odd;
  }

  return 1 + (odd - 1) * (1 + increase / 100);
}
