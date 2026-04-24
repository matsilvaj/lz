export function parseNumber(value, defaultValue = 0) {
  if (value === null || value === undefined || value === "") {
    return Number(defaultValue);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number(defaultValue);
  }

  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : Number(defaultValue);
}

export function parseBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === null || value === undefined) {
    return false;
  }

  return ["1", "true", "sim", "yes"].includes(String(value).trim().toLowerCase());
}

export function parseText(value, defaultValue = "") {
  if (value === null || value === undefined || value === "None") {
    return defaultValue;
  }

  return String(value);
}

export function formatOperationDate(value = null) {
  if (value instanceof Date) {
    return formatDate(value);
  }

  if (value) {
    return String(value);
  }

  return formatDate(new Date());
}

export function formatReferenceMonth(value = null) {
  if (value instanceof Date) {
    return `${String(value.getMonth() + 1).padStart(2, "0")}/${value.getFullYear()}`;
  }

  if (value) {
    return String(value);
  }

  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
}

export function normalizeHouses(value) {
  if (
    value === null ||
    value === undefined ||
    value === "" ||
    value === "None" ||
    value === "Nenhuma selecionada"
  ) {
    return "";
  }

  if (Array.isArray(value) || value instanceof Set) {
    return Array.from(value)
      .map((item) => parseText(item).trim())
      .filter(Boolean)
      .join(" | ");
  }

  return parseText(value).trim();
}

export function toPlainObject(row) {
  if (!row || typeof row !== "object") {
    return {};
  }

  return { ...row };
}

export function roundTo(value, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(parseNumber(value) * factor) / factor;
}

function formatDate(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}
