"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition, type KeyboardEvent } from "react";

import { PROCEDURE_STATUS_DONE } from "@/core";

import { LzSelect } from "../_components/lz-select";
import { ProcedureModal } from "../_components/procedure-modal";
import {
  ProcedureDateDisplay,
  ProcedureHousesDisplay,
} from "../_components/procedure-result-display";
import { EmptyState, StatusTag, formatCurrency } from "../_components/ui";
import {
  buildProcedureDefaultValues,
  ProcedureRowActions,
} from "../procedimentos/procedure-row-actions";

type HistoryMonth = {
  value: string;
  label: string;
  profit: number;
  count: number;
};

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
  freebet_somente_lucro: boolean;
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
  entradas?: HistoryEntry[];
  resultados?: HistoryResult[];
};

type HistoryWorkspaceProps = {
  bookmakers: string[];
  months: HistoryMonth[];
  operations: HistoryOperation[];
  selectedMonth: string;
};

const PROCEDURE_TYPE_LABELS: Record<string, string> = {
  "Tentativa de Duplo": "Tentativa de DG",
  "Coletar Freebet": "Freebet",
  "Converter Freebet": "Freebet",
};

function getProfitClass(value: number) {
  return value >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]";
}

function getProcedureTypeLabel(type: string) {
  return PROCEDURE_TYPE_LABELS[type] ?? type;
}

function getProcedureStatusLabel(status: string | null | undefined) {
  return status?.trim() || PROCEDURE_STATUS_DONE;
}

function getProcedureStatusTone(status: string) {
  return status === PROCEDURE_STATUS_DONE ? "positive" : "warning";
}

function isFreebetProcedure(type: string) {
  return type === "Coletar Freebet" || type === "Converter Freebet";
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
  bookmakers,
  months,
  operations,
  selectedMonth,
}: HistoryWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [detailsOperation, setDetailsOperation] =
    useState<HistoryOperation | null>(null);

  const selectedMonthData = useMemo(
    () => months.find((month) => month.value === selectedMonth) ?? null,
    [months, selectedMonth],
  );

  function updateSelectedMonth(nextMonth: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (nextMonth) {
      params.set("month", nextMonth);
    } else {
      params.delete("month");
    }

    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
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
          <p className="text-sm font-medium text-[var(--text-dim)]">Resultado do mês</p>
          <p
            className={`mt-4 text-3xl font-semibold md:text-4xl ${getProfitClass(
              normalizeMoney(selectedMonthData?.profit ?? 0),
            )}`}
          >
            {formatCurrency(normalizeMoney(selectedMonthData?.profit ?? 0))}
          </p>
          <div className="mt-5 flex justify-center">
            <StatusTag
              tone={(selectedMonthData?.profit ?? 0) >= 0 ? "positive" : "negative"}
            >
              {formatOperationCount(selectedMonthData?.count ?? 0)}
            </StatusTag>
          </div>
        </div>

        <div className="lz-panel rounded-[30px] p-5">
          <label className="space-y-2 text-sm">
            <span className="font-medium text-white">Mês de referência</span>
            <LzSelect
              className="w-full rounded-2xl px-4 py-3 text-sm"
              onValueChange={updateSelectedMonth}
              options={months.map((month) => ({
                value: month.value,
                label: month.label,
              }))}
              value={selectedMonth}
            />
            {isPending ? (
              <span className="text-xs text-[var(--text-dim)]">Atualizando...</span>
            ) : null}
          </label>
        </div>
      </div>

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
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
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
                            className="flex justify-center"
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
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
