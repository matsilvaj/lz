"use client";

import { useMemo, useState } from "react";

import { EmptyState, formatCurrency } from "../_components/ui";

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
};

function getProfitClass(value: number) {
  return value >= 0 ? "text-emerald-600" : "text-red-500";
}

export function HistoryWorkspace({
  months,
  operations,
}: HistoryWorkspaceProps) {
  const [selectedMonth, setSelectedMonth] = useState(months[0]?.value ?? "");

  const selectedMonthData = useMemo(
    () => months.find((month) => month.value === selectedMonth) ?? null,
    [months, selectedMonth],
  );

  const filteredOperations = useMemo(() => {
    if (!selectedMonth) {
      return operations;
    }

    return operations.filter(
      (operation) => String(operation.mes_referencia ?? "").trim() === selectedMonth,
    );
  }, [operations, selectedMonth]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <select
          className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium text-neutral-900 outline-none transition focus:border-neutral-950"
          onChange={(event) => setSelectedMonth(event.target.value)}
          value={selectedMonth}
        >
          {months.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white px-6 py-8 text-center">
        <p className="text-sm font-medium text-neutral-500">Lucro do mes</p>
        <p className={`mt-3 text-4xl font-semibold ${getProfitClass(selectedMonthData?.profit ?? 0)}`}>
          {formatCurrency(selectedMonthData?.profit ?? 0)}
        </p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 md:p-6">
        {filteredOperations.length === 0 ? (
          <EmptyState
            description="Quando houver operacoes neste periodo, elas aparecerao aqui."
            title="Nenhuma operacao encontrada"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full table-fixed text-center text-sm">
              <colgroup>
                <col className="w-[14%]" />
                <col className="w-[22%]" />
                <col className="w-[22%]" />
                <col className="w-[20%]" />
                <col className="w-[11%]" />
                <col className="w-[11%]" />
              </colgroup>
              <thead className="text-neutral-500">
                <tr className="border-b border-neutral-200">
                  <th className="px-2 py-3 font-medium">Data</th>
                  <th className="px-2 py-3 font-medium">Tipo</th>
                  <th className="px-2 py-3 font-medium">Jogo</th>
                  <th className="px-2 py-3 font-medium">Casas</th>
                  <th className="px-2 py-3 font-medium">Lucro Base</th>
                  <th className="px-2 py-3 font-medium">Lucro Final</th>
                </tr>
              </thead>
              <tbody>
                {filteredOperations.map((operation) => (
                  <tr className="border-b border-neutral-100 last:border-b-0" key={operation.id}>
                    <td className="px-2 py-4 text-neutral-700">{operation.data_operacao}</td>
                    <td className="px-2 py-4 font-medium text-neutral-900">
                      {operation.tipo_procedimento}
                    </td>
                    <td className="px-2 py-4 text-neutral-700">
                      {operation.jogo_time_pa || "-"}
                    </td>
                    <td className="px-2 py-4 text-neutral-700">
                      {operation.casas_envolvidas || "-"}
                    </td>
                    <td className={`px-2 py-4 ${getProfitClass(operation.lucro_final)}`}>
                      {formatCurrency(operation.lucro_final)}
                    </td>
                    <td className={`px-2 py-4 font-medium ${getProfitClass(operation.lucro_real)}`}>
                      {formatCurrency(operation.lucro_real)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
