"use client";

import { useState } from "react";

import { LineChart, VerticalBarChart } from "../_components/charts";
import { SectionCard, formatCurrency, formatNumber } from "../_components/ui";

type ChartItem = {
  label: string;
  value: number;
  detail?: string;
};

type DashboardMetrics = {
  todayProfit: number;
  monthlyProfit: number;
  dailyAverage: number;
  averagePerProcedure: number;
  proceduresToday: number;
  todayLabel: string;
  referenceMonth: string;
  referenceMonthLabel: string;
  monthlyProcedureCount: number;
  activeDays: number;
};

type DashboardView = {
  metrics: DashboardMetrics;
  monthlyEvolution: ChartItem[];
  dailyProfit: ChartItem[];
  dailyVolume: ChartItem[];
};

type DashboardData = {
  procedureFilters: string[];
  views: Record<string, DashboardView>;
  openFreebets: {
    openFreebets: number;
    openFreebetsReady: number;
    openFreebetsPending: number;
  };
  freebets: {
    collectedDaily: ChartItem[];
    convertedProfitDaily: ChartItem[];
  };
};

const DASHBOARD_TABS = [
  { id: "monthly", label: "Evolucao mensal" },
  { id: "daily-profit", label: "Lucro diario" },
  { id: "daily-volume", label: "Volume diario" },
  { id: "freebets", label: "Freebets" },
] as const;

type DashboardTabId = (typeof DASHBOARD_TABS)[number]["id"];

function DashboardMetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-3 py-2.5">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-neutral-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-neutral-950">
        {value}
      </p>
      {helper ? <p className="mt-1 text-xs text-neutral-500">{helper}</p> : null}
    </div>
  );
}

export function DashboardWorkspace({ data }: { data: DashboardData }) {
  const [activeTab, setActiveTab] = useState<DashboardTabId>("monthly");
  const [activeFreebetView, setActiveFreebetView] = useState<"collected" | "profit">(
    "collected",
  );
  const [selectedFilter, setSelectedFilter] = useState(
    data.procedureFilters[0] ?? "Todos",
  );

  const activeView = data.views[selectedFilter] ?? data.views.Todos;
  const metrics = activeView.metrics;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <DashboardMetricCard
          label="Lucro hoje"
          value={formatCurrency(metrics.todayProfit)}
          helper={metrics.todayLabel}
        />
        <DashboardMetricCard
          label="Lucro mensal"
          value={formatCurrency(metrics.monthlyProfit)}
          helper={metrics.referenceMonthLabel}
        />
        <DashboardMetricCard
          label="Media diaria"
          value={formatCurrency(metrics.dailyAverage)}
          helper={`${formatNumber(metrics.activeDays)} dias com operacao`}
        />
        <DashboardMetricCard
          label="Media por procedimento"
          value={formatCurrency(metrics.averagePerProcedure)}
          helper={`${formatNumber(metrics.monthlyProcedureCount)} procedimentos no mes`}
        />
        <DashboardMetricCard
          label="Procedimentos hoje"
          value={formatNumber(metrics.proceduresToday)}
        />
        <DashboardMetricCard
          label="Freebets em aberto"
          value={formatNumber(data.openFreebets.openFreebets)}
          helper={`${formatNumber(data.openFreebets.openFreebetsReady)} prontas / ${formatNumber(data.openFreebets.openFreebetsPending)} aguardando`}
        />
      </div>

      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          {DASHBOARD_TABS.map((tab) => (
            <button
              className={`rounded-xl border px-3 py-1.5 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "border-neutral-950 bg-neutral-950 text-white"
                  : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-950 hover:text-neutral-950"
              }`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab !== "freebets" ? (
          <div className="flex items-center gap-2">
            <label
              className="text-sm font-medium text-neutral-700"
              htmlFor="dashboard-procedure-filter"
            >
              Procedimento
            </label>
            <select
              className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-950 outline-none transition focus:border-neutral-950"
              id="dashboard-procedure-filter"
              onChange={(event) => setSelectedFilter(event.target.value)}
              value={selectedFilter}
            >
              {data.procedureFilters.map((filter) => (
                <option key={filter} value={filter}>
                  {filter}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {activeTab === "monthly" ? (
        <SectionCard
          title="Evolucao mensal"
          description={metrics.referenceMonthLabel}
        >
          <LineChart data={activeView.monthlyEvolution} />
        </SectionCard>
      ) : null}

      {activeTab === "daily-profit" ? (
        <SectionCard
          title="Lucro diario"
          description={metrics.referenceMonthLabel}
        >
          <VerticalBarChart
            data={activeView.dailyProfit}
            formatValue={formatCurrency}
          />
        </SectionCard>
      ) : null}

      {activeTab === "daily-volume" ? (
        <SectionCard
          title="Volume diario"
          description={metrics.referenceMonthLabel}
        >
          <VerticalBarChart
            data={activeView.dailyVolume}
            formatValue={(value) => `${formatNumber(value)} procedimentos`}
          />
        </SectionCard>
      ) : null}

      {activeTab === "freebets" ? (
        <SectionCard
          title="Metricas de Freebets"
          description={metrics.referenceMonthLabel}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  activeFreebetView === "collected"
                    ? "border-neutral-950 bg-neutral-950 text-white"
                    : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-950 hover:text-neutral-950"
                }`}
                onClick={() => setActiveFreebetView("collected")}
                type="button"
              >
                Quantidade coletada
              </button>
              <button
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                  activeFreebetView === "profit"
                    ? "border-neutral-950 bg-neutral-950 text-white"
                    : "border-neutral-300 bg-white text-neutral-600 hover:border-neutral-950 hover:text-neutral-950"
                }`}
                onClick={() => setActiveFreebetView("profit")}
                type="button"
              >
                Lucro
              </button>
            </div>

            <VerticalBarChart
              data={
                activeFreebetView === "collected"
                  ? data.freebets.collectedDaily
                  : data.freebets.convertedProfitDaily
              }
              formatValue={
                activeFreebetView === "collected"
                  ? (value) => `${formatNumber(value)} freebets`
                  : formatCurrency
              }
            />
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
