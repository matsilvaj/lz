import "server-only";

type NumberLimits = {
  defaultValue?: number;
  max?: number;
  min?: number;
};

export function normalizeText(value: FormDataEntryValue | string | null, maxLength = 160) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

export function normalizeLongText(value: FormDataEntryValue | string | null, maxLength = 2_000) {
  return String(value ?? "")
    .trim()
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .slice(0, maxLength);
}

export function normalizeEmail(value: FormDataEntryValue | string | null) {
  return normalizeText(value, 254).toLowerCase();
}

export function parseLimitedNumber(
  value: FormDataEntryValue | string | number | null,
  { defaultValue = 0, max = 10_000_000, min = -10_000_000 }: NumberLimits = {},
) {
  const normalized = String(value ?? "").trim().replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) {
    return defaultValue;
  }

  return Math.min(Math.max(parsed, min), max);
}

export function parsePositiveInteger(value: FormDataEntryValue | string | number | null) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}
