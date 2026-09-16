import type { ProcedureShareChildDraft } from "./procedure-share-types";

type StoredEntry = {
  escopo: string;
  tipo_entrada: string;
  ordem: number;
  resultado_chave: string;
  casa: string;
  valor: number;
  odd: number;
  lado: string;
  odd_lay: number;
  comissao_percentual: number;
  aumento_percentual: number;
  cashback_percentual: number;
  freebet_somente_lucro: boolean;
};

function formatDraftNumber(value: number | null | undefined) {
  if (!Number.isFinite(Number(value)) || Math.abs(Number(value)) < 0.005) {
    return "";
  }

  return String(Number(value));
}

// Filhas compartilham a chave de resultado da mãe; o modal indexa proteções pela posição.
export function buildChildDraftsFromEntries(
  entries: StoredEntry[] | undefined,
  scope: string,
): Record<string, ProcedureShareChildDraft[]> {
  const scopeEntries = (entries ?? []).filter((entry) => entry.escopo === scope);
  const protectionKeys = scopeEntries
    .filter((entry) => entry.tipo_entrada === "protecao")
    .sort((a, b) => a.ordem - b.ordem)
    .map((entry) => entry.resultado_chave);
  const record: Record<string, ProcedureShareChildDraft[]> = {};

  for (const entry of scopeEntries
    .filter((item) => item.tipo_entrada === "filha")
    .sort((a, b) => a.ordem - b.ordem)) {
    const protectionIndex = protectionKeys.indexOf(entry.resultado_chave);
    const parent =
      entry.resultado_chave === "principal"
        ? "principal"
        : protectionIndex >= 0
          ? `protection-${protectionIndex}`
          : "";

    if (!parent) {
      continue;
    }

    record[parent] = [
      ...(record[parent] ?? []),
      {
        house: entry.casa ?? "",
        stake: formatDraftNumber(entry.valor),
        odd: formatDraftNumber(entry.odd),
        side: entry.lado === "lay" ? "lay" : "back",
        layOdd: formatDraftNumber(entry.odd_lay),
        commission: formatDraftNumber(entry.comissao_percentual),
        increase: formatDraftNumber(entry.aumento_percentual),
        cashback: formatDraftNumber(entry.cashback_percentual),
        freebet: Boolean(entry.freebet_somente_lucro),
      },
    ];
  }

  return record;
}
