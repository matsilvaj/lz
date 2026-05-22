"use client";

import {
  PROCEDURE_STATUS_DONE,
  PROCEDURE_STATUSES,
  PROCEDURE_TYPES,
} from "@/core";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  type MouseEvent as ReactMouseEvent,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";

import { DatePickerField } from "../_components/date-picker-field";
import { ProcedureModal } from "../_components/procedure-modal";
import { EmptyState, StatusTag, formatCurrency } from "../_components/ui";
import {
  ProcedureRowActions,
  requestProcedureEdit,
  requestProcedureMenu,
} from "./procedure-row-actions";

type ProcedureRow = {
  id: number;
  data_operacao: string;
  tipo_procedimento: string;
  jogo_time_pa: string;
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
};

type ProceduresWorkspaceProps = {
  bookmakers: string[];
  filters: {
    searchText: string;
    types: string[];
    houses: string[];
    statuses: string[];
    dateFrom: string;
    dateTo: string;
  };
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

  options.push({
    key: type,
    label: PROCEDURE_TYPE_LABELS[type] ?? type,
    values: [type],
  });

  return options;
}, []);

function getProfitClass(value: number) {
  return value >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]";
}

function getProcedureStatusTone(status: string) {
  return status === PROCEDURE_STATUS_DONE ? "positive" : "warning";
}

function getProcedureStatusLabel(status: string | null | undefined) {
  return status?.trim() || PROCEDURE_STATUS_DONE;
}

function getProcedureTypeLabel(type: string) {
  return PROCEDURE_TYPE_LABELS[type] ?? type;
}

function normalizeMoney(value: number) {
  return Object.is(value, -0) || Math.abs(value) < 0.005 ? 0 : value;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
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
  const dateFrom = filters.dateFrom;
  const dateTo = filters.dateTo;
  const visibleBookmakers = bookmakers.filter((bookmaker) =>
    bookmaker.toLowerCase().includes(normalizedHouseSearch),
  );
  const procedureRows = procedures;

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
      for (const key of ["q", "type", "house", "status", "from", "to", "page"]) {
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
      <div className="lz-panel flex flex-col gap-3 rounded-[28px] p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          <input
            className="lz-input w-full rounded-2xl px-4 py-3 text-sm sm:max-w-xl"
            defaultValue={filters.searchText}
            key={filters.searchText}
            onChange={(event) => updateSearchFilter(event.target.value)}
            placeholder="Buscar jogo, tipo ou casa..."
            type="search"
          />

          <button
            className={`rounded-full px-4 py-3 text-sm font-medium transition ${
              filtersOpen || activeFiltersCount > 0 ? "lz-button-primary" : "lz-button-secondary"
            }`}
            onClick={() => setFiltersOpen((current) => !current)}
            type="button"
          >
            Filtros
          </button>

          <div className="flex flex-wrap gap-2">
            {PROCEDURE_STATUSES.map((status) => {
              const active = selectedStatuses.includes(status);

              return (
                <button
                  className={`rounded-full px-4 py-3 text-sm font-medium transition ${
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
              className="text-sm text-[var(--text-dim)] transition hover:text-white"
              onClick={clearFilters}
              type="button"
            >
              Limpar filtros
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {isPending ? (
            <span className="self-center text-sm text-[var(--text-dim)]">
              Atualizando...
            </span>
          ) : null}

          <ProcedureModal
            bookmakers={bookmakers}
            returnTo="/procedimentos"
            triggerClassName="lz-button-primary rounded-full px-4 py-3 text-sm font-semibold"
            triggerLabel="Novo procedimento"
          />
        </div>
      </div>

      {filtersOpen ? (
        <div className="lz-panel grid gap-4 overflow-visible rounded-[28px] p-4 lg:grid-cols-[minmax(260px,420px)_auto_1fr]">
          <div className="min-w-0 space-y-3 lg:order-1 lg:col-span-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-white">Tipos</p>
              {selectedTypes.length > 0 ? (
                <button
                  className="text-sm text-[var(--text-dim)] transition hover:text-white"
                  onClick={() => updateRepeatedFilter("type", [])}
                  type="button"
                >
                  Limpar
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {PROCEDURE_TYPE_FILTER_OPTIONS.map((option) => {
                const active = option.values.some((value) =>
                  selectedTypes.includes(value),
                );

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
              {selectedStatuses.length > 0 ? (
                <button
                  className="text-sm text-[var(--text-dim)] transition hover:text-white"
                  onClick={() => updateRepeatedFilter("status", [])}
                  type="button"
                >
                  Limpar
                </button>
              ) : null}
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

          <div className="min-w-0 space-y-3 lg:order-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-white">Casas</p>
              {selectedHouses.length > 0 ? (
                <button
                  className="text-sm text-[var(--text-dim)] transition hover:text-white"
                  onClick={() => updateRepeatedFilter("house", [])}
                  type="button"
                >
                  Limpar
                </button>
              ) : null}
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
                  <input
                    className="lz-input w-full rounded-2xl px-3 py-3 text-sm"
                    onChange={(event) => setHouseSearch(event.target.value)}
                    placeholder="Buscar casa..."
                    type="search"
                    value={houseSearch}
                  />

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
              {dateFrom || dateTo ? (
                <button
                  className="text-sm text-[var(--text-dim)] transition hover:text-white"
                  onClick={() => {
                    updateParams((params) => {
                      params.delete("from");
                      params.delete("to");
                      params.delete("page");
                    });
                  }}
                  type="button"
                >
                  Limpar
                </button>
              ) : null}
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
                const statusLabel = getProcedureStatusLabel(
                  procedure.status_procedimento,
                );

                return (
                <article
                  className="cursor-pointer rounded-[26px] border border-white/10 bg-white/5 p-4 transition hover:border-white/20 hover:bg-white/8"
                  key={procedure.id}
                  onClick={(event) => handleProcedureClick(event, procedure.id)}
                  onContextMenu={(event) =>
                    handleProcedureContextMenu(event, procedure.id)
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                        {procedure.data_operacao}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusTag>
                          {getProcedureTypeLabel(procedure.tipo_procedimento)}
                        </StatusTag>
                        {procedure.observacao?.trim() ? (
                          <StatusTag tone="warning">Com observação</StatusTag>
                        ) : null}
                      </div>
                    </div>

                    <ProcedureRowActions bookmakers={bookmakers} procedure={procedure} />
                  </div>

                  <div className="mt-4 space-y-3 text-sm">
                    <div>
                      <p className="text-[var(--text-dim)]">Jogo</p>
                      <p className="mt-1 text-white">{procedure.jogo_time_pa || "-"}</p>
                    </div>
                    <div>
                      <p className="text-[var(--text-dim)]">Casas</p>
                      <p className="mt-1 text-white">{procedure.casas_envolvidas || "-"}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[22px] border border-white/10 bg-white/4 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">
                        Status
                      </p>
                      <div className="mt-2">
                        <StatusTag tone={getProcedureStatusTone(statusLabel)}>
                          {statusLabel}
                        </StatusTag>
                      </div>
                    </div>
                    <div className="rounded-[22px] border border-white/10 bg-white/4 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">
                        Resultado R$
                      </p>
                      <p className={`mt-2 text-lg font-semibold ${getProfitClass(resultValue)}`}>
                        {formatCurrency(resultValue)}
                      </p>
                    </div>
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
                    <th className="px-3 py-3 text-center font-medium">Jogo</th>
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
                    const statusLabel = getProcedureStatusLabel(
                      procedure.status_procedimento,
                    );

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
                        {procedure.data_operacao}
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
                        {procedure.casas_envolvidas || "-"}
                      </td>
                      <td className="px-3 py-4 text-center">
                        <StatusTag tone={getProcedureStatusTone(statusLabel)}>
                          {statusLabel}
                        </StatusTag>
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
