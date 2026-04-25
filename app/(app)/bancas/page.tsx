import { getBookmakersPageData } from "@/lib/server/app-data";

import { HorizontalBarChart } from "../_components/charts";
import {
  EmptyState,
  PageHeader,
  SectionCard,
  StatCard,
  formatCurrency,
  formatNumber,
} from "../_components/ui";

export default async function BookmakersPage() {
  const data = await getBookmakersPageData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bancas"
        description="Saldos atuais e frequencia de uso das casas cadastradas na operacao."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Saldo total"
          value={formatCurrency(data.summary.totalBalance)}
          helper="Soma dos saldos cadastrados"
        />
        <StatCard
          label="Bancas cadastradas"
          value={formatNumber(data.summary.totalBookmakers)}
          helper="Quantidade de casas disponiveis"
        />
        <StatCard
          label="Maior saldo"
          value={formatCurrency(data.summary.topBalance?.saldo ?? 0)}
          helper={data.summary.topBalance?.nome ?? "Sem banca cadastrada"}
        />
        <StatCard
          label="Mais usada"
          value={data.summary.topUsage?.label ?? "-"}
          helper={
            data.summary.topUsage
              ? `${formatNumber(data.summary.topUsage.value)} usos`
              : "Sem historico suficiente"
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.05fr,0.95fr]">
        <SectionCard
          title="Saldos atuais"
          description="Leitura simples das casas e seus respectivos saldos."
        >
          {data.bookmakers.length === 0 ? (
            <EmptyState
              title="Nenhuma banca cadastrada"
              description="Cadastre as casas para acompanhar saldos e frequencia de uso."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-neutral-500">
                  <tr className="border-b border-neutral-200">
                    <th className="px-0 py-3 font-medium">Casa</th>
                    <th className="px-0 py-3 font-medium">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bookmakers.map((bookmaker) => (
                    <tr className="border-b border-neutral-100 last:border-b-0" key={bookmaker.nome}>
                      <td className="px-0 py-3 font-medium text-neutral-900">{bookmaker.nome}</td>
                      <td className="px-0 py-3 text-neutral-700">
                        {formatCurrency(bookmaker.saldo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Uso por banca"
          description="Ranking das casas mais presentes no historico de procedimentos."
        >
          <HorizontalBarChart
            data={data.usage.map((item) => ({
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
