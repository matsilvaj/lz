"use client";

import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { DatePickerField } from "../_components/date-picker-field";
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

type DashboardPeriodOption = {
  helper: string;
  id: string;
  label: string;
  type: string;
  value: string;
};

type DashboardData = {
  freebets: {
    collectedDaily: ChartItem[];
    convertedProfitDaily: ChartItem[];
  };
  pendingProcedures: {
    pendingAmount: number;
    pendingCount: number;
  };
  period: DashboardPeriodOption;
  periodOptions: DashboardPeriodOption[];
  procedureFilters: string[];
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
type PeriodPickerMode = "month" | "year";

const MONTHS = [
  { number: "01", label: "Janeiro", shortLabel: "Jan" },
  { number: "02", label: "Fevereiro", shortLabel: "Fev" },
  { number: "03", label: "Março", shortLabel: "Mar" },
  { number: "04", label: "Abril", shortLabel: "Abr" },
  { number: "05", label: "Maio", shortLabel: "Mai" },
  { number: "06", label: "Junho", shortLabel: "Jun" },
  { number: "07", label: "Julho", shortLabel: "Jul" },
  { number: "08", label: "Agosto", shortLabel: "Ago" },
  { number: "09", label: "Setembro", shortLabel: "Set" },
  { number: "10", label: "Outubro", shortLabel: "Out" },
  { number: "11", label: "Novembro", shortLabel: "Nov" },
  { number: "12", label: "Dezembro", shortLabel: "Dez" },
];

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function getPeriodMode(type: string | undefined): PeriodPickerMode {
  if (type === "year") {
    return "year";
  }

  return "month";
}

function parseReferenceMonth(value = "") {
  const [month, year] = value.split("/");

  if (!month || !year) {
    return null;
  }

  return { month, year };
}

function getYearForPeriodOption(
  option: DashboardPeriodOption | null,
  fallbackYears: string[],
) {
  if (option?.type === "month") {
    const parsed = parseReferenceMonth(option.value);

    if (parsed?.year) {
      return parsed.year;
    }
  }

  if (option?.type === "year" && option.value) {
    return option.value;
  }

  return fallbackYears[0] ?? String(new Date().getFullYear());
}

function sortYearsDesc(left: string, right: string) {
  return Number(right) - Number(left);
}

function pluralize(value: number, singular: string, plural: string) {
  return value === 1 ? singular : plural;
}

function buildCurrentReferenceMonthId() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `month:${month}/${now.getFullYear()}`;
}

function getCustomPeriodDates(periodId = "") {
  const [type, start, end] = periodId.split(":");

  if (type === "day" && start) {
    return { end: start, start };
  }

  if (type === "range" && start) {
    return { end: end || start, start };
  }

  return { end: "", start: "" };
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

function DashboardPeriodPicker({
  currentPeriod,
  id,
  onValueChange,
  options,
  value,
}: {
  currentPeriod: DashboardPeriodOption | null;
  id: string;
  onValueChange: (value: string) => void;
  options: DashboardPeriodOption[];
  value: string;
}) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState({
    maxHeight: 480,
    top: 0,
    left: 0,
    width: 360,
  });
  const selectedOption = useMemo(
    () =>
      options.find((option) => option.id === value) ??
      (currentPeriod?.id === value ? currentPeriod : null) ??
      options[0] ??
      null,
    [currentPeriod, options, value],
  );
  const selectedCustomDates = useMemo(
    () => getCustomPeriodDates(selectedOption?.id),
    [selectedOption?.id],
  );
  const [customRangeEnd, setCustomRangeEnd] = useState(selectedCustomDates.end);
  const [customRangeStart, setCustomRangeStart] = useState(selectedCustomDates.start);
  const monthOptions = useMemo(
    () => options.filter((option) => option.type === "month"),
    [options],
  );
  const yearOptions = useMemo(
    () => options.filter((option) => option.type === "year"),
    [options],
  );
  const daysOption = useMemo(
    () => options.find((option) => option.type === "days") ?? null,
    [options],
  );
  const allOption = useMemo(
    () => options.find((option) => option.type === "all") ?? null,
    [options],
  );
  const availableYearValues = useMemo(() => {
    const values = new Set<string>();

    for (const option of yearOptions) {
      if (option.value) {
        values.add(option.value);
      }
    }

    for (const option of monthOptions) {
      const parsed = parseReferenceMonth(option.value);

      if (parsed?.year) {
        values.add(parsed.year);
      }
    }

    return [...values].sort(sortYearsDesc);
  }, [monthOptions, yearOptions]);
  const [activeMode, setActiveMode] = useState<PeriodPickerMode>(
    getPeriodMode(selectedOption?.type),
  );
  const [selectedYear, setSelectedYear] = useState(
    getYearForPeriodOption(selectedOption, availableYearValues),
  );
  const monthOptionByValue = useMemo(
    () => new Map(monthOptions.map((option) => [option.value, option])),
    [monthOptions],
  );
  const selectedPeriodYear = getYearForPeriodOption(selectedOption, availableYearValues);
  const visibleYear = availableYearValues.includes(selectedYear)
    ? selectedYear
    : selectedPeriodYear;

  useEffect(() => {
    if (!open) {
      return;
    }

    function updatePosition() {
      const rect = triggerRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      const viewportPadding = 16;
      const width = Math.min(430, Math.max(rect.width, window.innerWidth - 32));
      const left = Math.min(
        Math.max(rect.left, viewportPadding),
        Math.max(window.innerWidth - width - viewportPadding, viewportPadding),
      );
      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const spaceAbove = rect.top - viewportPadding;
      const preferredHeight = Math.min(560, window.innerHeight - viewportPadding * 2);
      const opensAbove = spaceBelow < preferredHeight && spaceAbove > spaceBelow;
      const availableHeight = opensAbove ? spaceAbove : spaceBelow;
      const maxHeight = Math.max(320, Math.min(preferredHeight, availableHeight - 10));

      setPanelStyle({
        maxHeight,
        top: opensAbove
          ? Math.max(viewportPadding, rect.top - maxHeight - 10)
          : rect.bottom + 10,
        left,
        width,
      });
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        target instanceof Element &&
        target.closest("[data-lz-date-picker-popover]")
      ) {
        return;
      }

      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleSelect(nextValue: string) {
    onValueChange(nextValue);
    setOpen(false);
  }

  function handleApplyCustomRange() {
    if (!customRangeStart) {
      return;
    }

    const rawEnd = customRangeEnd || customRangeStart;
    const [start, end] =
      customRangeStart <= rawEnd
        ? [customRangeStart, rawEnd]
        : [rawEnd, customRangeStart];

    onValueChange(`range:${start}:${end}`);
    setOpen(false);
  }

  function handleToggleOpen() {
    if (!open) {
      setActiveMode(getPeriodMode(selectedOption?.type));
      setSelectedYear(selectedPeriodYear);
      setCustomRangeStart(selectedCustomDates.start);
      setCustomRangeEnd(selectedCustomDates.end);
    }

    setOpen((current) => !current);
  }

  const modeTabs = [
    monthOptions.length > 0 ? { id: "month" as const, label: "Mês" } : null,
    yearOptions.length > 0 ? { id: "year" as const, label: "Ano" } : null,
  ].filter(Boolean) as Array<{ id: PeriodPickerMode; label: string }>;

  return (
    <>
      <button
        aria-expanded={open}
        className="lz-select inline-flex w-full min-w-0 items-center justify-between gap-3 rounded-full px-4 py-2 text-left text-sm sm:min-w-[220px]"
        id={id}
        onClick={handleToggleOpen}
        ref={triggerRef}
        type="button"
      >
        <span className="min-w-0 truncate text-[var(--text-primary)]">
          {selectedOption?.label ?? "Selecionar"}
        </span>

        <svg
          aria-hidden="true"
          className={joinClasses(
            "h-4 w-4 shrink-0 text-[var(--text-dim)] transition-transform",
            open && "rotate-180",
          )}
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-[90]"
              style={{
                left: `${panelStyle.left}px`,
                top: `${panelStyle.top}px`,
                width: `${panelStyle.width}px`,
              }}
            >
              <div
                className="lz-floating-panel overflow-y-auto rounded-[28px] border border-white/10 bg-[rgba(23,9,16,0.98)] p-3 shadow-[0_28px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl"
                ref={panelRef}
                style={{ maxHeight: `${panelStyle.maxHeight}px` }}
              >
                <div className="grid grid-cols-2 gap-2">
                  {daysOption ? (
                    <button
                      className={joinClasses(
                        "rounded-full border px-3 py-2.5 text-sm font-semibold transition",
                        selectedOption?.id === daysOption.id
                          ? "border-[rgba(255,119,163,0.26)] bg-[rgba(216,31,89,0.2)] text-white"
                          : "border-white/10 bg-white/[0.035] text-[var(--text-secondary)] hover:border-white/20 hover:bg-white/[0.06] hover:text-white",
                      )}
                      onClick={() => handleSelect(daysOption.id)}
                      type="button"
                    >
                      7 dias
                    </button>
                  ) : null}

                  {allOption ? (
                    <button
                      className={joinClasses(
                        "rounded-full border px-3 py-2.5 text-sm font-semibold transition",
                        selectedOption?.id === allOption.id
                          ? "border-[rgba(255,119,163,0.26)] bg-[rgba(216,31,89,0.2)] text-white"
                          : "border-white/10 bg-white/[0.035] text-[var(--text-secondary)] hover:border-white/20 hover:bg-white/[0.06] hover:text-white",
                      )}
                      onClick={() => handleSelect(allOption.id)}
                      type="button"
                    >
                      Tudo
                    </button>
                  ) : null}
                </div>

                <div className="mt-3 grid grid-cols-2 gap-1 rounded-full border border-white/8 bg-white/[0.035] p-1">
                  {modeTabs.map((tab) => (
                    <button
                      className={joinClasses(
                        "rounded-full px-3 py-2 text-xs font-semibold transition",
                        activeMode === tab.id
                          ? "bg-[rgba(216,31,89,0.32)] text-white shadow-[inset_0_0_0_1px_rgba(255,119,163,0.18)]"
                          : "text-[var(--text-muted)] hover:bg-white/[0.06] hover:text-white",
                      )}
                      key={tab.id}
                      onClick={() => setActiveMode(tab.id)}
                      type="button"
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {activeMode === "month" ? (
                  <div className="mt-3 space-y-3">
                    <div className="lz-scrollbar-hidden flex gap-2 overflow-x-auto pb-1">
                      {availableYearValues.map((year) => (
                        <button
                          className={joinClasses(
                            "shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition",
                            visibleYear === year
                              ? "border-[rgba(255,119,163,0.24)] bg-[rgba(216,31,89,0.18)] text-white"
                              : "border-white/10 bg-white/[0.035] text-[var(--text-secondary)] hover:border-white/20 hover:bg-white/[0.06] hover:text-white",
                          )}
                          key={year}
                          onClick={() => setSelectedYear(year)}
                          type="button"
                        >
                          {year}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {MONTHS.map((month) => {
                        const periodValue = `${month.number}/${visibleYear}`;
                        const option = monthOptionByValue.get(periodValue);
                        const selected = selectedOption?.id === option?.id;

                        return (
                          <button
                            className={joinClasses(
                              "rounded-[18px] border px-3 py-2.5 text-sm font-semibold transition",
                              selected
                                ? "border-[rgba(255,119,163,0.26)] bg-[rgba(216,31,89,0.22)] text-white"
                                : option
                                  ? "border-white/10 bg-white/[0.035] text-[var(--text-secondary)] hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                                  : "cursor-not-allowed border-white/5 bg-white/[0.015] text-[var(--text-dim)] opacity-45",
                            )}
                            disabled={!option}
                            key={month.number}
                            onClick={() => option && handleSelect(option.id)}
                            title={month.label}
                            type="button"
                          >
                            {month.shortLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {activeMode === "year" ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {yearOptions.map((option) => (
                      <button
                        className={joinClasses(
                          "rounded-[20px] border px-4 py-3 text-left text-sm font-semibold transition",
                          selectedOption?.id === option.id
                            ? "border-[rgba(255,119,163,0.26)] bg-[rgba(216,31,89,0.18)] text-white"
                            : "border-white/10 bg-white/[0.035] text-[var(--text-secondary)] hover:border-white/20 hover:bg-white/[0.06] hover:text-white",
                        )}
                        key={option.id}
                        onClick={() => handleSelect(option.id)}
                        type="button"
                      >
                        {option.value}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 border-t border-white/10 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                    Período específico
                  </p>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <DatePickerField
                      className="h-11 rounded-full py-0 text-sm"
                      onChange={setCustomRangeStart}
                      placeholder="Início"
                      value={customRangeStart}
                    />
                    <DatePickerField
                      className="h-11 rounded-full py-0 text-sm"
                      onChange={setCustomRangeEnd}
                      placeholder="Fim"
                      value={customRangeEnd}
                    />
                  </div>

                  <button
                    className="lz-button-secondary mt-3 h-11 w-full rounded-full px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-55"
                    disabled={!customRangeStart}
                    onClick={handleApplyCustomRange}
                    type="button"
                  >
                    Aplicar período
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export function DashboardWorkspace({ data: initialData }: { data: DashboardData }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
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

  async function updateSelectedPeriod(value: string) {
    const requestId = periodRequestRef.current + 1;

    periodRequestRef.current = requestId;
    if (value === currentMonthPeriodId) {
      startChartTransition(() => {
        setDashboardData(initialData);
        setPeriodLoading(false);
      });
      return;
    }

    setPeriodLoading(true);

    try {
      const response = await fetch(
        `/api/dashboard?period=${encodeURIComponent(value)}`,
        {
          cache: "no-store",
        },
      );

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

        <div className="grid w-full gap-3 lg:grid-cols-2 xl:ml-auto xl:max-w-[900px]">
          <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:flex-row sm:items-center">
            <label
              className="shrink-0 text-sm font-medium text-[var(--text-secondary)]"
              htmlFor="dashboard-period-filter"
            >
              Período
            </label>
            <DashboardPeriodPicker
              currentPeriod={activePeriod ?? null}
              id="dashboard-period-filter"
              onValueChange={updateSelectedPeriod}
              options={data.periodOptions}
              value={data.selectedPeriodId}
            />
          </div>

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
