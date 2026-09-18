// Formatadores compartilhados entre telas (cliente e servidor).

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number) {
  return currencyFormatter.format(Number.isFinite(value) ? value : 0);
}

// Valor para campo editável: vazio quando é zero ou inválido.
export function formatDraftNumber(value: number | null | undefined) {
  if (!Number.isFinite(Number(value)) || Math.abs(Number(value)) < 0.005) {
    return "";
  }

  return String(Number(value));
}

// "dd/mm/aaaa" -> "aaaa-mm-dd" (valor de <input type="date">).
export function toDateInputValue(value = "") {
  const [day, month, year] = String(value).split("/");
  if (!day || !month || !year) {
    return "";
  }

  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
