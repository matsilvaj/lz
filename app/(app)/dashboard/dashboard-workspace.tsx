"use client";

import { useState } from "react";

import { LineChart, VerticalBarChart } from "../_components/charts";
import { LzSelect } from "../_components/lz-select";
import {
  SectionCard,
  formatCurrency,
  formatNumber,
} from "../_components/ui";

type ChartItem = {
  label: string;
  value: number;
  detail?: string;
  fullLabel?: string;
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
  { id: "monthly", label: "Evolução mensal" },
  { id: "daily-profit", label: "Lucro diário" },
  { id: "daily-volume", label: "Volume diário" },
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
    <div className="lz-panel-subtle rounded-[24px] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-white">{value}</p>
      {helper ? <p className="mt-2 text-sm text-[var(--text-muted)]">{helper}</p> : null}
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
    <div className="space-y-5">
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
          label="Média diária"
          value={formatCurrency(metrics.dailyAverage)}
          helper={`${formatNumber(metrics.activeDays)} dias com operação`}
        />
        <DashboardMetricCard
          label="Média por procedimento"
          value={formatCurrency(metrics.averagePerProcedure)}
          helper={`${formatNumber(metrics.monthlyProcedureCount)} procedimentos no mês`}
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

      <div className="lz-panel flex flex-col gap-3 rounded-[28px] px-4 py-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          {DASHBOARD_TABS.map((tab) => (
            <button
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "lz-button-primary"
                  : "lz-button-secondary"
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
          <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:flex-row sm:items-center">
            <label
              className="text-sm font-medium text-[var(--text-secondary)]"
              htmlFor="dashboard-procedure-filter"
            >
              Procedimento
            </label>
            <LzSelect
              className="w-full rounded-full px-4 py-2 text-sm sm:min-w-[240px]"
              id="dashboard-procedure-filter"
              onValueChange={setSelectedFilter}
              options={data.procedureFilters.map((filter) => ({
                value: filter,
                label: filter,
              }))}
              value={selectedFilter}
            />
          </div>
        ) : null}
      </div>

      {activeTab === "monthly" ? (
        <SectionCard
          title="Evolução mensal"
          description={metrics.referenceMonthLabel}
        >
          <LineChart data={activeView.monthlyEvolution} formatValue={formatCurrency} />
        </SectionCard>
      ) : null}

      {activeTab === "daily-profit" ? (
        <SectionCard
          title="Lucro diário"
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
          title="Volume diário"
          description={metrics.referenceMonthLabel}
        >
          <VerticalBarChart
            data={activeView.dailyVolume}
          />
        </SectionCard>
      ) : null}

      {activeTab === "freebets" ? (
        <SectionCard
          title="Métricas de Freebets"
          description={metrics.referenceMonthLabel}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button
                className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                  activeFreebetView === "collected"
                    ? "lz-button-primary"
                    : "lz-button-secondary"
                }`}
                onClick={() => setActiveFreebetView("collected")}
                type="button"
              >
                Quantidade coletada
              </button>
              <button
                className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                  activeFreebetView === "profit"
                    ? "lz-button-primary"
                    : "lz-button-secondary"
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
            />
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
