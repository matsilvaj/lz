"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { redirectToLoginOnUnauthorized } from "@/lib/auth/client-redirect";

import { useToast } from "@/app/_components/toast-provider";

import { LzSelect } from "../_components/lz-select";
import {
  SectionCard,
  formatCurrency,
  formatNumber,
} from "../_components/ui";
import { PartnerFilterSelect } from "@/app/(app)/_components/partner-filter-select";
import type { PartnerOption } from "@/app/(app)/_components/partner-picker";

type ChartItem = {
  label: string;
  value: number;
  detail?: string;
  fullLabel?: string;
};

type DashboardMetrics = {
  todayProfit: number;
  periodProfit: number;
  dailyAverage: number;
  averagePerProcedure: number;
  proceduresToday: number;
  todayLabel: string;
  referenceLabel: string;
  referenceMonth: string;
  referenceMonthLabel: string;
  monthlyProcedureCount: number;
  procedureCount: number;
  activeDays: number;
};

type DashboardView = {
  metrics: DashboardMetrics;
  monthlyEvolution: ChartItem[];
  dailyProfit: ChartItem[];
  dailyVolume: ChartItem[];
};

import {
  buildCurrentReferenceMonthId,
  PeriodPicker,
  type PeriodOption,
} from "../_components/period-picker";

type DashboardPeriodOption = PeriodOption;

type DashboardData = {
  freebets: {
    collectedDaily: ChartItem[];
    convertedProfitDaily: ChartItem[];
  };
  pendingProcedures: {
    pendingAmount: number;
    pendingCount: number;
  };
  partners: PartnerOption[];
  period: DashboardPeriodOption;
  periodOptions: DashboardPeriodOption[];
  procedureFilters: string[];
  selectedPartners: string[];
  selectedPeriodId: string;
  views: Record<string, DashboardView>;
  openFreebets: {
    openFreebets: number;
    openFreebetsReady: number;
    openFreebetsReadyValue: number;
    openFreebetsPending: number;
  };
};

const DASHBOARD_TABS = [
  { id: "monthly", label: "Evolução" },
  { id: "daily-profit", label: "Lucro" },
  { id: "daily-volume", label: "Volume" },
  { id: "freebets", label: "Freebets" },
] as const;

type DashboardTabId = (typeof DASHBOARD_TABS)[number]["id"];

function pluralize(value: number, singular: string, plural: string) {
  return value === 1 ? singular : plural;
}

function ChartSkeleton() {
  return (
    <div className="h-[240px] rounded-[24px] border border-white/8 bg-white/4 p-4 sm:h-[280px] lg:h-[320px]">
      <div className="flex h-full items-end gap-2">
        {Array.from({ length: 14 }).map((_, index) => (
          <div
            className="flex-1 rounded-t-lg bg-white/8"
            key={index}
            style={{ height: `${28 + ((index * 17) % 58)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

const LineChart = dynamic(
  () => import("../_components/charts").then((module) => module.LineChart),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  },
);

const VerticalBarChart = dynamic(
  () => import("../_components/charts").then((module) => module.VerticalBarChart),
  {
    loading: () => <ChartSkeleton />,
    ssr: false,
  },
);

function getColorClass(value: number) {
  if (value > 0) return "text-[var(--positive)]";
  if (value < 0) return "text-[var(--negative)]";
  return "text-white";
}

function getPeriodUnitLabel(period: DashboardPeriodOption | undefined) {
  return ["day", "days", "range", "month"].includes(period?.type ?? "")
    ? "dias com operação"
    : "meses com operação";
}

function getAverageCardLabel(period: DashboardPeriodOption | undefined) {
  return ["day", "days", "range", "month"].includes(period?.type ?? "")
    ? "Média diária"
    : "Média mensal";
}

function getEvolutionTitle(period: DashboardPeriodOption | undefined) {
  if (period?.type === "day") return "Evolução do dia";
  if (period?.type === "days") return "Evolução dos últimos 7 dias";
  if (period?.type === "range") return "Evolução do período";
  if (period?.type === "year") return "Evolução anual";
  if (period?.type === "all") return "Evolução geral";
  return "Evolução mensal";
}

function getProfitChartTitle(period: DashboardPeriodOption | undefined) {
  return ["day", "days", "range", "month"].includes(period?.type ?? "")
    ? "Lucro diário"
    : "Lucro por mês";
}

function getVolumeChartTitle(period: DashboardPeriodOption | undefined) {
  return ["day", "days", "range", "month"].includes(period?.type ?? "")
    ? "Volume diário"
    : "Volume por mês";
}

function DashboardMetricCard({
  label,
  value,
  helper,
  valueColorClass = "text-white",
}: {
  label: string;
  value: string;
  helper?: string;
  valueColorClass?: string;
}) {
  return (
    <div className="lz-panel-subtle rounded-[24px] px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
        {label}
      </p>

      <p className={`mt-3 text-2xl font-semibold tracking-tight ${valueColorClass}`}>{value}</p>
      {helper ? <p className="mt-2 text-sm text-[var(--text-muted)]">{helper}</p> : null}
    </div>
  );
}

export function DashboardWorkspace({ data: initialData }: { data: DashboardData }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const [dashboardData, setDashboardData] = useState(initialData);
  const [periodLoading, setPeriodLoading] = useState(false);
  const periodRequestRef = useRef(0);
  const [activeTab, setActiveTab] = useState<DashboardTabId>("monthly");
  const [activeFreebetView, setActiveFreebetView] = useState<"collected" | "profit">(
    "collected",
  );
  const [selectedFilter, setSelectedFilter] = useState(
    initialData.procedureFilters[0] ?? "Todos",
  );

  const data = dashboardData;
  const activePeriod = data.period;
  const activeView =
    data.views[selectedFilter] ??
    data.views.Todos ??
    Object.values(data.views)[0];
  const [, startChartTransition] = useTransition();
  const currentMonthPeriodId = buildCurrentReferenceMonthId();

  useEffect(() => {
    if (!searchParams.has("period")) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());

    params.delete("period");

    const query = params.toString();

    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  function updateSelectedPartners(partners: string[]) {
    void loadDashboard(data.selectedPeriodId, partners);
  }

  async function updateSelectedPeriod(value: string) {
    await loadDashboard(value, data.selectedPartners);
  }

  async function loadDashboard(value: string, partners: string[]) {
    const requestId = periodRequestRef.current + 1;

    periodRequestRef.current = requestId;
    if (
      value === currentMonthPeriodId &&
      partners.length === 0 &&
      initialData.selectedPartners.length === 0
    ) {
      startChartTransition(() => {
        setDashboardData(initialData);
        setPeriodLoading(false);
      });
      return;
    }

    setPeriodLoading(true);

    try {
      const response = await fetch(
        `/api/dashboard?period=${encodeURIComponent(value)}${
          partners.length ? `&partners=${encodeURIComponent(partners.join(","))}` : ""
        }`,
        {
          cache: "no-store",
        },
      );

      if (redirectToLoginOnUnauthorized(response)) {
        return;
      }

      if (!response.ok) {
        throw new Error("Não foi possível carregar o período do dashboard.");
      }

      const nextData = (await response.json()) as DashboardData;

      if (periodRequestRef.current !== requestId) {
        return;
      }

      startChartTransition(() => {
        setDashboardData(nextData);
      });
    } catch (error) {
      console.error(error);
      showToast({
        description: "Mantivemos os dados atuais. Tente trocar o periodo novamente em instantes.",
        title: "Nao foi possivel atualizar o dashboard",
        tone: "error",
      });
    } finally {
      if (periodRequestRef.current === requestId) {
        setPeriodLoading(false);
      }
    }
  }

  if (!activeView) {
    return (
      <div className="lz-panel rounded-[28px] p-5 text-sm text-[var(--text-muted)]">
        Sem dados suficientes para montar o dashboard.
      </div>
    );
  }

  const metrics = activeView.metrics;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <DashboardMetricCard
          label="Lucro diário"
          value={formatCurrency(metrics.todayProfit)}
          valueColorClass={getColorClass(metrics.todayProfit)}
          helper={metrics.todayLabel}
        />
        <DashboardMetricCard
          label="Lucro no período"
          value={formatCurrency(metrics.periodProfit)}
          valueColorClass={getColorClass(metrics.periodProfit)}
          helper={activePeriod?.label ?? metrics.referenceLabel}
        />
        <DashboardMetricCard
          label={getAverageCardLabel(activePeriod)}
          value={formatCurrency(metrics.dailyAverage)}
          valueColorClass={getColorClass(metrics.dailyAverage)}
          helper={`${formatNumber(metrics.activeDays)} ${getPeriodUnitLabel(activePeriod)}`}
        />
        <DashboardMetricCard
          label="Procedimentos pendentes"
          value={formatNumber(data.pendingProcedures.pendingCount)}
          helper={`${formatCurrency(data.pendingProcedures.pendingAmount)} em aberto`}
        />
        <DashboardMetricCard
          label="Freebets em aberto"
          value={formatNumber(data.openFreebets.openFreebets)}
          helper={`${formatNumber(data.openFreebets.openFreebetsReady)} ${pluralize(
            data.openFreebets.openFreebetsReady,
            "pronta",
            "prontas",
          )} (${formatCurrency(data.openFreebets.openFreebetsReadyValue)}) / ${formatNumber(
            data.openFreebets.openFreebetsPending,
          )} ${pluralize(
            data.openFreebets.openFreebetsPending,
            "aguardando",
            "aguardando",
          )}`}
        />
      </div>

      <div
        aria-busy={periodLoading}
        className="lz-panel grid gap-3 rounded-[28px] px-4 py-4 xl:grid-cols-[auto_minmax(0,1fr)] xl:items-center"
      >
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:flex-nowrap">
          {DASHBOARD_TABS.map((tab) => (
            <button
              className={`rounded-full px-4 py-2 text-sm font-medium transition sm:min-w-[92px] ${
                activeTab === tab.id
                  ? "lz-button-primary"
                  : "lz-button-secondary"
              }`}
              key={tab.id}
              onClick={() => startChartTransition(() => setActiveTab(tab.id))}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div
          className={`grid w-full gap-3 xl:ml-auto ${
            data.partners.length
              ? "lg:grid-cols-3 xl:max-w-[1200px]"
              : "lg:grid-cols-2 xl:max-w-[900px]"
          }`}
        >
          <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:flex-row sm:items-center">
            <label
              className="shrink-0 text-sm font-medium text-[var(--text-secondary)]"
              htmlFor="dashboard-period-filter"
            >
              Período
            </label>
            <PeriodPicker
              currentPeriod={activePeriod ?? null}
              id="dashboard-period-filter"
              onValueChange={updateSelectedPeriod}
              options={data.periodOptions}
              value={data.selectedPeriodId}
            />
          </div>

          {data.partners.length ? (
            <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:flex-row sm:items-center">
              <label
                className="shrink-0 text-sm font-medium text-[var(--text-secondary)]"
                htmlFor="dashboard-partner-filter"
              >
                Parceiro
              </label>
              <PartnerFilterSelect
                disabled={periodLoading}
                id="dashboard-partner-filter"
                onChange={updateSelectedPartners}
                partners={data.partners}
                value={data.selectedPartners}
              />
            </div>
          ) : null}

          {activeTab !== "freebets" ? (
            <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:flex-row sm:items-center">
              <label
                className="shrink-0 text-sm font-medium text-[var(--text-secondary)]"
                htmlFor="dashboard-procedure-filter"
              >
                Procedimento
              </label>
              <LzSelect
                className="w-full rounded-full px-4 py-2 text-sm sm:min-w-[220px]"
                id="dashboard-procedure-filter"
                onValueChange={(value) =>
                  startChartTransition(() => setSelectedFilter(value))
                }
                options={data.procedureFilters.map((filter) => ({
                  value: filter,
                  label: filter,
                }))}
                value={selectedFilter}
              />
            </div>
          ) : null}
        </div>
      </div>

      {activeTab === "monthly" ? (
        <SectionCard
          title={getEvolutionTitle(activePeriod)}
          description={activePeriod?.label ?? metrics.referenceLabel}
        >
          <LineChart data={activeView.monthlyEvolution} formatValue={formatCurrency} />
        </SectionCard>
      ) : null}

      {activeTab === "daily-profit" ? (
        <SectionCard
          title={getProfitChartTitle(activePeriod)}
          description={activePeriod?.label ?? metrics.referenceLabel}
        >
          <VerticalBarChart
            data={activeView.dailyProfit}
            formatValue={formatCurrency}
          />
        </SectionCard>
      ) : null}

      {activeTab === "daily-volume" ? (
        <SectionCard
          title={getVolumeChartTitle(activePeriod)}
          description={activePeriod?.label ?? metrics.referenceLabel}
        >
          <VerticalBarChart
            data={activeView.dailyVolume}
          />
        </SectionCard>
      ) : null}

      {activeTab === "freebets" ? (
        <SectionCard
          title="Métricas de Freebets"
          description={activePeriod?.label ?? metrics.referenceLabel}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button
                className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                  activeFreebetView === "collected"
                    ? "lz-button-primary"
                    : "lz-button-secondary"
                }`}
                onClick={() =>
                  startChartTransition(() => setActiveFreebetView("collected"))
                }
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
                onClick={() =>
                  startChartTransition(() => setActiveFreebetView("profit"))
                }
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
                activeFreebetView === "profit" ? formatCurrency : formatNumber
              }
            />
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
