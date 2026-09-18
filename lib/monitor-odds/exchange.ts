export const EXCHANGE_COMMISSION_PERCENT = 2.8;

function normalizeBookmakerToken(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

export function isExchangeBookmaker(name: unknown, slug?: unknown) {
  return (
    normalizeBookmakerToken(name) === "exchange" ||
    normalizeBookmakerToken(slug) === "exchange"
  );
}

export function getBookmakerCommission(name: unknown, slug?: unknown) {
  return isExchangeBookmaker(name, slug) ? EXCHANGE_COMMISSION_PERCENT : 0;
}

// Odd líquida: o lucro da aposta é reduzido pela comissão, o valor apostado não.
export function getNetOdd(price: number, commissionPercent: number) {
  if (!Number.isFinite(price) || price <= 1 || commissionPercent <= 0) {
    return price;
  }

  return 1 + (price - 1) * (1 - commissionPercent / 100);
}

export function formatCommissionPercent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}
