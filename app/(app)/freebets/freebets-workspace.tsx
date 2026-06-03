"use client";

import { MoreVertical, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ProcedureModal } from "../_components/procedure-modal";
import {
  type ProcedureShareProtectionDraft,
  type ProcedureShareValues,
} from "../_components/procedure-share-types";
import {
  EmptyState,
  StatusTag,
  formatCurrency,
  formatFreebetCount,
  formatNumber,
} from "../_components/ui";

const FREEBET_TYPE_OPTIONS = ["Coletar Freebet"] as const;
type FreebetSubtab = "pending-collection" | "convertible" | "pending-conversion";

type FreebetProcedureEntry = {
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
  data_operacao: string;
};

type FreebetProcedureResult = {
  escopo: string;
  resultado_chave: string;
};

type FreebetProcedure = {
  id: number;
  tipo_procedimento: string;
  data_operacao: string;
  jogo_time_pa: string;
  jogo_coleta_freebet?: string;
  jogo_conversao_freebet?: string;
  lote_conversao_freebet?: string;
  casas_envolvidas: string;
  lucro_final: number;
  lucro_real: number;
  observacao: string;
  valor_freebet_coletada: number;
  casa_destino_freebet: string;
  valor_da_freebet: number;
  condicao_freebet: string;
  bateu_duplo: boolean;
  status_procedimento: string;
  entradas?: FreebetProcedureEntry[];
  resultados?: FreebetProcedureResult[];
};

type FreebetQueueItem = {
  id: number;
  data: string;
  data_coleta?: string;
  data_conversao?: string;
  casa: string;
  valor_fb: number;
  lucro_real: number;
  resultado_coleta: string;
  resultado_conversao?: string;
  condicao?: string;
  fase?: "coleta" | "conversao";
  acao?: "resultado_coleta" | "resultado_conversao";
  procedimento?: FreebetProcedure;
};

type ConvertibleFreebetGroup = {
  data: string;
  casa: string;
  ids: number[];
  itens?: FreebetQueueItem[];
  quantidade: number;
  valor_total: number;
  lucro_total: number;
};

type ConvertedFreebetHistoryItem = {
  procedimento_id?: number;
  texto_data: string;
  data_coleta?: string;
  data_conversao?: string | null;
  casa: string;
  valor_freebet: number;
  lucro_coleta: number;
  lucro_conversao: number | null;
  lucro_total: number;
  procedimento?: FreebetProcedure | null;
};

type PendingConversionGroup = {
  id: string;
  ids: number[];
  items: FreebetQueueItem[];
  data: string;
  jogo: string;
  casa: string;
  quantidade: number;
  valor_total: number;
  lucro_total: number;
  batchId?: string;
  procedimento?: FreebetProcedure;
};

type FreebetsWorkspaceProps = {
  convertibleGroups: ConvertibleFreebetGroup[];
  pendingConfirmation: FreebetQueueItem[];
  convertedHistory: ConvertedFreebetHistoryItem[];
  bookmakers: string[];
};

function getProfitClass(value: number) {
  return value >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]";
}

function FreebetRowMenu({ onEdit }: { onEdit: () => void }) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function getMenuPosition() {
    const rect = buttonRef.current?.getBoundingClientRect();

    if (!rect) {
      return { top: 0, left: 0 };
    }

    const spacing = 8;
    const padding = 12;
    const menuWidth = 160;
    const menuHeight = 78;
    const preferredLeft = rect.right - menuWidth;
    const openUp = rect.bottom + spacing + menuHeight > window.innerHeight - padding;

    return {
      left: Math.max(
        padding,
        Math.min(preferredLeft, window.innerWidth - menuWidth - padding),
      ),
      top: Math.max(
        padding,
        openUp ? rect.top - menuHeight - spacing : rect.bottom + spacing,
      ),
    };
  }

  function toggleMenu() {
    if (open) {
      setOpen(false);
      return;
    }

    setMenuPosition(getMenuPosition());
    setOpen(true);
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        !buttonRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    function updateMenuPosition() {
      setMenuPosition(getMenuPosition());
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  return (
    <div
      className="inline-flex"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        aria-label="Opções"
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/4 text-[var(--text-secondary)] transition hover:border-white/20 hover:bg-white/8 hover:text-white"
        onClick={toggleMenu}
        ref={buttonRef}
        type="button"
      >
        <MoreVertical className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-[180] min-w-40 rounded-[22px] border border-white/10 bg-[rgba(17,8,14,0.98)] p-2 text-left shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-xl"
              onClick={(event) => event.stopPropagation()}
              ref={menuRef}
              role="menu"
              style={{ left: menuPosition.left, top: menuPosition.top }}
            >
              <button
                className="block w-full rounded-2xl px-3 py-3 text-left text-sm text-[var(--text-secondary)] transition hover:bg-white/6 hover:text-white"
                onClick={() => {
                  setOpen(false);
                  onEdit();
                }}
                role="menuitem"
                type="button"
              >
                Editar
              </button>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function toDateInputValue(value = "") {
  const [day, month, year] = String(value).split("/");
  if (!day || !month || !year) {
    return "";
  }

  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function toHousesInputValue(value = "") {
  return String(value ?? "")
    .split(/[,|]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
}

function formatDraftNumber(value: number | null | undefined) {
  if (!Number.isFinite(Number(value)) || Math.abs(Number(value)) < 0.005) {
    return "";
  }

  return String(Number(value));
}

function toProtectionDraft(entry: FreebetProcedureEntry): ProcedureShareProtectionDraft {
  return {
    stake: formatDraftNumber(entry.valor),
    odd: formatDraftNumber(entry.odd),
    side: entry.lado === "lay" ? "lay" : "back",
    layOdd: formatDraftNumber(entry.odd_lay),
    commission: formatDraftNumber(entry.comissao_percentual),
    increase: formatDraftNumber(entry.aumento_percentual),
    cashback: formatDraftNumber(entry.cashback_percentual),
    freebet: Boolean(entry.freebet_somente_lucro),
  };
}

function getEntriesByScope(procedure: FreebetProcedure, scope: string) {
  return (procedure.entradas ?? [])
    .filter((entry) => entry.escopo === scope)
    .sort((a, b) => a.ordem - b.ordem);
}

function getResultsByScope(procedure: FreebetProcedure, scope: string) {
  return (procedure.resultados ?? [])
    .filter((result) => result.escopo === scope)
    .map((result) => result.resultado_chave)
    .filter(Boolean);
}

function hasResultsByScope(procedure: FreebetProcedure, scope: string) {
  return getResultsByScope(procedure, scope).length > 0;
}

function getHistoryEditableProcedure(
  item: ConvertedFreebetHistoryItem,
): FreebetProcedure | undefined {
  if (item.procedimento?.id) {
    return item.procedimento;
  }

  const procedureId = Number(item.procedimento_id);
  if (!Number.isInteger(procedureId) || procedureId <= 0) {
    return undefined;
  }

  return {
    id: procedureId,
    tipo_procedimento: "Coletar Freebet",
    data_operacao: item.data_coleta ?? "",
    jogo_time_pa: "",
    jogo_coleta_freebet: "",
    jogo_conversao_freebet: "",
    lote_conversao_freebet: "",
    casas_envolvidas: item.casa,
    lucro_final: item.lucro_total,
    lucro_real: item.lucro_total,
    observacao: "",
    valor_freebet_coletada: 0,
    casa_destino_freebet: item.casa,
    valor_da_freebet: item.valor_freebet,
    condicao_freebet: "",
    bateu_duplo: false,
    status_procedimento: "Concluído",
    entradas: [],
    resultados: [],
  };
}

function getDateInputByScope(procedure: FreebetProcedure, scope: string) {
  const scopeEntries = getEntriesByScope(procedure, scope);
  const entryDate = scopeEntries
    .map((entry) => entry.data_operacao)
    .find((date) => String(date ?? "").trim());

  if (entryDate) {
    return toDateInputValue(entryDate);
  }

  if (scopeEntries.length > 0 && hasResultsByScope(procedure, scope)) {
    return toDateInputValue(procedure.data_operacao);
  }

  return "";
}

function getProcedureGame(
  procedure?: FreebetProcedure,
  scope: "collection" | "conversion" = "collection",
) {
  const scopedGame = String(
    scope === "conversion"
      ? (procedure?.jogo_conversao_freebet ?? "")
      : (procedure?.jogo_coleta_freebet ?? ""),
  ).trim();
  const fallbackGame =
    scope === "conversion" &&
    procedure?.condicao_freebet === "Converter freebet apenas"
      ? String(procedure?.jogo_time_pa ?? "").trim()
      : scope === "collection"
        ? String(procedure?.jogo_time_pa ?? "").trim()
        : "";
  const game = scopedGame || fallbackGame;
  return game && game !== "-" ? game : "-";
}

function getProcedureConversionBatchId(procedure?: FreebetProcedure) {
  return String(procedure?.lote_conversao_freebet ?? "").trim();
}

function getConversionEntrySignature(entry: FreebetProcedureEntry) {
  return [
    entry.tipo_entrada,
    entry.ordem,
    entry.resultado_chave,
    entry.casa,
    entry.odd,
    entry.lado,
    entry.odd_lay,
    entry.comissao_percentual,
    entry.aumento_percentual,
    entry.cashback_percentual,
    entry.freebet_somente_lucro,
    entry.data_operacao,
  ].map((value) => String(value ?? "")).join("::");
}

function getPendingConversionGroupKey(item: FreebetQueueItem) {
  const procedure = item.procedimento;
  const batchId = getProcedureConversionBatchId(procedure);

  if (batchId) {
    return `conversion-batch||${batchId}`;
  }

  const conversionEntries = procedure
    ? getEntriesByScope(procedure, "freebet_conversion")
    : [];
  const conversionSignature = conversionEntries
    .map(getConversionEntrySignature)
    .join("|");

  return [
    item.data_conversao || item.data || "",
    getProcedureGame(procedure, "conversion"),
    item.casa,
    conversionSignature || `freebet-${item.id}`,
  ].join("||");
}

function getConversionMergeKey(entry: FreebetProcedureEntry) {
  return [
    entry.tipo_entrada,
    entry.ordem,
    entry.resultado_chave,
  ].map((value) => String(value ?? "")).join("::");
}

function buildPendingConversionProcedure(
  group: Omit<PendingConversionGroup, "procedimento">,
): FreebetProcedure | undefined {
  const base = group.items.find((item) => item.procedimento)?.procedimento;

  if (!base) {
    return undefined;
  }

  const nonConversionEntries = (base.entradas ?? []).filter(
    (entry) => entry.escopo !== "freebet_conversion",
  );
  const mergedConversionEntries = new Map<string, FreebetProcedureEntry>();

  for (const item of group.items) {
    for (const entry of getEntriesByScope(
      item.procedimento ?? base,
      "freebet_conversion",
    )) {
      const key = getConversionMergeKey(entry);
      const current = mergedConversionEntries.get(key);

      if (current) {
        current.valor += entry.valor;
        continue;
      }

      mergedConversionEntries.set(key, { ...entry });
    }
  }

  const conversionEntries = [...mergedConversionEntries.values()].sort(
    (first, second) => first.ordem - second.ordem,
  );
  const nonConversionResults = (base.resultados ?? []).filter(
    (result) => result.escopo !== "freebet_conversion",
  );

  return {
    ...base,
    data_operacao: group.data || base.data_operacao,
    jogo_time_pa: base.jogo_time_pa,
    jogo_coleta_freebet: base.jogo_coleta_freebet,
    jogo_conversao_freebet:
      group.jogo === "-" ? base.jogo_conversao_freebet : group.jogo,
    lote_conversao_freebet: group.batchId || base.lote_conversao_freebet,
    casa_destino_freebet: group.casa,
    valor_da_freebet: group.valor_total,
    lucro_final: group.lucro_total,
    lucro_real: group.lucro_total,
    entradas: [...nonConversionEntries, ...conversionEntries],
    resultados: nonConversionResults,
  };
}

function buildPendingConversionGroups(
  items: FreebetQueueItem[],
): PendingConversionGroup[] {
  const groups = new Map<string, Omit<PendingConversionGroup, "procedimento">>();

  for (const item of items) {
    const key = getPendingConversionGroupKey(item);
    const current = groups.get(key);
    const batchId = getProcedureConversionBatchId(item.procedimento);

    if (current) {
      current.ids.push(item.id);
      current.items.push(item);
      current.quantidade += 1;
      current.valor_total += item.valor_fb;
      current.lucro_total += item.lucro_real;
      continue;
    }

    groups.set(key, {
      id: key,
      ids: [item.id],
      items: [item],
      data: item.data_conversao || item.data || "-",
      jogo: getProcedureGame(item.procedimento, "conversion"),
      casa: item.casa,
      quantidade: 1,
      valor_total: item.valor_fb,
      lucro_total: item.lucro_real,
      batchId,
    });
  }

  return [...groups.values()].map((group) => ({
    ...group,
    procedimento: buildPendingConversionProcedure(group),
  }));
}

function getConversionBatchIdForIds(ids: number[]) {
  const normalizedIds = ids
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0)
    .sort((first, second) => first - second);

  return normalizedIds.length > 0
    ? `freebet-conversion-${normalizedIds.join("-")}`
    : "";
}

function buildProcedureDefaultValues(
  procedure: FreebetProcedure,
  preferredScope: "freebet_collection" | "freebet_conversion" = "freebet_collection",
  options: {
    visibleScope?: ProcedureShareValues["freebetVisibleScope"];
    originIds?: number[];
  } = {},
): ProcedureShareValues {
  const conversionEntries = getEntriesByScope(procedure, "freebet_conversion");
  const conversionPrimary =
    conversionEntries.find((entry) => entry.tipo_entrada === "principal") ??
    conversionEntries[0];
  const conversionProtections = conversionEntries.filter(
    (entry) => entry.tipo_entrada === "protecao",
  );
  const collectionEntries = getEntriesByScope(procedure, "freebet_collection");
  const collectionPrimary =
    collectionEntries.find((entry) => entry.tipo_entrada === "principal") ??
    collectionEntries[0];
  const collectionProtections = collectionEntries.filter(
    (entry) => entry.tipo_entrada === "protecao",
  );

  return {
    version: 1,
    procedureType: "Coletar Freebet",
    operationDate: toDateInputValue(procedure.data_operacao),
    game: getProcedureGame(
      procedure,
      preferredScope === "freebet_conversion" ? "conversion" : "collection",
    ) === "-"
      ? ""
      : getProcedureGame(
          procedure,
          preferredScope === "freebet_conversion" ? "conversion" : "collection",
        ),
    collectionGame:
      getProcedureGame(procedure, "collection") === "-"
        ? ""
        : getProcedureGame(procedure, "collection"),
    conversionGame:
      getProcedureGame(procedure, "conversion") === "-"
        ? ""
        : getProcedureGame(procedure, "conversion"),
    conversionBatchId: procedure.lote_conversao_freebet,
    houses: toHousesInputValue(procedure.casas_envolvidas),
    entryValue: Number(procedure.lucro_real ?? procedure.lucro_final ?? 0),
    note: procedure.observacao,
    doubleValue: procedure.valor_freebet_coletada,
    hitDouble: procedure.bateu_duplo,
    freebetHouse: procedure.casa_destino_freebet,
    selectedFreebetHouse: procedure.casa_destino_freebet,
    freebetValue: procedure.valor_da_freebet,
    freebetCondition: procedure.condicao_freebet,
    procedureStatus:
      procedure.status_procedimento === "Concluído" ? "Concluído" : "Pendente",
    selectedHouses: [
      conversionPrimary?.casa ?? "",
      ...conversionProtections.map((entry) => entry.casa),
    ],
    primaryStake: formatDraftNumber(conversionPrimary?.valor),
    primaryOdd: formatDraftNumber(conversionPrimary?.odd),
    primarySide: conversionPrimary?.lado === "lay" ? "lay" : "back",
    primaryLayOdd: formatDraftNumber(conversionPrimary?.odd_lay),
    primaryCommission: formatDraftNumber(conversionPrimary?.comissao_percentual),
    primaryIncrease: formatDraftNumber(conversionPrimary?.aumento_percentual),
    primaryCashback: formatDraftNumber(conversionPrimary?.cashback_percentual),
    primaryFreebet: Boolean(conversionPrimary?.freebet_somente_lucro),
    sportProtections: conversionProtections.map(toProtectionDraft),
    sportResultSelections: getResultsByScope(procedure, "freebet_conversion"),
    collectionDate: getDateInputByScope(procedure, "freebet_collection"),
    conversionDate: getDateInputByScope(procedure, "freebet_conversion"),
    collectionHouses: [
      collectionPrimary?.casa ?? "",
      ...collectionProtections.map((entry) => entry.casa),
    ],
    collectionPrimaryStake: formatDraftNumber(collectionPrimary?.valor),
    collectionPrimaryOdd: formatDraftNumber(collectionPrimary?.odd),
    collectionPrimarySide: collectionPrimary?.lado === "lay" ? "lay" : "back",
    collectionPrimaryLayOdd: formatDraftNumber(collectionPrimary?.odd_lay),
    collectionPrimaryCommission: formatDraftNumber(
      collectionPrimary?.comissao_percentual,
    ),
    collectionPrimaryIncrease: formatDraftNumber(
      collectionPrimary?.aumento_percentual,
    ),
    collectionPrimaryCashback: formatDraftNumber(
      collectionPrimary?.cashback_percentual,
    ),
    collectionPrimaryFreebet: Boolean(collectionPrimary?.freebet_somente_lucro),
    collectionProtections: collectionProtections.map(toProtectionDraft),
    collectionResultSelections: getResultsByScope(procedure, "freebet_collection"),
    freebetCollectionOpen: preferredScope === "freebet_collection",
    freebetConversionOpen: preferredScope === "freebet_conversion",
    freebetVisibleScope: options.visibleScope ?? "all",
    originIds: options.originIds,
  };
}

export function FreebetsWorkspace({
  bookmakers,
  convertibleGroups,
  pendingConfirmation,
  convertedHistory,
}: FreebetsWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<"freebets" | "history">("freebets");
  const [activeSubtab, setActiveSubtab] = useState<FreebetSubtab>("pending-collection");
  const [detailsGroup, setDetailsGroup] = useState<ConvertibleFreebetGroup | null>(null);
  const [selectedFreebetIds, setSelectedFreebetIds] = useState<number[]>([]);
  const [editingProcedure, setEditingProcedure] = useState<{
    procedure: FreebetProcedure;
    scope: "freebet_collection" | "freebet_conversion";
    visibleScope?: ProcedureShareValues["freebetVisibleScope"];
    originIds?: number[];
  } | null>(null);
  const pendingCollection = pendingConfirmation.filter((item) => item.fase !== "conversao");
  const pendingConversion = pendingConfirmation.filter((item) => item.fase === "conversao");
  const pendingConversionGroups = buildPendingConversionGroups(pendingConversion);
  const isPendingConversionTab = activeSubtab === "pending-conversion";
  const activePendingItems = pendingCollection;
  const freebetStages: Array<{
    id: FreebetSubtab;
    label: string;
    count: number;
  }> = [
    {
      id: "pending-collection",
      label: "Aguardando coleta",
      count: pendingCollection.length,
    },
    {
      id: "convertible",
      label: "Prontas para conversão",
      count: convertibleGroups.length,
    },
    {
      id: "pending-conversion",
      label: "Aguardando conversão",
      count: pendingConversionGroups.length,
    },
  ];
  const pendingEmptyTitle =
    activeSubtab === "pending-conversion"
      ? "Nenhuma conversão aguardando resultado"
      : "Nenhuma coleta aguardando resultado";
  const pendingEmptyDescription =
    activeSubtab === "pending-conversion"
      ? "Quando uma conversão for criada sem resultado selecionado, ela aparece aqui para finalizar."
      : "Quando uma coleta ainda não tiver resultado selecionado, ela aparece aqui antes de ficar pronta para conversão.";

  function openProcedureEditor(
    procedure: FreebetProcedure | undefined,
    scope: "freebet_collection" | "freebet_conversion" = "freebet_collection",
    options: {
      visibleScope?: ProcedureShareValues["freebetVisibleScope"];
      originIds?: number[];
    } = {},
  ) {
    if (!procedure) {
      return;
    }

    setDetailsGroup(null);
    setEditingProcedure({ procedure, scope, ...options });
  }

  function getHistoryEditScope(item: { lucro_conversao: number | null }) {
    return item.lucro_conversao === null
      ? "freebet_collection"
      : "freebet_conversion";
  }

  function getSelectedItems(group: ConvertibleFreebetGroup, ids = selectedFreebetIds) {
    const items: FreebetQueueItem[] = group.itens?.length
      ? group.itens
      : group.ids.map((id) => ({
          id,
          data: group.data,
          data_coleta: group.data,
          casa: group.casa,
          valor_fb: group.valor_total / Math.max(group.ids.length, 1),
          lucro_real: group.lucro_total / Math.max(group.ids.length, 1),
          resultado_coleta: "-",
          condicao: "",
        }));

    return items.filter((item) => ids.includes(item.id));
  }

  function buildConverterHref(item: ConvertibleFreebetGroup, ids = item.ids) {
    const selectedItems = getSelectedItems(item, ids);
    const selectedIds = selectedItems.map((freebet) => freebet.id);
    const conversionBatchId = getConversionBatchIdForIds(selectedIds);
    const freebetValue = selectedItems.reduce(
      (sum, freebet) => sum + freebet.valor_fb,
      0,
    );
    const entryValue = selectedItems.reduce(
      (sum, freebet) => sum + freebet.lucro_real,
      0,
    );
    const params = new URLSearchParams();
    params.set("mode", "convert-freebet");
    params.set("house", item.casa);
    params.set("freebetValue", String(freebetValue));
    params.set("entryValue", String(entryValue));
    if (conversionBatchId) {
      params.set("conversionBatchId", conversionBatchId);
    }

    for (const originId of selectedIds) {
      params.append("originIds", String(originId));
    }

    return `/calculadora?${params.toString()}`;
  }

  function openDetails(group: ConvertibleFreebetGroup) {
    setDetailsGroup(group);
    setSelectedFreebetIds(group.ids);
  }

  function toggleSelectedFreebet(id: number) {
    setSelectedFreebetIds((current) =>
      current.includes(id)
        ? current.filter((currentId) => currentId !== id)
        : [...current, id],
    );
  }

  const detailItems = detailsGroup ? getSelectedItems(detailsGroup, detailsGroup.ids) : [];
  const detailSelectedItems = detailsGroup ? getSelectedItems(detailsGroup) : [];
  const selectedFreebetValue = detailSelectedItems.reduce(
    (sum, item) => sum + item.valor_fb,
    0,
  );
  const selectedCollectionResult = detailSelectedItems.reduce(
    (sum, item) => sum + item.lucro_real,
    0,
  );

  return (
    <div className="space-y-5">
      {editingProcedure ? (
        <ProcedureModal
          bookmakers={bookmakers}
          defaultValues={buildProcedureDefaultValues(
            editingProcedure.procedure,
            editingProcedure.scope,
            {
              visibleScope: editingProcedure.visibleScope,
              originIds: editingProcedure.originIds,
            },
          )}
          hideTrigger
          hideTypeSelector
          mode="edit"
          onOpenChange={(open) => {
            if (!open) {
              setEditingProcedure(null);
            }
          }}
          open
          procedureId={editingProcedure.procedure.id}
          returnTo="/freebets"
          submitLabel="Salvar alterações"
          title="Editar freebet"
          typeOptions={FREEBET_TYPE_OPTIONS}
        />
      ) : null}

      <div className="lz-panel flex flex-wrap items-center justify-between gap-3 rounded-[28px] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${
              activeTab === "freebets" ? "lz-button-primary" : "lz-button-secondary"
            }`}
            onClick={() => setActiveTab("freebets")}
            type="button"
          >
            Freebets
          </button>
          <button
            className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${
              activeTab === "history" ? "lz-button-primary" : "lz-button-secondary"
            }`}
            onClick={() => setActiveTab("history")}
            type="button"
          >
            Histórico
          </button>
        </div>

        <ProcedureModal
          bookmakers={bookmakers}
          defaultValues={{
            procedureType: "Coletar Freebet",
            freebetCollectionOpen: true,
            freebetConversionOpen: false,
            procedureStatus: "Pendente",
          }}
          hideTypeSelector
          returnTo="/freebets"
          submitLabel="Salvar freebet"
          title="Adicionar freebet"
          triggerLabel="Adicionar freebet"
          typeOptions={FREEBET_TYPE_OPTIONS}
        />
      </div>

      {activeTab === "freebets" ? (
        <div className="lz-panel space-y-4 rounded-[28px] p-3 md:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                Fila de freebets
              </p>
              <h2 className="mt-1 text-xl font-semibold text-white">Acompanhamento</h2>
            </div>

            <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[720px]">
              {freebetStages.map((stage) => (
                <button
                  className={`flex items-center justify-between gap-3 rounded-[20px] border px-3 py-2.5 text-left text-sm font-semibold transition ${
                    activeSubtab === stage.id
                      ? "border-[rgba(216,31,89,0.65)] bg-[rgba(216,31,89,0.18)] text-white shadow-[0_16px_38px_rgba(216,31,89,0.16)]"
                      : "border-white/10 bg-white/4 text-[var(--text-secondary)] hover:border-white/20 hover:bg-white/7 hover:text-white"
                  }`}
                  key={stage.id}
                  onClick={() => setActiveSubtab(stage.id)}
                  type="button"
                >
                  <span>{stage.label}</span>
                  <span
                    className={`inline-flex min-w-8 items-center justify-center rounded-full px-2 py-1 text-xs ${
                      activeSubtab === stage.id
                        ? "bg-white/14 text-white"
                        : "bg-white/7 text-[var(--text-dim)]"
                    }`}
                  >
                    {formatNumber(stage.count)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[22px] border border-white/10 bg-black/10 px-3 py-2 md:px-4">
            {activeSubtab === "convertible" ? (
              convertibleGroups.length === 0 ? (
                <EmptyState
                  action={
                    <Link
                      className="lz-button-secondary inline-flex rounded-full px-4 py-3 text-sm font-semibold"
                      href="/procedimentos"
                    >
                      Ver procedimentos
                    </Link>
                  }
                  description="Quando houver freebets prontas para conversão, esta fila vai destacar tudo o que precisa de ação."
                  eyebrow="Fila vazia"
                  title="Nenhuma freebet pronta para conversão"
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] table-fixed text-sm">
                    <colgroup>
                      <col className="w-[15%]" />
                      <col className="w-[16%]" />
                      <col className="w-[9%]" />
                      <col className="w-[16%]" />
                      <col className="w-[20%]" />
                      <col className="w-[24%]" />
                    </colgroup>
                    <thead className="text-[var(--text-dim)]">
                      <tr className="border-b border-white/10">
                        <th className="px-2 py-2.5 text-center font-semibold">
                          Data da coleta
                        </th>
                        <th className="px-2 py-2.5 text-center font-semibold">Casa</th>
                        <th className="px-2 py-2.5 text-center font-semibold">Qtd</th>
                        <th className="px-2 py-2.5 text-center font-semibold">Valor FB</th>
                        <th className="px-2 py-2.5 text-center font-semibold">
                          Resultado coleta
                        </th>
                        <th className="px-2 py-2.5 text-center font-semibold">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {convertibleGroups.map((item) => (
                        <tr
                          className="border-b border-white/8 align-middle transition hover:bg-white/5"
                          key={item.casa}
                        >
                          <td className="px-2 py-2.5 text-center font-semibold text-white">
                            {item.data}
                          </td>
                          <td className="px-2 py-2.5 text-center font-semibold text-white">
                            {item.casa}
                          </td>
                          <td className="px-2 py-2.5 text-center font-semibold text-white">
                            {formatNumber(item.quantidade)}
                          </td>
                          <td className="px-2 py-2.5 text-center font-semibold text-white">
                            {formatCurrency(item.valor_total)}
                          </td>
                          <td
                            className={`px-2 py-2.5 text-center font-semibold ${getProfitClass(
                              item.lucro_total,
                            )}`}
                          >
                            {formatCurrency(item.lucro_total)}
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <div className="inline-flex items-center justify-center gap-2">
                              <button
                                className="lz-button-primary rounded-full px-3.5 py-2 text-sm font-semibold leading-none"
                                onClick={() => openDetails(item)}
                                type="button"
                              >
                                Converter
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : isPendingConversionTab ? (
              pendingConversionGroups.length === 0 ? (
                <EmptyState
                  description={pendingEmptyDescription}
                  eyebrow="Sem pendências"
                  title={pendingEmptyTitle}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] table-fixed text-sm">
                    <colgroup>
                      <col className="w-[14%]" />
                      <col className="w-[20%]" />
                      <col className="w-[15%]" />
                      <col className="w-[8%]" />
                      <col className="w-[14%]" />
                      <col className="w-[17%]" />
                      <col className="w-[12%]" />
                    </colgroup>
                    <thead className="text-[var(--text-dim)]">
                      <tr className="border-b border-white/10">
                        <th className="px-2 py-2.5 text-center font-semibold">
                          Data da conversão
                        </th>
                        <th className="px-2 py-2.5 text-center font-semibold">Jogo</th>
                        <th className="px-2 py-2.5 text-center font-semibold">Casa</th>
                        <th className="px-2 py-2.5 text-center font-semibold">Qtd</th>
                        <th className="px-2 py-2.5 text-center font-semibold">Valor FB</th>
                        <th className="px-2 py-2.5 text-center font-semibold">
                          Resultado coleta
                        </th>
                        <th className="px-2 py-2.5 text-center font-semibold">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingConversionGroups.map((group) => (
                        <tr
                          className="cursor-pointer border-b border-white/8 align-middle transition hover:bg-white/5"
                          key={group.id}
                          onClick={() =>
                            openProcedureEditor(group.procedimento, "freebet_conversion", {
                              visibleScope: "conversion",
                              originIds: group.ids,
                            })
                          }
                        >
                          <td className="px-2 py-2.5 text-center font-semibold text-white">
                            {group.data}
                          </td>
                          <td className="px-2 py-2.5 text-center font-semibold text-white">
                            {group.jogo}
                          </td>
                          <td className="px-2 py-2.5 text-center font-semibold text-white">
                            {group.casa}
                          </td>
                          <td className="px-2 py-2.5 text-center font-semibold text-white">
                            {formatNumber(group.quantidade)}
                          </td>
                          <td className="px-2 py-2.5 text-center font-semibold text-white">
                            {formatCurrency(group.valor_total)}
                          </td>
                          <td
                            className={`px-2 py-2.5 text-center font-semibold ${getProfitClass(
                              group.lucro_total,
                            )}`}
                          >
                            {formatCurrency(group.lucro_total)}
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            <button
                              className="lz-button-primary rounded-full px-3.5 py-2 text-sm font-semibold leading-none"
                              onClick={(event) => {
                                event.stopPropagation();
                                openProcedureEditor(
                                  group.procedimento,
                                  "freebet_conversion",
                                  {
                                    visibleScope: "conversion",
                                    originIds: group.ids,
                                  },
                                );
                              }}
                              type="button"
                            >
                              Abrir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : activePendingItems.length === 0 ? (
              <EmptyState
                description={pendingEmptyDescription}
                eyebrow="Sem pendências"
                title={pendingEmptyTitle}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] table-fixed text-sm">
                  <colgroup>
                    <col className={isPendingConversionTab ? "w-[20%]" : "w-[25%]"} />
                    <col className={isPendingConversionTab ? "w-[20%]" : "w-[25%]"} />
                    <col className={isPendingConversionTab ? "w-[20%]" : "w-[25%]"} />
                    {isPendingConversionTab ? <col className="w-[22%]" /> : null}
                    <col className={isPendingConversionTab ? "w-[18%]" : "w-[25%]"} />
                  </colgroup>
                  <thead className="text-[var(--text-dim)]">
                    <tr className="border-b border-white/10">
                      <th className="px-2 py-2.5 text-center font-semibold">
                        {isPendingConversionTab ? "Data da conversão" : "Data da coleta"}
                      </th>
                      <th className="px-2 py-2.5 text-center font-semibold">Casa</th>
                      <th className="px-2 py-2.5 text-center font-semibold">Valor FB</th>
                      {isPendingConversionTab ? (
                        <th className="px-2 py-2.5 text-center font-semibold">
                          Resultado coleta
                        </th>
                      ) : null}
                      <th className="px-2 py-2.5 text-center font-semibold">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activePendingItems.map((item) => {
                      const editScope =
                        item.acao === "resultado_conversao"
                          ? "freebet_conversion"
                          : "freebet_collection";
                      const displayDate = isPendingConversionTab
                        ? item.data_conversao || item.data
                        : item.data_coleta || item.data;

                      return (
                        <tr
                          className="cursor-pointer border-b border-white/8 align-middle transition hover:bg-white/5"
                          key={item.id}
                          onClick={() => openProcedureEditor(item.procedimento, editScope)}
                        >
                          <td className="px-2 py-2.5 text-center font-semibold text-white">
                            {displayDate}
                          </td>
                          <td className="px-2 py-2.5 text-center font-semibold text-white">
                            {item.casa}
                          </td>
                          <td className="px-2 py-2.5 text-center font-semibold text-white">
                            {formatCurrency(item.valor_fb)}
                          </td>
                          {isPendingConversionTab ? (
                            <td
                              className={`px-2 py-2.5 text-center font-semibold ${getProfitClass(
                                item.lucro_real,
                              )}`}
                            >
                              {formatCurrency(item.lucro_real)}
                            </td>
                          ) : null}
                          <td className="px-2 py-2.5 text-center">
                            <button
                              className="lz-button-primary rounded-full px-3.5 py-2 text-sm font-semibold leading-none"
                              onClick={(event) => {
                                event.stopPropagation();
                                openProcedureEditor(item.procedimento, editScope);
                              }}
                              type="button"
                            >
                              Abrir
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="lz-panel rounded-[30px] p-4 md:p-6">
          {convertedHistory.length === 0 ? (
            <EmptyState
              description="Quando houver conversões concluídas, o histórico vai organizar o desempenho por casa e lucro."
              eyebrow="Ainda sem histórico"
              title="Nenhuma conversão registrada"
            />
          ) : (
            <>
              <div className="grid gap-4 md:hidden">
                {convertedHistory.map((item, index) => {
                  const editableProcedure = getHistoryEditableProcedure(item);
                  const editScope = getHistoryEditScope(item);

                  return (
                    <article
                      className="cursor-pointer rounded-[26px] border border-white/10 bg-white/5 p-4 transition hover:bg-white/8"
                      key={`${item.texto_data}-${item.casa}-${index}`}
                      onClick={() => openProcedureEditor(editableProcedure, editScope)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                            {item.texto_data}
                          </p>
                          <p className="mt-2 text-lg font-semibold text-white">{item.casa}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusTag tone="positive">Concluída</StatusTag>
                          <FreebetRowMenu
                            onEdit={() => openProcedureEditor(editableProcedure, editScope)}
                          />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[22px] border border-white/10 bg-white/4 p-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">
                            Valor FB
                          </p>
                          <p className="mt-2 text-lg font-semibold text-white">
                            {formatCurrency(item.valor_freebet)}
                          </p>
                        </div>
                        <div className="rounded-[22px] border border-white/10 bg-white/4 p-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">
                            Total
                          </p>
                          <p className={`mt-2 text-lg font-semibold ${getProfitClass(item.lucro_total)}`}>
                            {formatCurrency(item.lucro_total)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2 text-sm text-[var(--text-secondary)]">
                        <p>
                          Resultado coleta:{" "}
                          <span className={getProfitClass(item.lucro_coleta)}>
                            {formatCurrency(item.lucro_coleta)}
                          </span>
                        </p>
                        <p>
                          Resultado conversão:{" "}
                          <span className={getProfitClass(item.lucro_conversao ?? 0)}>
                            {formatCurrency(item.lucro_conversao ?? 0)}
                          </span>
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-sm">
                  <thead className="text-[var(--text-dim)]">
                    <tr className="border-b border-white/10">
                      <th className="px-3 py-3 text-center font-medium">Data (Col - Conv)</th>
                      <th className="px-3 py-3 text-center font-medium">Casa</th>
                      <th className="px-3 py-3 text-center font-medium">Valor FB</th>
                      <th className="px-3 py-3 text-center font-medium">Resultado coleta</th>
                      <th className="px-3 py-3 text-center font-medium">Resultado conversão</th>
                      <th className="px-3 py-3 text-center font-medium">Total</th>
                      <th className="px-3 py-3 text-center font-medium">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {convertedHistory.map((item, index) => {
                      const editableProcedure = getHistoryEditableProcedure(item);
                      const editScope = getHistoryEditScope(item);

                      return (
                        <tr
                          className="cursor-pointer border-b border-white/8 align-middle transition hover:bg-white/4"
                          key={`${item.texto_data}-${item.casa}-${index}`}
                          onClick={() => openProcedureEditor(editableProcedure, editScope)}
                        >
                          <td className="px-3 py-4 text-center text-[var(--text-secondary)]">
                            {item.texto_data}
                          </td>
                          <td className="px-3 py-4 text-center font-semibold text-white">
                            {item.casa}
                          </td>
                          <td className="px-3 py-4 text-center text-[var(--text-secondary)]">
                            {formatCurrency(item.valor_freebet)}
                          </td>
                          <td className={`px-3 py-4 text-center ${getProfitClass(item.lucro_coleta)}`}>
                            {formatCurrency(item.lucro_coleta)}
                          </td>
                          <td
                            className={`px-3 py-4 text-center ${getProfitClass(item.lucro_conversao ?? 0)}`}
                          >
                            {formatCurrency(item.lucro_conversao ?? 0)}
                          </td>
                          <td
                            className={`px-3 py-4 text-center font-semibold ${getProfitClass(item.lucro_total)}`}
                          >
                            {formatCurrency(item.lucro_total)}
                          </td>
                          <td className="px-3 py-4 text-center">
                            <FreebetRowMenu
                              onEdit={() => openProcedureEditor(editableProcedure, editScope)}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {detailsGroup && typeof document !== "undefined" ? createPortal((
        <div
          className="fixed inset-0 z-[120] overflow-y-auto bg-black/72 px-4 py-6 backdrop-blur-sm sm:py-8"
          onClick={() => setDetailsGroup(null)}
        >
          <div className="flex min-h-full items-start justify-center">
            <section
              aria-modal="true"
              className="w-full max-w-5xl rounded-[30px] border border-white/10 bg-[var(--panel)] p-4 shadow-2xl sm:p-5"
              onClick={(event) => event.stopPropagation()}
              role="dialog"
            >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                  Selecionar freebets
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">{detailsGroup.casa}</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {formatFreebetCount(detailsGroup.quantidade)} de{" "}
                  {formatCurrency(detailsGroup.valor_total)}
                </p>
              </div>
              <button
                aria-label="Fechar detalhes"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[var(--text-secondary)] transition hover:border-[rgba(216,31,89,0.55)] hover:text-white"
                onClick={() => setDetailsGroup(null)}
                type="button"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 rounded-[24px] border border-white/10 bg-white/4 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-dim)]">
                  Selecionadas
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {formatNumber(detailSelectedItems.length)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-dim)]">
                  Valor FB
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {formatCurrency(selectedFreebetValue)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-dim)]">
                  Resultado coleta
                </p>
                <p className={`mt-2 text-lg font-semibold ${getProfitClass(selectedCollectionResult)}`}>
                  {formatCurrency(selectedCollectionResult)}
                </p>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto">
              <div className="mx-auto w-full max-w-4xl">
                <table className="w-full table-fixed text-sm">
                  <colgroup>
                    <col className="w-[13%]" />
                    <col className="w-[24%]" />
                    <col className="w-[20%]" />
                    <col className="w-[24%]" />
                    <col className="w-[19%]" />
                  </colgroup>
                  <thead className="text-[var(--text-dim)]">
                    <tr className="border-b border-white/10">
                      <th className="px-3 py-3 text-center font-medium">Selecionar</th>
                      <th className="px-3 py-3 text-center font-medium">Data da coleta</th>
                      <th className="px-3 py-3 text-center font-medium">Valor FB</th>
                      <th className="px-3 py-3 text-center font-medium">
                        Resultado coleta
                      </th>
                      <th className="px-3 py-3 text-center font-medium">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailItems.map((item) => (
                      <tr
                        className="border-b border-white/8 align-middle transition hover:bg-white/4"
                        key={item.id}
                      >
                        <td className="px-3 py-3.5 text-center">
                          <input
                            aria-label={`Selecionar freebet de ${formatCurrency(
                              item.valor_fb,
                            )}`}
                            checked={selectedFreebetIds.includes(item.id)}
                            className="lz-checkbox"
                            onChange={() => toggleSelectedFreebet(item.id)}
                            type="checkbox"
                          />
                        </td>
                        <td className="px-3 py-3.5 text-center text-[var(--text-secondary)]">
                          {item.data || "-"}
                        </td>
                        <td className="px-3 py-3.5 text-center font-medium text-white">
                          {formatCurrency(item.valor_fb)}
                        </td>
                        <td
                          className={`px-3 py-3.5 text-center font-medium ${getProfitClass(item.lucro_real)}`}
                        >
                          {formatCurrency(item.lucro_real)}
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <button
                            className="lz-button-secondary rounded-full px-3.5 py-2 text-sm font-semibold leading-none"
                            onClick={() =>
                              openProcedureEditor(item.procedimento, "freebet_collection")
                            }
                            type="button"
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mx-auto mt-5 flex w-full max-w-4xl flex-wrap justify-end gap-3">
              {selectedFreebetIds.length > 0 ? (
                <Link
                  className="lz-button-primary rounded-full px-4 py-3 text-sm font-semibold"
                  href={buildConverterHref(detailsGroup, selectedFreebetIds)}
                >
                  Converter selecionadas
                </Link>
              ) : (
                <button
                  className="lz-button-secondary rounded-full px-4 py-3 text-sm font-semibold opacity-60"
                  disabled
                  type="button"
                >
                  Converter selecionadas
                </button>
              )}
            </div>
            </section>
          </div>
        </div>
      ), document.body) : null}
    </div>
  );
}
