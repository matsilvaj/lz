import { getFreebetsPageData } from "@/lib/server/app-data";

import { PageHeader, StatCard, formatCurrency, formatNumber } from "../_components/ui";
import { FreebetsWorkspace } from "./freebets-workspace";

export default async function FreebetsPage() {
  const data = await getFreebetsPageData();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Freebets"
        description="Acompanhamento das pendencias, agrupamentos para conversao e historico das freebets utilizadas."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pendentes de confirmacao"
          value={formatNumber(data.summary.pendingConfirmationCount)}
          helper="Freebets que ainda dependem da resposta do resultado"
        />
        <StatCard
          label="Prontas para converter"
          value={formatNumber(data.summary.convertibleCount)}
          helper={formatCurrency(data.summary.convertibleValue)}
        />
        <StatCard
          label="Historico convertido"
          value={formatNumber(data.summary.convertedCount)}
          helper={`${formatCurrency(data.summary.convertedProfit)} de lucro historico`}
        />
        <StatCard
          label="Lucro potencial ativo"
          value={formatCurrency(data.summary.activeProfit)}
          helper="Somando agrupadas convertiveis e pendentes"
        />
      </div>

      <FreebetsWorkspace
        bookmakers={data.bookmakers}
        convertibleGroups={data.convertibleGroups}
        convertedHistory={data.convertedHistory}
        pendingConfirmation={data.pendingConfirmation}
      />
    </div>
  );
}
