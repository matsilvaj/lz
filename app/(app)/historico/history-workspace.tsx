"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useTransition } from "react";

import { LzSelect } from "../_components/lz-select";
import {
  EmptyState,
  StatusTag,
  formatCurrency,
} from "../_components/ui";

type HistoryMonth = {
  value: string;
  label: string;
  profit: number;
  count: number;
};

type HistoryOperation = {
  id: number;
  data_operacao: string;
  mes_referencia: string;
  tipo_procedimento: string;
  jogo_time_pa: string;
  casas_envolvidas: string;
  lucro_final: number;
  lucro_real: number;
};

type HistoryWorkspaceProps = {
  months: HistoryMonth[];
  operations: HistoryOperation[];
  selectedMonth: string;
};

function getProfitClass(value: number) {
  return value >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]";
}

function formatOperationCount(count: number) {
  return `${count} ${count === 1 ? "operação" : "operações"}`;
}

export function HistoryWorkspace({
  months,
  operations,
  selectedMonth,
}: HistoryWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

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

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="lz-panel rounded-[30px] px-6 py-8 text-center">
          <p className="text-sm font-medium text-[var(--text-dim)]">Lucro do mês</p>
          <p
            className={`mt-4 text-3xl font-semibold md:text-4xl ${getProfitClass(
              selectedMonthData?.profit ?? 0,
            )}`}
          >
            {formatCurrency(selectedMonthData?.profit ?? 0)}
          </p>
          <div className="mt-5 flex justify-center">
            <StatusTag tone={(selectedMonthData?.profit ?? 0) >= 0 ? "positive" : "negative"}>
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
              {operations.map((operation) => (
                <article
                  className="rounded-[26px] border border-white/10 bg-white/5 p-4"
                  key={operation.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                        {operation.data_operacao}
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {operation.tipo_procedimento}
                      </p>
                    </div>
                    <StatusTag>{operation.tipo_procedimento}</StatusTag>
                  </div>

                  <div className="mt-4 space-y-3 text-sm">
                    <div>
                      <p className="text-[var(--text-dim)]">Jogo</p>
                      <p className="mt-1 text-white">{operation.jogo_time_pa || "-"}</p>
                    </div>
                    <div>
                      <p className="text-[var(--text-dim)]">Casas</p>
                      <p className="mt-1 text-white">{operation.casas_envolvidas || "-"}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[22px] border border-white/10 bg-white/4 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">
                        Lucro base
                      </p>
                      <p
                        className={`mt-2 text-lg font-semibold ${getProfitClass(
                          operation.lucro_final,
                        )}`}
                      >
                        {formatCurrency(operation.lucro_final)}
                      </p>
                    </div>
                    <div className="rounded-[22px] border border-white/10 bg-white/4 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">
                        Lucro final
                      </p>
                      <p
                        className={`mt-2 text-lg font-semibold ${getProfitClass(
                          operation.lucro_real,
                        )}`}
                      >
                        {formatCurrency(operation.lucro_real)}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-sm">
                <thead className="text-[var(--text-dim)]">
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-3 text-center font-medium">Data</th>
                    <th className="px-3 py-3 text-center font-medium">Tipo</th>
                    <th className="px-3 py-3 text-center font-medium">Jogo</th>
                    <th className="px-3 py-3 text-center font-medium">Casas</th>
                    <th className="px-3 py-3 text-center font-medium">Lucro Base</th>
                    <th className="px-3 py-3 text-center font-medium">Lucro Final</th>
                  </tr>
                </thead>
                <tbody>
                  {operations.map((operation) => (
                    <tr
                      className="border-b border-white/8 transition hover:bg-white/4"
                      key={operation.id}
                    >
                      <td className="px-3 py-4 text-center text-[var(--text-secondary)]">
                        {operation.data_operacao}
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex justify-center">
                          <StatusTag>{operation.tipo_procedimento}</StatusTag>
                        </div>
                      </td>
                      <td className="px-3 py-4 text-center text-white">
                        {operation.jogo_time_pa || "-"}
                      </td>
                      <td className="px-3 py-4 text-center text-[var(--text-secondary)]">
                        {operation.casas_envolvidas || "-"}
                      </td>
                      <td className={`px-3 py-4 text-center ${getProfitClass(operation.lucro_final)}`}>
                        {formatCurrency(operation.lucro_final)}
                      </td>
                      <td
                        className={`px-3 py-4 text-center font-semibold ${getProfitClass(
                          operation.lucro_real,
                        )}`}
                      >
                        {formatCurrency(operation.lucro_real)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
