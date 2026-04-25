import { getDashboardData } from "@/lib/server/app-data";

import { HorizontalBarChart, VerticalBarChart } from "../_components/charts";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  formatCurrency,
  formatNumber,
} from "../_components/ui";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Visao geral da operacao com graficos, indicadores e atalhos para leitura rapida."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Lucro acumulado"
          value={formatCurrency(data.metrics.totalProfit)}
          helper={`${formatNumber(data.metrics.totalProcedures)} procedimentos registrados`}
        />
        <StatCard
          label="Freebets ativas"
          value={formatNumber(data.metrics.activeFreebetsCount)}
          helper={`${formatNumber(data.metrics.pendingConfirmations)} aguardando confirmacao`}
        />
        <StatCard
          label="Saldo em bancas"
          value={formatCurrency(data.metrics.totalBankBalance)}
          helper={`${formatNumber(data.metrics.totalBookmakers)} bancas cadastradas`}
        />
        <StatCard
          label="Historico de conversoes"
          value={formatNumber(data.metrics.convertedFreebetsCount)}
          helper={`${formatCurrency(data.metrics.convertedFreebetsProfit)} de lucro nas conversoes`}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr,0.95fr]">
        <SectionCard
          title="Lucro por mes"
          description="Resumo mensal do lucro real para acompanhar o ritmo da operacao."
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
          title="Procedimentos por tipo"
          description="Distribuicao atual dos lancamentos por categoria."
        >
          <HorizontalBarChart
            data={data.typeBreakdown.map((item) => ({
              label: item.label,
              value: item.count,
              detail: `${formatCurrency(item.profit)} de lucro`,
            }))}
            formatValue={(value) => `${formatNumber(value)} registros`}
          />
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <SectionCard
          title="Procedimentos recentes"
          description="Ultimos registros para validar rapidamente o que entrou na operacao."
        >
          {data.recentProcedures.length === 0 ? (
            <EmptyState
              title="Nenhum procedimento ainda"
              description="Assim que os lancamentos comecarem, eles vao aparecer aqui."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-neutral-500">
                  <tr className="border-b border-neutral-200">
                    <th className="px-0 py-3 font-medium">Data</th>
                    <th className="px-0 py-3 font-medium">Tipo</th>
                    <th className="px-0 py-3 font-medium">Casas</th>
                    <th className="px-0 py-3 font-medium">Lucro real</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentProcedures.map((procedure) => (
                    <tr className="border-b border-neutral-100 last:border-b-0" key={procedure.id}>
                      <td className="px-0 py-3 text-neutral-700">{procedure.data_operacao}</td>
                      <td className="px-0 py-3 font-medium text-neutral-900">
                        {procedure.tipo_procedimento}
                      </td>
                      <td className="px-0 py-3 text-neutral-700">
                        {procedure.casas_envolvidas || "-"}
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

        <SectionCard
          title="Bancas mais usadas"
          description="Ranking rapido para ajudar na leitura operacional."
        >
          <HorizontalBarChart
            data={data.bookmakerUsage.map((item) => ({
              label: item.label,
              value: item.value,
            }))}
            formatValue={(value) => `${formatNumber(value)} usos`}
          />
        </SectionCard>
      </div>
    </div>
  );
}
