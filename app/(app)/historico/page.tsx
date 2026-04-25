import { getHistoryPageData } from "@/lib/server/app-data";

import { VerticalBarChart } from "../_components/charts";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  formatCurrency,
  formatNumber,
} from "../_components/ui";

export default async function HistoryPage() {
  const data = await getHistoryPageData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Historico"
        description="Leitura cronologica da operacao para revisar ritmo, meses e ultimos lancamentos."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Meses com movimento"
          value={formatNumber(data.summary.totalMonths)}
          helper="Quantidade de meses com registros"
        />
        <StatCard
          label="Registros totais"
          value={formatNumber(data.summary.totalProcedures)}
          helper="Volume geral do historico"
        />
        <StatCard
          label="Lucro acumulado"
          value={formatCurrency(data.summary.totalProfit)}
          helper="Soma do lucro real de toda a timeline"
        />
        <StatCard
          label="Ultimo mes"
          value={data.summary.latestMonth?.label ?? "-"}
          helper={
            data.summary.latestMonth
              ? formatCurrency(data.summary.latestMonth.value)
              : "Sem movimentacao ainda"
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr,1.1fr]">
        <SectionCard
          title="Meses recentes"
          description="Grafico de leitura rapida para acompanhar a evolucao mensal."
        >
          <VerticalBarChart
            data={data.monthlyProfit.map((item) => ({
              label: item.label,
              value: item.value,
              detail: `${formatNumber(item.count)} registros`,
            }))}
            formatValue={formatCurrency}
          />
        </SectionCard>

        <SectionCard
          title="Timeline recente"
          description="Ultimos lancamentos em ordem cronologica reversa."
        >
          {data.timeline.length === 0 ? (
            <EmptyState
              title="Sem historico ainda"
              description="Quando os primeiros registros entrarem, a timeline sera exibida aqui."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-neutral-500">
                  <tr className="border-b border-neutral-200">
                    <th className="px-0 py-3 font-medium">Data</th>
                    <th className="px-0 py-3 font-medium">Mes</th>
                    <th className="px-0 py-3 font-medium">Tipo</th>
                    <th className="px-0 py-3 font-medium">Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  {data.timeline.map((procedure) => (
                    <tr className="border-b border-neutral-100 last:border-b-0" key={procedure.id}>
                      <td className="px-0 py-3 text-neutral-700">{procedure.data_operacao}</td>
                      <td className="px-0 py-3 text-neutral-700">{procedure.mes_referencia}</td>
                      <td className="px-0 py-3 font-medium text-neutral-900">
                        {procedure.tipo_procedimento}
                      </td>
                      <td className="px-0 py-3 text-neutral-900">
                        {formatCurrency(procedure.lucro_real)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Resumo por mes"
        description="Agrupamento dos meses mais recentes com contagem de registros e lucro."
      >
        {data.monthGroups.length === 0 ? (
          <EmptyState
            title="Nenhum mes disponivel"
            description="O resumo mensal sera montado automaticamente quando houver dados."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.monthGroups.map((month) => (
              <div className="rounded-2xl bg-neutral-100 p-4" key={month.label}>
                <p className="text-sm font-medium text-neutral-900">{month.label}</p>
                <p className="mt-2 text-xl font-semibold text-neutral-950">
                  {formatCurrency(month.value)}
                </p>
                <p className="mt-1 text-sm text-neutral-600">
                  {formatNumber(month.count)} registros no periodo
                </p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
