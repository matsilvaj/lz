"use client";

import {
  CASINO_PROCEDURE_TYPES,
  PROCEDURE_STATUS_DONE,
  PROCEDURE_STATUS_PENDING,
  PROCEDURE_STATUSES,
  PROCEDURE_TYPES,
} from "@/core";
import {
  CheckCircle2,
  Clock,
  RotateCcw,
  Search,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  type MouseEvent as ReactMouseEvent,
  useDeferredValue,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";

import { useScreenFilters } from "@/app/(app)/_components/use-screen-filters";
import { useToast } from "@/app/_components/toast-provider";

import { ConfirmationDialog } from "../_components/confirmation-dialog";
import { DatePickerField } from "../_components/date-picker-field";
import { updateProcedureStatusAction } from "../procedure-actions";
import { ProcedureModal } from "../_components/procedure-modal";
import {
  MULTIPLE_OPTIONS,
  ProcedureDateDisplay,
  ProcedureHousesDisplay,
} from "../_components/procedure-result-display";
import {
  decodeProcedureSharePayload,
  PROCEDURE_SHARE_PARAM,
} from "../_components/procedure-share";
import { EmptyState, StatusTag, formatCurrency } from "../_components/ui";
import {
  ProcedureRowActions,
  requestProcedureEdit,
  requestProcedureMenu,
} from "./procedure-row-actions";
import { isFreebetProcedure } from "@/lib/procedures";
import { clamp } from "@/lib/format";
import { getProfitClass } from "@/app/(app)/_components/ui";

type ProcedureRow = {
  id: number;
  data_operacao: string;
  tipo_procedimento: string;
  jogo_time_pa: string;
  jogo_coleta_freebet?: string;
  jogo_conversao_freebet?: string;
  lote_conversao_freebet?: string;
  casas_envolvidas: string;
  lucro_final: number;
  bateu_duplo: boolean;
  lucro_real: number;
  observacao: string;
  valor_freebet_coletada: number;
  casa_destino_freebet: string;
  valor_da_freebet: number;
  condicao_freebet: string;
  status_procedimento: string;
  entradas?: Array<{
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
  cashback_apenas_perda?: boolean;
    freebet_somente_lucro: boolean;
    parceiro_id?: number | null;
    data_operacao: string;
  }>;
  resultados?: Array<{
    escopo: string;
    resultado_chave: string;
  }>;
};

type ProceduresWorkspaceProps = {
  bookmakers: string[];
  filters: {
    searchText: string;
    types: string[];
    houses: string[];
    statuses: string[];
    multiples: string[];
    partners: string[];
    dateFrom: string;
    dateTo: string;
  };
  partners: Array<{ id: number; name: string }>;
  pagination: {
    page: number;
    pageSize: number;
    pageCount: number;
    totalItems: number;
  };
  procedures: ProcedureRow[];
};

const PROCEDURE_TYPE_LABELS: Record<string, string> = {
  "Tentativa de Duplo": "Tentativa de DG",
  "Coletar Freebet": "Freebet",
  "Converter Freebet": "Freebet",
};
const FREEBET_FILTER_TYPES = ["Coletar Freebet", "Converter Freebet"];
const PROCEDURE_TYPE_FILTER_OPTIONS = PROCEDURE_TYPES.reduce<
  Array<{ key: string; label: string; values: string[] }>
>((options, type) => {
  if (FREEBET_FILTER_TYPES.includes(type)) {
    if (!options.some((option) => option.key === "freebet")) {
      options.push({
        key: "freebet",
        label: "Freebet",
        values: FREEBET_FILTER_TYPES,
      });
    }

    return options;
  }

  if (type === "Cassino") {
    options.push({
      key: "casino",
      label: "Cassino",
      values: [...CASINO_PROCEDURE_TYPES],
    });
    return options;
  }

  options.push({
    key: type,
    label: PROCEDURE_TYPE_LABELS[type] ?? type,
    values: [type],
  });

  return options;
}, []);

function getProcedureStatusLabel(status: string | null | undefined) {
  return status?.trim() || PROCEDURE_STATUS_DONE;
}

function getProcedureTypeLabel(type: string) {
  return PROCEDURE_TYPE_LABELS[type] ?? type;
}

function hasProcedureScopeResult(procedure: ProcedureRow, scope: string) {
  return (procedure.resultados ?? []).some((result) => result.escopo === scope);
}

function ProcedureStatusToggle({ procedure }: { procedure: ProcedureRow }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [status, setStatus] = useOptimistic(
    getProcedureStatusLabel(procedure.status_procedimento),
  );
  const done = status === PROCEDURE_STATUS_DONE;
  const toneClass = done
    ? "border-[rgba(73,212,166,0.2)] bg-[rgba(73,212,166,0.12)] text-[var(--positive)]"
    : "border-[rgba(255,190,115,0.2)] bg-[rgba(255,190,115,0.12)] text-[var(--warning)]";
  const baseClass = `inline-flex rounded-full border px-3 py-1 text-xs font-medium ${toneClass}`;

  if (isFreebetProcedure(procedure.tipo_procedimento)) {
    return <span className={baseClass}>{status}</span>;
  }

  function requestToggle() {
    const isCasino =
      procedure.tipo_procedimento === "Cassino" ||
      (CASINO_PROCEDURE_TYPES as readonly string[]).includes(
        procedure.tipo_procedimento,
      );
    const hasResult = hasProcedureScopeResult(procedure, "sports");
    const needsConfirmation = !isCasino && (done ? hasResult : !hasResult);

    if (needsConfirmation) {
      setConfirmOpen(true);
      return;
    }

    applyToggle();
  }

  function applyToggle() {
    const next = done ? PROCEDURE_STATUS_PENDING : PROCEDURE_STATUS_DONE;
    setConfirmOpen(false);

    startTransition(async () => {
      setStatus(next);
      try {
        await updateProcedureStatusAction(procedure.id, next);
        router.refresh();
      } catch {
        showToast({
          title: "Não foi possível alterar o status.",
          tone: "error",
        });
      }
    });
  }

  return (
    <span data-procedure-row-action onClick={(event) => event.stopPropagation()}>
      <span
        aria-disabled={isPending}
        className={`${baseClass} cursor-pointer select-none transition hover:brightness-125 ${
          isPending ? "opacity-60" : ""
        }`}
        onClick={() => {
          if (!isPending) {
            requestToggle();
          }
        }}
        title="Clique para alterar o status"
      >
        {status}
      </span>

      <ConfirmationDialog
        centered
        description={
          done
            ? "Este procedimento já tem resultado selecionado. Deseja voltar o status para pendente mesmo assim?"
            : "Este procedimento ainda não tem resultado selecionado. Deseja marcar como concluído mesmo assim?"
        }
        icon={
          done ? (
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(255,190,115,0.25)] bg-[rgba(255,190,115,0.12)] text-[var(--warning)]">
              <Clock aria-hidden="true" className="h-6 w-6" />
            </span>
          ) : (
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(73,212,166,0.25)] bg-[rgba(73,212,166,0.12)] text-[var(--positive)]">
              <CheckCircle2 aria-hidden="true" className="h-6 w-6" />
            </span>
          )
        }
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title={done ? "Voltar para pendente?" : "Concluir sem resultado?"}
      >
        <div className="grid grid-cols-2 gap-2">
          <button
            className="lz-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold"
            onClick={() => setConfirmOpen(false)}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="lz-button-primary rounded-full px-4 py-2.5 text-sm font-semibold"
            onClick={applyToggle}
            type="button"
          >
            {done ? "Marcar pendente" : "Marcar concluído"}
          </button>
        </div>
      </ConfirmationDialog>
    </span>
  );
}

function normalizeMoney(value: number) {
  return Object.is(value, -0) || Math.abs(value) < 0.005 ? 0 : value;
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      "a, button, input, select, textarea, [role='button'], [role='switch'], [data-procedure-row-action]",
    ),
  );
}

function setRepeatedParam(params: URLSearchParams, key: string, values: string[]) {
  params.delete(key);

  for (const value of values) {
    const normalized = value.trim();

    if (normalized) {
      params.append(key, normalized);
    }
  }
}

function setSingleParam(params: URLSearchParams, key: string, value: string) {
  const normalized = value.trim();

  if (normalized) {
    params.set(key, normalized);
  } else {
    params.delete(key);
  }
}

export function ProceduresWorkspace({
  bookmakers,
  filters,
  pagination,
  partners,
  procedures,
}: ProceduresWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [housesOpen, setHousesOpen] = useState(false);
  const [houseSearch, setHouseSearch] = useState("");
  const searchDebounceRef = useRef<number | null>(null);
  const housesTriggerRef = useRef<HTMLButtonElement>(null);
  const housesPopoverRef = useRef<HTMLDivElement>(null);
  const [housesPopoverPosition, setHousesPopoverPosition] = useState({
    left: 16,
    top: 16,
    width: 320,
  });
  const deferredHouseSearch = useDeferredValue(houseSearch);
  const normalizedHouseSearch = deferredHouseSearch.trim().toLowerCase();
  const selectedTypes = filters.types;
  const selectedHouses = filters.houses;
  const selectedStatuses = filters.statuses;
  const selectedMultiples = filters.multiples;
  const selectedPartners = filters.partners;
  const dateFrom = filters.dateFrom;
  const dateTo = filters.dateTo;
  const sharedProcedureParam = searchParams.get(PROCEDURE_SHARE_PARAM) ?? "";
  const sharedProcedureValues = sharedProcedureParam
    ? decodeProcedureSharePayload(sharedProcedureParam)
    : null;
  const visibleBookmakers = bookmakers.filter((bookmaker) =>
    bookmaker.toLowerCase().includes(normalizedHouseSearch),
  );
  const procedureRows = procedures;
  const [sharedModalOpen, setSharedModalOpen] = useState(
    Boolean(sharedProcedureValues),
  );

  const replaceWithParams = useCallback(
    (params: URLSearchParams) => {
      const query = params.toString();

      startTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname, {
          scroll: false,
        });
      });
    },
    [pathname, router],
  );

  const updateParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      replaceWithParams(params);
    },
    [replaceWithParams, searchParams],
  );

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current !== null) {
        window.clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!housesOpen) {
      return;
    }

    function syncPosition() {
      const rect = housesTriggerRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      const nextWidth = clamp(Math.max(rect.width, 320), 320, 420);
      setHousesPopoverPosition({
        left: clamp(rect.left, 16, window.innerWidth - nextWidth - 16),
        top: rect.bottom + 12,
        width: nextWidth,
      });
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (
        housesTriggerRef.current?.contains(target) ||
        housesPopoverRef.current?.contains(target)
      ) {
        return;
      }

      setHousesOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setHousesOpen(false);
      }
    }

    const animationFrame = window.requestAnimationFrame(syncPosition);
    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", syncPosition, true);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, true);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [housesOpen]);

  const hasSearchFilter = filters.searchText.trim().length > 0;
  const activeFiltersCount =
    selectedTypes.length +
    selectedHouses.length +
    selectedStatuses.length +
    selectedMultiples.length +
    selectedPartners.length +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0);
  const hasAnyFilter = hasSearchFilter || activeFiltersCount > 0;
  const isEmptyWorkspace = !hasAnyFilter && pagination.totalItems === 0;
  const firstVisibleItem =
    pagination.totalItems === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const lastVisibleItem = Math.min(
    pagination.page * pagination.pageSize,
    pagination.totalItems,
  );

  const filtersQuery = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    params.delete(PROCEDURE_SHARE_PARAM);
    return params.toString();
  }, [searchParams]);
  const screenFilterState = useMemo(() => ({ query: filtersQuery }), [filtersQuery]);
  const applyScreenFilters = useCallback(
    (filters: Partial<{ query: string }>) => {
      if (typeof filters.query !== "string" || !filters.query) {
        return;
      }

      const current = new URLSearchParams(window.location.search);
      current.delete("page");
      current.delete(PROCEDURE_SHARE_PARAM);

      if (current.toString()) {
        return;
      }

      startTransition(() => {
        router.replace(`${pathname}?${filters.query}`, { scroll: false });
      });
    },
    [pathname, router],
  );
  useScreenFilters({
    apply: applyScreenFilters,
    screen: "procedimentos",
    state: screenFilterState,
    withPreset: false,
  });

  function updateRepeatedFilter(key: string, values: string[]) {
    updateParams((params) => {
      setRepeatedParam(params, key, values);
      params.delete("page");
    });
  }

  function toggleFilterValue(key: string, value: string, currentValues: string[]) {
    updateRepeatedFilter(
      key,
      currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value],
    );
  }

  function updateDateFilter(key: "from" | "to", value: string) {
    updateParams((params) => {
      setSingleParam(params, key, value);
      params.delete("page");
    });
  }

  function updateSearchFilter(value: string) {
    if (searchDebounceRef.current !== null) {
      window.clearTimeout(searchDebounceRef.current);
    }

    searchDebounceRef.current = window.setTimeout(() => {
      updateParams((params) => {
        setSingleParam(params, "q", value);
        params.delete("page");
      });
    }, 300);
  }

  function clearFilters() {
    if (searchDebounceRef.current !== null) {
      window.clearTimeout(searchDebounceRef.current);
    }

    updateParams((params) => {
      for (const key of ["q", "type", "house", "status", "multiple", "partner", "from", "to", "page"]) {
        params.delete(key);
      }
    });
  }

  function goToPage(page: number) {
    updateParams((params) => {
      if (page <= 1) {
        params.delete("page");
      } else {
        params.set("page", String(page));
      }
    });
  }

  function handleProcedureClick(
    event: ReactMouseEvent<HTMLElement>,
    procedureId: number,
  ) {
    if (isInteractiveTarget(event.target)) {
      return;
    }

    requestProcedureEdit(procedureId);
  }

  function handleProcedureContextMenu(
    event: ReactMouseEvent<HTMLElement>,
    procedureId: number,
  ) {
    event.preventDefault();
    requestProcedureMenu(procedureId, event.clientX, event.clientY);
  }

  return (
    <div className="space-y-5">
      {sharedProcedureValues ? (
        <ProcedureModal
          bookmakers={bookmakers}
          defaultValues={sharedProcedureValues}
          hideTrigger
          onOpenChange={(nextOpen) => {
            setSharedModalOpen(nextOpen);

            if (!nextOpen) {
              updateParams((params) => {
                params.delete(PROCEDURE_SHARE_PARAM);
              });
            }
          }}
          open={sharedModalOpen}
          returnTo="/procedimentos"
          submitLabel="Criar procedimento"
          title="Novo procedimento"
        />
      ) : null}

      <div className="lz-panel flex flex-col gap-3 rounded-[28px] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3">
          <div className="w-full min-w-0 sm:w-auto sm:min-w-[220px] sm:flex-1">
            <input
              className="lz-input h-13 w-full rounded-full px-5 text-sm"
              defaultValue={filters.searchText}
              key={filters.searchText}
              maxLength={80}
              onChange={(event) => updateSearchFilter(event.target.value)}
              placeholder="Buscar evento, tipo ou casa..."
              type="search"
            />
          </div>

          <button
            className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition sm:py-3 ${
              filtersOpen || activeFiltersCount > 0 ? "lz-button-primary" : "lz-button-secondary"
            }`}
            onClick={() => setFiltersOpen((current) => !current)}
            type="button"
          >
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
            <span>Filtros</span>
          </button>

          <div className="flex flex-wrap gap-2">
            {PROCEDURE_STATUSES.map((status) => {
              const active = selectedStatuses.includes(status);

              return (
                <button
                  className={`rounded-full px-4 py-2.5 text-sm font-medium transition sm:py-3 ${
                    active ? "lz-button-primary" : "lz-button-secondary"
                  }`}
                  key={`quick-status-${status}`}
                  onClick={() =>
                    toggleFilterValue("status", status, selectedStatuses)
                  }
                  type="button"
                >
                  {status}
                </button>
              );
            })}
          </div>

          {hasAnyFilter ? (
            <button
              className="inline-flex items-center gap-1.5 text-sm text-[var(--text-dim)] transition hover:text-white"
              onClick={clearFilters}
              type="button"
            >
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
              <span>Limpar filtros</span>
            </button>
          ) : null}

        </div>

        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
          {isPending ? (
            <span className="self-center text-sm text-[var(--text-dim)]">
              Atualizando...
            </span>
          ) : null}

          <ProcedureModal
            bookmakers={bookmakers}
            returnTo="/procedimentos"
            triggerClassName="lz-button-primary w-full rounded-full px-4 py-3 text-sm font-semibold sm:w-auto"
            triggerLabel="Novo procedimento"
          />
        </div>
      </div>

      {filtersOpen ? (
        <div className="lz-panel grid gap-4 overflow-visible rounded-[28px] p-4 lg:grid-cols-[minmax(260px,420px)_auto_1fr]">
          <div className="min-w-0 space-y-3 lg:order-1 lg:col-span-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-white">Tipos</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {PROCEDURE_TYPE_FILTER_OPTIONS.map((option) => {
                const active =
                  option.values.length === 1
                    ? selectedTypes.includes(option.values[0] ?? "")
                    : option.values.every((value) => selectedTypes.includes(value));

                return (
                  <button
                    className={`rounded-full px-3 py-2 text-sm transition ${
                      active ? "lz-button-primary" : "lz-button-secondary"
                    }`}
                    key={option.key}
                    onClick={() => {
                      if (active) {
                        updateRepeatedFilter(
                          "type",
                          selectedTypes.filter(
                            (type) => !option.values.includes(type),
                          ),
                        );
                        return;
                      }

                      updateRepeatedFilter("type", [
                        ...selectedTypes,
                        ...option.values.filter(
                          (value) => !selectedTypes.includes(value),
                        ),
                      ]);
                    }}
                    type="button"
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 space-y-3 lg:order-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-white">Status</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {PROCEDURE_STATUSES.map((status) => {
                const active = selectedStatuses.includes(status);

                return (
                  <button
                    className={`rounded-full px-3 py-2 text-sm transition ${
                      active ? "lz-button-primary" : "lz-button-secondary"
                    }`}
                    key={status}
                    onClick={() =>
                      toggleFilterValue("status", status, selectedStatuses)
                    }
                    type="button"
                  >
                    {status}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 space-y-3 lg:order-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-white">Resultados múltiplos</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {MULTIPLE_OPTIONS.map((option) => {
                const active = selectedMultiples.includes(option.value);

                return (
                  <button
                    className={`rounded-full px-3 py-2 text-sm transition ${
                      active ? "lz-button-primary" : "lz-button-secondary"
                    }`}
                    key={option.value}
                    onClick={() =>
                      toggleFilterValue("multiple", option.value, selectedMultiples)
                    }
                    type="button"
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {partners.length ? (
            <div className="min-w-0 space-y-3 lg:order-3">
              <p className="text-sm font-medium text-white">Parceiros</p>
              <div className="flex flex-wrap gap-2">
                {[{ value: "me", label: "Eu" }, ...partners.map((partner) => ({
                  value: String(partner.id),
                  label: partner.name,
                }))].map((option) => {
                  const active = selectedPartners.includes(option.value);

                  return (
                    <button
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm transition ${
                        active ? "lz-button-primary" : "lz-button-secondary"
                      }`}
                      key={option.value}
                      onClick={() =>
                        toggleFilterValue("partner", option.value, selectedPartners)
                      }
                      type="button"
                    >
                      {option.value === "me" ? null : (
                        <UserRound aria-hidden="true" className="h-3.5 w-3.5" />
                      )}
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="min-w-0 space-y-3 lg:order-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-white">Casas</p>
            </div>

            <div className={housesOpen ? "z-30" : "z-10"}>
              <button
                className="lz-button-secondary w-full rounded-2xl px-4 py-3 text-left text-sm"
                onClick={() => setHousesOpen((current) => !current)}
                ref={housesTriggerRef}
                type="button"
              >
                {selectedHouses.length > 0
                  ? `${selectedHouses.length} casa(s) selecionada(s)`
                  : "Selecionar casas"}
              </button>

              {housesOpen && typeof document !== "undefined"
                ? createPortal(
                    <div
                      className="fixed z-[70] rounded-[26px] border border-white/10 bg-[rgba(17,8,14,0.98)] p-3 shadow-[0_24px_60px_rgba(0,0,0,0.4)] backdrop-blur-2xl"
                      ref={housesPopoverRef}
                      style={{
                        left: housesPopoverPosition.left,
                        top: housesPopoverPosition.top,
                        width: housesPopoverPosition.width,
                      }}
                    >
                  <div className="relative">
                    <Search
                      aria-hidden="true"
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]"
                    />
                    <input
                      className="lz-input w-full rounded-2xl py-3 pl-10 pr-3 text-sm"
                      onChange={(event) => setHouseSearch(event.target.value)}
                      placeholder="Buscar casa..."
                      type="search"
                      value={houseSearch}
                    />
                  </div>

                  <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
                    {visibleBookmakers.length > 0 ? (
                      visibleBookmakers.map((bookmaker) => {
                        const active = selectedHouses.includes(bookmaker);

                        return (
                          <button
                            className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm transition ${
                              active ? "lz-button-primary" : "lz-button-secondary"
                            }`}
                            key={bookmaker}
                            onClick={() =>
                              toggleFilterValue("house", bookmaker, selectedHouses)
                            }
                            type="button"
                          >
                            <span>{bookmaker}</span>
                            {active ? <span>Selecionada</span> : null}
                          </button>
                        );
                      })
                    ) : (
                      <p className="px-1 py-2 text-sm text-[var(--text-muted)]">
                        Nenhuma casa encontrada.
                      </p>
                    )}
                  </div>
                    </div>,
                    document.body,
                  )
                : null}

              {selectedHouses.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedHouses.map((house) => (
                    <button
                      className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[var(--text-secondary)] transition hover:border-white/20"
                      key={house}
                      onClick={() => toggleFilterValue("house", house, selectedHouses)}
                      type="button"
                    >
                      {house}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="min-w-0 space-y-3 lg:order-4 lg:col-span-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-white">Período</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <label className="space-y-2 text-sm">
                <span className="text-[var(--text-muted)]">De</span>
                <DatePickerField
                  onChange={(value) => updateDateFilter("from", value)}
                  value={dateFrom}
                />
              </label>

              <label className="space-y-2 text-sm">
                <span className="text-[var(--text-muted)]">Até</span>
                <DatePickerField
                  onChange={(value) => updateDateFilter("to", value)}
                  value={dateTo}
                />
              </label>
            </div>
          </div>
        </div>
      ) : null}

      <div className="lz-panel rounded-[30px] p-4 md:p-6">
        {procedureRows.length === 0 ? (
          <EmptyState
            action={
              isEmptyWorkspace ? (
                <ProcedureModal
                  bookmakers={bookmakers}
                  returnTo="/procedimentos"
                  triggerClassName="lz-button-primary rounded-full px-4 py-3 text-sm font-semibold"
                  triggerLabel="Registrar primeiro procedimento"
                />
              ) : null
            }
            description={
              isEmptyWorkspace
                ? "Assim que você registrar a primeira operação, esta área passa a mostrar a linha do tempo completa."
                : "Ajuste a busca ou limpe os filtros para voltar a visualizar os procedimentos."
            }
            eyebrow={isEmptyWorkspace ? "Primeiros passos" : "Sem resultados"}
            title={
              isEmptyWorkspace
                ? "Nenhum procedimento registrado"
                : "Nenhum procedimento encontrado"
            }
          />
        ) : (
          <>
            <div className="grid gap-4 md:hidden">
              {procedureRows.map((procedure) => {
                const resultValue = normalizeMoney(procedure.lucro_real);

                return (
                <article
                  className="cursor-pointer rounded-[24px] border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/8"
                  key={procedure.id}
                  onClick={(event) => handleProcedureClick(event, procedure.id)}
                  onContextMenu={(event) =>
                    handleProcedureContextMenu(event, procedure.id)
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusTag>
                          {getProcedureTypeLabel(procedure.tipo_procedimento)}
                        </StatusTag>
                        {procedure.observacao?.trim() ? (
                          <span
                            className="h-2 w-2 rounded-full bg-[var(--accent-soft)]"
                            title="Com observação"
                          />
                        ) : null}
                      </div>
                      <div className="text-xs text-[var(--text-secondary)]">
                        <ProcedureDateDisplay compact procedure={procedure} />
                      </div>
                    </div>

                    <ProcedureRowActions bookmakers={bookmakers} procedure={procedure} />
                  </div>

                  <div className="mt-3 space-y-1.5 text-sm">
                    <p className="truncate font-medium text-white">
                      {procedure.jogo_time_pa || "Sem evento"}
                    </p>
                    <p className="text-[var(--text-secondary)]">
                      <ProcedureHousesDisplay procedure={procedure} />
                    </p>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                    <ProcedureStatusToggle procedure={procedure} />
                    <p className={`text-base font-semibold ${getProfitClass(resultValue)}`}>
                      {formatCurrency(resultValue)}
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
                    <th className="px-3 py-3 text-center font-medium">Data</th>
                    <th className="px-3 py-3 text-center font-medium">Tipo</th>
                    <th className="px-3 py-3 text-center font-medium">Evento</th>
                    <th className="px-3 py-3 text-center font-medium">Casas</th>
                    <th className="px-3 py-3 text-center font-medium">Status</th>
                    <th className="px-3 py-3 text-center font-medium">Resultado R$</th>
                    <th className="px-3 py-3 text-center font-medium">
                      <span className="sr-only">Acoes</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {procedureRows.map((procedure) => {
                    const resultValue = normalizeMoney(procedure.lucro_real);

                    return (
                    <tr
                      className="cursor-pointer border-b border-white/8 align-middle transition hover:bg-white/4"
                      key={procedure.id}
                      onClick={(event) => handleProcedureClick(event, procedure.id)}
                      onContextMenu={(event) =>
                        handleProcedureContextMenu(event, procedure.id)
                      }
                    >
                      <td className="px-3 py-4 text-center text-[var(--text-secondary)]">
                        <ProcedureDateDisplay procedure={procedure} />
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            <StatusTag>
                              {getProcedureTypeLabel(procedure.tipo_procedimento)}
                            </StatusTag>
                          {procedure.observacao?.trim() ? (
                            <span className="h-2 w-2 rounded-full bg-[var(--accent-soft)]" />
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-center text-white">
                        {procedure.jogo_time_pa || "-"}
                      </td>
                      <td className="px-3 py-4 text-center text-[var(--text-secondary)]">
                        <ProcedureHousesDisplay procedure={procedure} />
                      </td>
                      <td className="px-3 py-4 text-center">
                        <ProcedureStatusToggle procedure={procedure} />
                      </td>
                      <td
                        className={`px-3 py-4 text-center font-semibold ${getProfitClass(resultValue)}`}
                      >
                        {formatCurrency(resultValue)}
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex justify-center">
                          <ProcedureRowActions
                            bookmakers={bookmakers}
                            procedure={procedure}
                          />
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-4 text-sm text-[var(--text-secondary)] sm:flex-row sm:items-center sm:justify-between">
              <span>
                Mostrando {firstVisibleItem}-{lastVisibleItem} de{" "}
                {pagination.totalItems} procedimentos
              </span>

              <div className="flex items-center gap-2">
                <button
                  className="lz-button-secondary rounded-full px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={pagination.page <= 1 || isPending}
                  onClick={() => goToPage(pagination.page - 1)}
                  type="button"
                >
                  Anterior
                </button>
                <span className="px-2">
                  Pagina {pagination.page} de {pagination.pageCount}
                </span>
                <button
                  className="lz-button-secondary rounded-full px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={pagination.page >= pagination.pageCount || isPending}
                  onClick={() => goToPage(pagination.page + 1)}
                  type="button"
                >
                  Proxima
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
