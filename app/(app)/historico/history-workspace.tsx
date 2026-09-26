"use client";

import { SlidersHorizontal, Star } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition, type KeyboardEvent } from "react";

import { PROCEDURE_STATUS_DONE, PROCEDURE_STATUSES } from "@/core";

import { ProcedureModal } from "../_components/procedure-modal";
import { MULTIPLE_OPTIONS } from "../_components/procedure-result-display";
import {
  ProcedureDateDisplay,
  ProcedureHousesDisplay,
} from "../_components/procedure-result-display";
import {
  FilterChip,
  FilterSection,
  FiltersDialog,
} from "../_components/filters-dialog";
import { MultiSelectFilter } from "../_components/multi-select-filter";
import { PeriodPicker, type PeriodOption } from "../_components/period-picker";
import { ProcedureFavoriteToggle } from "../_components/procedure-favorite-toggle";
import { PROCEDURE_TYPE_FILTER_OPTIONS } from "../_components/procedure-type-filters";
import { EmptyState, StatusTag, formatCurrency } from "../_components/ui";
import {
  buildProcedureDefaultValues,
  ProcedureRowActions,
} from "../procedimentos/procedure-row-actions";
import { isFreebetProcedure } from "@/lib/procedures";
import { getProfitClass } from "@/app/(app)/_components/ui";
import { PartnerFilterSelect } from "@/app/(app)/_components/partner-filter-select";
import type { PartnerOption } from "@/app/(app)/_components/partner-picker";

type HistoryEntry = {
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
};

type HistoryResult = {
  escopo: string;
  resultado_chave: string;
};

type HistoryOperation = {
  id: number;
  data_operacao: string;
  mes_referencia: string;
  tipo_procedimento: string;
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
  favorito?: boolean;
  entradas?: HistoryEntry[];
  resultados?: HistoryResult[];
};

type HistoryWorkspaceProps = {
  activePeriod: PeriodOption | null;
  bookmakers: string[];
  onlyFavorites: boolean;
  operations: HistoryOperation[];
  partners: PartnerOption[];
  periodOptions: PeriodOption[];
  selectedHouses: string[];
  selectedMultiples: string[];
  selectedPartners: string[];
  selectedPeriodId: string;
  selectedStatuses: string[];
  selectedTypes: string[];
};

const PROCEDURE_TYPE_LABELS: Record<string, string> = {
  "Tentativa de Duplo": "Tentativa de DG",
  "Coletar Freebet": "Freebet",
  "Converter Freebet": "Freebet",
};

function getProcedureTypeLabel(type: string) {
  return PROCEDURE_TYPE_LABELS[type] ?? type;
}

function getProcedureStatusLabel(status: string | null | undefined) {
  return status?.trim() || PROCEDURE_STATUS_DONE;
}

function getProcedureStatusTone(status: string) {
  return status === PROCEDURE_STATUS_DONE ? "positive" : "warning";
}

function normalizeMoney(value: number) {
  return Object.is(value, -0) || Math.abs(value) < 0.005 ? 0 : value;
}

function formatOperationCount(count: number) {
  return `${count} ${count === 1 ? "operação" : "operações"}`;
}

function getDisplayGame(operation: HistoryOperation) {
  if (isFreebetProcedure(operation.tipo_procedimento)) {
    return (
      operation.jogo_conversao_freebet?.trim() ||
      operation.jogo_time_pa?.trim() ||
      operation.jogo_coleta_freebet?.trim() ||
      "-"
    );
  }

  return operation.jogo_time_pa?.trim() || "-";
}

export function HistoryWorkspace({
  activePeriod,
  bookmakers,
  onlyFavorites,
  operations,
  partners,
  periodOptions,
  selectedHouses,
  selectedMultiples,
  selectedPartners,
  selectedPeriodId,
  selectedStatuses,
  selectedTypes,
}: HistoryWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [detailsOperation, setDetailsOperation] =
    useState<HistoryOperation | null>(null);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const periodSummary = useMemo(() => {
    const profit = operations.reduce(
      (total, operation) => total + normalizeMoney(operation.lucro_real ?? 0),
      0,
    );

    return { count: operations.length, profit: normalizeMoney(profit) };
  }, [operations]);
  const activeFiltersCount =
    selectedPartners.length +
    selectedTypes.length +
    selectedHouses.length +
    selectedStatuses.length +
    selectedMultiples.length +
    (onlyFavorites ? 1 : 0);

  function replaceParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);

    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    });
  }

  function updateSelectedPeriod(nextPeriodId: string) {
    replaceParams((params) => {
      params.delete("month");

      if (nextPeriodId) {
        params.set("period", nextPeriodId);
      } else {
        params.delete("period");
      }
    });
  }

  function updateRepeatedParam(key: string, values: string[]) {
    replaceParams((params) => {
      params.delete(key);

      for (const value of values) {
        params.append(key, value);
      }
    });
  }

  function updateSelectedPartners(nextPartners: string[]) {
    updateRepeatedParam("partner", nextPartners);
  }

  function toggleParamValue(key: string, value: string, currentValues: string[]) {
    updateRepeatedParam(
      key,
      currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value],
    );
  }

  function toggleOnlyFavorites() {
    replaceParams((params) => {
      if (onlyFavorites) {
        params.delete("favorites");
      } else {
        params.set("favorites", "1");
      }
    });
  }

  function clearFilters() {
    replaceParams((params) => {
      for (const key of ["partner", "type", "house", "status", "multiple", "favorites"]) {
        params.delete(key);
      }
    });
  }

  function openOperationDetails(operation: HistoryOperation) {
    setDetailsOperation(operation);
  }

  function handleOperationKeyDown(
    event: KeyboardEvent<HTMLElement>,
    operation: HistoryOperation,
  ) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    openOperationDetails(operation);
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="lz-panel rounded-[30px] px-6 py-8 text-center">
          <p className="text-sm font-medium text-[var(--text-dim)]">
            Resultado do período
          </p>
          <p
            className={`mt-4 text-3xl font-semibold md:text-4xl ${getProfitClass(
              periodSummary.profit,
            )}`}
          >
            {formatCurrency(periodSummary.profit)}
          </p>
          <div className="mt-5 flex justify-center">
            <StatusTag tone={periodSummary.profit >= 0 ? "positive" : "negative"}>
              {formatOperationCount(periodSummary.count)}
            </StatusTag>
          </div>
        </div>

        <div className="lz-panel space-y-3 rounded-[30px] p-5">
          <div className="space-y-2 text-sm">
            <span className="font-medium text-white">Período</span>
            <PeriodPicker
              currentPeriod={activePeriod}
              id="history-period-filter"
              onValueChange={updateSelectedPeriod}
              options={periodOptions}
              value={selectedPeriodId}
            />
          </div>

          <button
            className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition ${
              activeFiltersCount > 0 ? "lz-button-primary" : "lz-button-secondary"
            }`}
            onClick={() => setFiltersOpen(true)}
            type="button"
          >
            <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
            <span>Filtros</span>
            {activeFiltersCount > 0 ? <span>({activeFiltersCount})</span> : null}
          </button>

          {isPending ? (
            <span className="block text-xs text-[var(--text-dim)]">Atualizando...</span>
          ) : null}
        </div>
      </div>

      {filtersOpen ? (
        <FiltersDialog
          applyLabel="Ver resultados"
          onClose={() => setFiltersOpen(false)}
          onReset={clearFilters}
          title="Histórico"
        >
          <FilterSection title="Favoritos">
            <div className="flex flex-wrap gap-2">
              <FilterChip active={onlyFavorites} onClick={toggleOnlyFavorites}>
                <Star
                  aria-hidden="true"
                  className="h-3.5 w-3.5 text-amber-300"
                  fill={onlyFavorites ? "currentColor" : "none"}
                />
                Só favoritos
              </FilterChip>
            </div>
          </FilterSection>

          <FilterSection title="Tipos">
            <div className="flex flex-wrap gap-2">
              {PROCEDURE_TYPE_FILTER_OPTIONS.map((option) => {
                const active = option.values.every((value) =>
                  selectedTypes.includes(value),
                );

                return (
                  <FilterChip
                    active={active}
                    key={option.key}
                    onClick={() =>
                      updateRepeatedParam(
                        "type",
                        active
                          ? selectedTypes.filter(
                              (type) => !option.values.includes(type),
                            )
                          : [
                              ...selectedTypes,
                              ...option.values.filter(
                                (value) => !selectedTypes.includes(value),
                              ),
                            ],
                      )
                    }
                  >
                    {option.label}
                  </FilterChip>
                );
              })}
            </div>
          </FilterSection>

          <FilterSection title="Status">
            <div className="flex flex-wrap gap-2">
              {PROCEDURE_STATUSES.map((status) => (
                <FilterChip
                  active={selectedStatuses.includes(status)}
                  key={status}
                  onClick={() => toggleParamValue("status", status, selectedStatuses)}
                >
                  {status}
                </FilterChip>
              ))}
            </div>
          </FilterSection>

          <FilterSection title="Resultados múltiplos">
            <div className="flex flex-wrap gap-2">
              {MULTIPLE_OPTIONS.map((option) => (
                <FilterChip
                  active={selectedMultiples.includes(option.value)}
                  key={option.value}
                  onClick={() =>
                    toggleParamValue("multiple", option.value, selectedMultiples)
                  }
                >
                  {option.label}
                </FilterChip>
              ))}
            </div>
          </FilterSection>

          {partners.length ? (
            <FilterSection title="Parceiros">
              <PartnerFilterSelect
                inline
                onChange={updateSelectedPartners}
                partners={partners}
                value={selectedPartners}
              />
            </FilterSection>
          ) : null}

          <FilterSection
            title={selectedHouses.length ? `Casas (${selectedHouses.length})` : "Casas"}
          >
            <MultiSelectFilter
              allLabel="Todas as casas"
              inline
              onChange={(values) => updateRepeatedParam("house", values)}
              options={bookmakers.map((bookmaker) => ({
                label: bookmaker,
                value: bookmaker,
              }))}
              searchPlaceholder="Buscar casa..."
              value={selectedHouses}
            />
          </FilterSection>
        </FiltersDialog>
      ) : null}

      <div className="lz-panel rounded-[30px] p-4 md:p-6">
        {operations.length === 0 ? (
          <EmptyState
            action={
              <Link
                className="lz-button-secondary inline-flex rounded-full px-4 py-3 text-sm font-semibold"
                href="/procedimentos"
              >
                Registrar operação
              </Link>
            }
            description="Quando houver operações neste período, o histórico passa a organizar tudo de forma cronológica."
            eyebrow="Sem dados no período"
            title="Nenhuma operação encontrada"
          />
        ) : (
          <>
            <div className="grid gap-4 md:hidden">
              {operations.map((operation) => {
                const resultValue = normalizeMoney(operation.lucro_real);
                const statusLabel = getProcedureStatusLabel(
                  operation.status_procedimento,
                );

                return (
                  <article
                    className="cursor-pointer rounded-[24px] border border-white/10 bg-white/5 p-4 transition hover:bg-white/8 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(255,107,151,0.55)]"
                    key={operation.id}
                    onClick={() => openOperationDetails(operation)}
                    onKeyDown={(event) =>
                      handleOperationKeyDown(event, operation)
                    }
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusTag>
                            {getProcedureTypeLabel(operation.tipo_procedimento)}
                          </StatusTag>
                        </div>
                        <div className="text-xs text-[var(--text-secondary)]">
                          <ProcedureDateDisplay compact procedure={operation} />
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-1.5"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <ProcedureFavoriteToggle procedure={operation} />
                        <ProcedureRowActions
                          bookmakers={bookmakers}
                          onViewDetails={() => openOperationDetails(operation)}
                          procedure={operation}
                          returnTo="/historico"
                        />
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5 text-sm">
                      <p className="truncate font-medium text-white">
                        {getDisplayGame(operation) === "-"
                          ? "Sem evento"
                          : getDisplayGame(operation)}
                      </p>
                      <p className="text-[var(--text-secondary)]">
                        <ProcedureHousesDisplay procedure={operation} />
                      </p>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
                      <StatusTag tone={getProcedureStatusTone(statusLabel)}>
                        {statusLabel}
                      </StatusTag>
                      <p className={`text-base font-semibold ${getProfitClass(resultValue)}`}>
                        {formatCurrency(resultValue)}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[1080px] table-fixed text-sm">
                <colgroup>
                  <col className="w-[17%]" />
                  <col className="w-[12%]" />
                  <col className="w-[18%]" />
                  <col className="w-[20%]" />
                  <col className="w-[13%]" />
                  <col className="w-[13%]" />
                  <col className="w-[7%]" />
                </colgroup>
                <thead className="text-[var(--text-dim)]">
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-3 text-center font-medium">Data</th>
                    <th className="px-3 py-3 text-center font-medium">Tipo</th>
                    <th className="px-3 py-3 text-center font-medium">Evento</th>
                    <th className="px-3 py-3 text-center font-medium">Casas</th>
                    <th className="px-3 py-3 text-center font-medium">Status</th>
                    <th className="px-3 py-3 text-center font-medium">Resultado R$</th>
                    <th className="px-3 py-3 text-center font-medium">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {operations.map((operation) => {
                    const resultValue = normalizeMoney(operation.lucro_real);
                    const statusLabel = getProcedureStatusLabel(
                      operation.status_procedimento,
                    );

                    return (
                      <tr
                        className="cursor-pointer border-b border-white/8 transition hover:bg-white/4"
                        key={operation.id}
                        onClick={() => openOperationDetails(operation)}
                      >
                        <td className="px-3 py-4 text-center text-[var(--text-secondary)]">
                          <ProcedureDateDisplay procedure={operation} />
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex justify-center">
                            <StatusTag>
                              {getProcedureTypeLabel(operation.tipo_procedimento)}
                            </StatusTag>
                          </div>
                        </td>
                        <td className="px-3 py-4 text-center text-white">
                          <span className="block truncate">
                            {getDisplayGame(operation)}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-center text-[var(--text-secondary)]">
                          <span className="block truncate">
                            <ProcedureHousesDisplay procedure={operation} />
                          </span>
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
                          <div
                            className="flex items-center justify-center gap-1.5"
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <ProcedureFavoriteToggle procedure={operation} />
                            <ProcedureRowActions
                              bookmakers={bookmakers}
                              onViewDetails={() => openOperationDetails(operation)}
                              procedure={operation}
                              returnTo="/historico"
                            />
                          </div>
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

      {detailsOperation ? (
        <ProcedureModal
          bookmakers={bookmakers}
          defaultValues={buildProcedureDefaultValues(detailsOperation)}
          hideTrigger
          hideTypeSelector
          mode="edit"
          onOpenChange={(open) => {
            if (!open) {
              setDetailsOperation(null);
            }
          }}
          open
          procedureId={detailsOperation.id}
          readOnly
          returnTo="/historico"
          title="Detalhes do procedimento"
        />
      ) : null}
    </div>
  );
}
