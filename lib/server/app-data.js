import "server-only";

import { unstable_cache } from "next/cache";

import { PROCEDURE_TYPES } from "@/core/domain/shared/constants.js";
import { getProceduresRepository } from "@/lib/server";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

function toNumber(value, defaultValue = 0) {
  const parsed = Number(value ?? defaultValue);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

function formatCurrencyValue(value) {
  return currencyFormatter.format(toNumber(value));
}

function parseReferenceMonth(value = "") {
  const [month, year] = String(value).split("/").map(Number);

  if (!Number.isInteger(month) || !Number.isInteger(year)) {
    return 0;
  }

  return year * 100 + month;
}

function normalizeReferenceMonth(value = "") {
  return String(value ?? "").trim();
}

function parseReferenceMonthParts(value = "") {
  const [month, year] = String(value).split("/").map(Number);

  if (!Number.isInteger(month) || !Number.isInteger(year)) {
    return null;
  }

  return { month, year };
}

function getReferenceMonthYear(value = "") {
  return parseReferenceMonthParts(value)?.year ?? 0;
}

function parseOperationDate(value = "") {
  const [day, month, year] = String(value).split("/").map(Number);

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return 0;
  }

  return year * 10000 + month * 100 + day;
}

function parseOperationDateParts(value = "") {
  const [day, month, year] = String(value).split("/").map(Number);

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return null;
  }

  return { day, month, year };
}

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function buildCurrentOperationDate(now = new Date()) {
  return `${padNumber(now.getDate())}/${padNumber(now.getMonth() + 1)}/${now.getFullYear()}`;
}

function buildCurrentReferenceMonth(now = new Date()) {
  return `${padNumber(now.getMonth() + 1)}/${now.getFullYear()}`;
}

function buildOperationDateFromDate(date) {
  return `${padNumber(date.getDate())}/${padNumber(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function buildRelativeOperationDate(offsetDays, now = new Date()) {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);

  return buildOperationDateFromDate(date);
}

function buildOperationDateRangeTimeline(startDate, endDate) {
  const startParts = parseOperationDateParts(startDate);
  const endParts = parseOperationDateParts(endDate);

  if (!startParts || !endParts) {
    return [];
  }

  const start = new Date(startParts.year, startParts.month - 1, startParts.day);
  const end = new Date(endParts.year, endParts.month - 1, endParts.day);

  if (start.getTime() > end.getTime()) {
    return [];
  }

  const items = [];

  for (
    let current = new Date(start);
    current.getTime() <= end.getTime();
    current = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1)
  ) {
    const fullLabel = buildOperationDateFromDate(current);

    items.push({
      bucketLabel: fullLabel,
      fullLabel,
      label: `${padNumber(current.getDate())}/${padNumber(current.getMonth() + 1)}`,
      dateKey: parseOperationDate(fullLabel),
    });
  }

  return items;
}

function buildMonthTimeline(referenceMonth, options = {}) {
  const { now = new Date(), totalDays: totalDaysOverride } = options;
  const parts = parseReferenceMonthParts(referenceMonth);

  if (!parts) {
    return [];
  }

  const monthTotalDays = new Date(parts.year, parts.month, 0).getDate();
  const isCurrentReferenceMonth = referenceMonth === buildCurrentReferenceMonth(now);
  const defaultTotalDays = isCurrentReferenceMonth
    ? Math.min(now.getDate(), monthTotalDays)
    : monthTotalDays;
  const totalDays = Math.min(
    Math.max(toNumber(totalDaysOverride, defaultTotalDays), 1),
    monthTotalDays,
  );

  return Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1;
    const fullLabel = `${padNumber(day)}/${padNumber(parts.month)}/${parts.year}`;

    return {
      bucketLabel: fullLabel,
      fullLabel,
      label: padNumber(day),
      dateKey: parseOperationDate(fullLabel),
    };
  });
}

function buildReferenceMonthTimeline(referenceMonths) {
  return Array.from(new Set((referenceMonths ?? []).map(normalizeReferenceMonth)))
    .filter(Boolean)
    .sort((left, right) => parseReferenceMonth(left) - parseReferenceMonth(right))
    .map((referenceMonth) => ({
      bucketLabel: referenceMonth,
      dateKey: parseReferenceMonth(referenceMonth),
      fullLabel: formatReferenceMonthLabel(referenceMonth),
      label: referenceMonth,
    }));
}

function formatShortReferenceMonthLabel(value = "") {
  const [monthText, yearText] = String(value).split("/");
  const month = Number(monthText);
  const year = Number(yearText);

  if (!Number.isInteger(month) || !Number.isInteger(year)) {
    return value;
  }

  const date = new Date(year, Math.max(month - 1, 0), 1);
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "short",
  })
    .format(date)
    .replace(".", "");

  return label.charAt(0).toUpperCase() + label.slice(1);
}

function buildYearTimeline(year, referenceMonths, seriesRows, convertedRows) {
  const normalizedYear = Number(year);

  if (!Number.isInteger(normalizedYear) || normalizedYear <= 0) {
    return [];
  }

  const referenceMonthValues = [
    ...(referenceMonths ?? []),
    ...(seriesRows ?? []).map((row) => row?.bucket_label),
    ...(convertedRows ?? []).map((row) => row?.bucket_label),
  ]
    .map(normalizeReferenceMonth)
    .filter((referenceMonth) => getReferenceMonthYear(referenceMonth) === normalizedYear);

  return Array.from(new Set(referenceMonthValues))
    .filter(Boolean)
    .sort((left, right) => parseReferenceMonth(left) - parseReferenceMonth(right))
    .map((referenceMonth) => ({
      bucketLabel: referenceMonth,
      dateKey: parseReferenceMonth(referenceMonth),
      fullLabel: formatReferenceMonthLabel(referenceMonth),
      label: formatShortReferenceMonthLabel(referenceMonth),
    }));
}

function buildRecentDaysPeriodOption() {
  const startDate = buildRelativeOperationDate(-6);
  const endDate = buildCurrentOperationDate();

  return {
    endDate,
    endKey: String(parseOperationDate(endDate)),
    helper: "Dias",
    id: "days:7",
    label: "Últimos 7 dias",
    startDate,
    startKey: String(parseOperationDate(startDate)),
    type: "days",
    value: "7",
  };
}

function buildHistoryMonthOptions(rows) {
  return [...(rows ?? [])]
    .sort((left, right) => parseReferenceMonth(right.value) - parseReferenceMonth(left.value))
    .map((item) => ({
      value: item.value,
      label: item.value || "Sem mes",
      profit: toNumber(item.profit),
      count: toNumber(item.count),
    }));
}

function buildDashboardPeriodOptions(months) {
  const currentReferenceMonth = buildCurrentReferenceMonth();
  const monthValues = Array.from(
    new Set([currentReferenceMonth, ...(months ?? []).map((month) => month.value)]),
  )
    .filter(Boolean)
    .sort((left, right) => parseReferenceMonth(right) - parseReferenceMonth(left));
  const yearValues = Array.from(
    new Set(monthValues.map(getReferenceMonthYear).filter(Boolean)),
  ).sort((left, right) => right - left);

  return [
    buildRecentDaysPeriodOption(),
    ...monthValues.map((value) => ({
      helper: "Mês",
      id: `month:${value}`,
      label: formatReferenceMonthLabel(value),
      type: "month",
      value,
    })),
    ...yearValues.map((value) => ({
      helper: "Ano",
      id: `year:${value}`,
      label: `Ano ${value}`,
      type: "year",
      value: String(value),
    })),
    {
      helper: "Geral",
      id: "all",
      label: "Todo o período",
      type: "all",
      value: "all",
    },
  ];
}

function resolveDashboardPeriodOption(periodOptions, requestedPeriodId, referenceMonth) {
  const requested = normalizeReferenceMonth(requestedPeriodId);

  return (
    periodOptions.find((period) => period.id === requested) ??
    periodOptions.find(
      (period) => period.type === "month" && period.value === referenceMonth,
    ) ??
    periodOptions[0] ??
    {
      helper: "Mês",
      id: `month:${referenceMonth}`,
      label: formatReferenceMonthLabel(referenceMonth),
      type: "month",
      value: referenceMonth,
    }
  );
}

function buildMonthlyEvolutionSeries(dailySeries) {
  let accumulatedProfit = 0;

  return (dailySeries ?? []).map((item) => {
    accumulatedProfit += toNumber(item.profit);

    return {
      label: item.label,
      fullLabel: item.fullLabel,
      value: accumulatedProfit,
    };
  });
}

function buildOpenFreebetMetrics(freebetsSummary) {
  return {
    openFreebets:
      toNumber(freebetsSummary.pendingConfirmationCount) +
      toNumber(freebetsSummary.convertibleCount),
    openFreebetsReady: toNumber(freebetsSummary.convertibleCount),
    openFreebetsReadyValue: toNumber(freebetsSummary.convertibleValue),
    openFreebetsPending: toNumber(freebetsSummary.pendingConfirmationCount),
  };
}

function getTimelineDayLimitFromStats(
  referenceMonth,
  { dailyRows = [], convertedRows = [], now = new Date() } = {},
) {
  const parts = parseReferenceMonthParts(referenceMonth);

  if (!parts) {
    return 0;
  }

  const monthTotalDays = new Date(parts.year, parts.month, 0).getDate();

  if (referenceMonth !== buildCurrentReferenceMonth(now)) {
    return monthTotalDays;
  }

  const isSameMonth = (dateParts) =>
    dateParts && dateParts.month === parts.month && dateParts.year === parts.year;
  const days = [...(dailyRows ?? []), ...(convertedRows ?? [])]
    .map((row) => parseOperationDateParts(row?.data_operacao ?? row?.bucket_label))
    .filter(isSameMonth)
    .map((dateParts) => dateParts.day);

  return Math.min(Math.max(now.getDate(), ...days), monthTotalDays);
}

function groupPeriodStatsByFilter(rows) {
  const grouped = new Map();

  for (const row of rows ?? []) {
    const filter = String(row?.filtro ?? "").trim() || "Todos";
    const bucketLabel = String(row?.bucket_label ?? row?.data_operacao ?? "").trim();

    if (!bucketLabel) {
      continue;
    }

    if (!grouped.has(filter)) {
      grouped.set(filter, new Map());
    }

    grouped.get(filter).set(bucketLabel, {
      dateKey: toNumber(row?.bucket_key),
      fullLabel: bucketLabel,
      label: bucketLabel,
      profit: toNumber(row.profit),
      volume: toNumber(row.volume),
    });
  }

  return grouped;
}

function buildDashboardTimeline(period, referenceMonths, seriesRows, convertedRows) {
  if (period.type === "days") {
    return buildOperationDateRangeTimeline(period.startDate, period.endDate);
  }

  if (period.type === "month") {
    return buildMonthTimeline(period.value, {
      totalDays: getTimelineDayLimitFromStats(period.value, {
        convertedRows,
        dailyRows: seriesRows,
      }),
    });
  }

  if (period.type === "year") {
    return buildYearTimeline(period.value, referenceMonths, seriesRows, convertedRows);
  }

  return buildReferenceMonthTimeline([
    ...(referenceMonths ?? []),
    ...(seriesRows ?? []).map((row) => row?.bucket_label),
    ...(convertedRows ?? []).map((row) => row?.bucket_label),
  ]);
}

function buildDashboardMetricsFromStats(row, period) {
  const periodProfit = toNumber(row?.period_profit ?? row?.monthly_profit);
  const activeDays = toNumber(row?.active_buckets ?? row?.active_days);
  const procedureCount = toNumber(row?.procedure_count ?? row?.monthly_procedure_count);

  return {
    todayProfit: toNumber(row?.today_profit),
    periodProfit,
    dailyAverage: activeDays > 0 ? periodProfit / activeDays : 0,
    averagePerProcedure:
      procedureCount > 0 ? periodProfit / procedureCount : 0,
    proceduresToday: toNumber(row?.procedures_today),
    todayLabel: buildCurrentOperationDate(),
    referenceLabel: period.label,
    referenceMonth: period.type === "month" ? period.value : "",
    referenceMonthLabel: period.label,
    monthlyProcedureCount: procedureCount,
    procedureCount,
    activeDays,
  };
}

function buildDashboardViewsFromStats(
  procedureFilters,
  metricsRows,
  seriesRows,
  period,
  timeline,
) {
  const metricsByFilter = new Map(
    (metricsRows ?? []).map((row) => [String(row?.filtro ?? "").trim() || "Todos", row]),
  );
  const seriesByFilter = groupPeriodStatsByFilter(seriesRows);

  return Object.fromEntries(
    procedureFilters.map((filter) => {
      const seriesStats = seriesByFilter.get(filter);
      const periodSeries = (timeline ?? []).map((bucket) => {
        const current =
          seriesStats?.get(bucket.bucketLabel) ??
          seriesStats?.get(bucket.fullLabel) ??
          seriesStats?.get(bucket.label);

        return (
          {
            dateKey: bucket.dateKey,
            fullLabel: bucket.fullLabel,
            label: bucket.label,
            profit: current?.profit ?? 0,
            volume: current?.volume ?? 0,
          }
        );
      });

      return [
        filter,
        {
          metrics: buildDashboardMetricsFromStats(
            metricsByFilter.get(filter),
            period,
          ),
          monthlyEvolution: buildMonthlyEvolutionSeries(periodSeries),
          dailyProfit: periodSeries.map((item) => ({
            label: item.label,
            fullLabel: item.fullLabel,
            value: item.profit,
            detail: `${toNumber(item.volume)} procedimentos`,
          })),
          dailyVolume: periodSeries.map((item) => ({
            label: item.label,
            fullLabel: item.fullLabel,
            value: item.volume,
            detail: formatCurrencyValue(item.profit),
          })),
        },
      ];
    }),
  );
}

function buildDailyCollectedFreebetSeriesFromStats(seriesRows, timeline) {
  const seriesByFilter = groupPeriodStatsByFilter(seriesRows);
  const freebetStats = seriesByFilter.get("Coletar Freebet");

  return (timeline ?? []).map((bucket) => {
    const current =
      freebetStats?.get(bucket.bucketLabel) ??
      freebetStats?.get(bucket.fullLabel) ??
      freebetStats?.get(bucket.label);

    return {
      label: bucket.label,
      fullLabel: bucket.fullLabel,
      value: current?.volume ?? 0,
    };
  });
}

function buildDailyConvertedFreebetProfitSeriesFromStats(rows, timeline) {
  const grouped = new Map();

  for (const row of rows ?? []) {
    const bucketLabel = String(row?.bucket_label ?? row?.data_operacao ?? "").trim();

    if (!bucketLabel) {
      continue;
    }

    grouped.set(bucketLabel, {
      count: toNumber(row.count),
      value: toNumber(row.value),
    });
  }

  return (timeline ?? []).map((bucket) => {
    const current =
      grouped.get(bucket.bucketLabel) ??
      grouped.get(bucket.fullLabel) ??
      grouped.get(bucket.label);

    return {
      label: bucket.label,
      fullLabel: bucket.fullLabel,
      value: current?.value ?? 0,
      detail: `${current?.count ?? 0} freebets`,
    };
  });
}

function formatReferenceMonthLabel(value = "") {
  const [monthText, yearText] = String(value).split("/");
  const month = Number(monthText);
  const year = Number(yearText);

  if (!Number.isInteger(month) || !Number.isInteger(year)) {
    return "Procedimentos";
  }

  const date = new Date(year, Math.max(month - 1, 0), 1);
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);

  return label.charAt(0).toUpperCase() + label.slice(1);
}

const getCachedBookmakersCatalog = unstable_cache(
  async () => {
    const repository = getProceduresRepository();
    return repository.listBookmakers();
  },
  ["bookmakers-catalog"],
  {
    tags: ["bookmakers-catalog"],
    revalidate: 86_400,
  },
);

export async function getBookmakersCatalog() {
  return getCachedBookmakersCatalog();
}

async function getDashboardDataUncached(userId, baseId, referenceMonth, selectedPeriodId = "") {
  const repository = getProceduresRepository();
  const todayLabel = buildCurrentOperationDate();
  const [
    historyMonths,
    freebetsSummary,
    pendingProcedures,
  ] = await Promise.all([
    repository.listHistoryMonths(userId, baseId),
    repository.getFreebetsSummary(userId, baseId),
    repository.getPendingProceduresSummary(userId, baseId),
  ]);
  const monthOptions = buildHistoryMonthOptions(historyMonths);
  const periodOptions = buildDashboardPeriodOptions(monthOptions);
  const activePeriod = resolveDashboardPeriodOption(
    periodOptions,
    selectedPeriodId,
    referenceMonth,
  );
  const referenceMonths = periodOptions
    .filter((period) => period.type === "month")
    .map((period) => period.value);
  const procedureFilters = ["Todos", ...PROCEDURE_TYPES];
  const [dashboardStats, convertedFreebetProfit] = await Promise.all([
    repository.getDashboardPeriodProcedureStats(
      activePeriod,
      todayLabel,
      userId,
      baseId,
    ),
    repository.getConvertedFreebetProfitByPeriod(activePeriod, userId, baseId),
  ]);
  const timeline = buildDashboardTimeline(
    activePeriod,
    referenceMonths,
    dashboardStats.series,
    convertedFreebetProfit,
  );

  return {
    freebets: {
      collectedDaily: buildDailyCollectedFreebetSeriesFromStats(
        dashboardStats.series,
        timeline,
      ),
      convertedProfitDaily: buildDailyConvertedFreebetProfitSeriesFromStats(
        convertedFreebetProfit,
        timeline,
      ),
    },
    pendingProcedures,
    period: activePeriod,
    periodOptions,
    procedureFilters,
    selectedPeriodId: activePeriod.id,
    views: buildDashboardViewsFromStats(
      procedureFilters,
      dashboardStats.metrics,
      dashboardStats.series,
      activePeriod,
      timeline,
    ),
    openFreebets: buildOpenFreebetMetrics(freebetsSummary),
  };
}

const getCachedDashboardData = unstable_cache(
  getDashboardDataUncached,
  ["dashboard-data"],
  {
    tags: ["dashboard-data"],
    revalidate: 60,
  },
);

export async function getDashboardData(userId, baseId, selectedPeriodId = "") {
  return getCachedDashboardData(
    userId,
    baseId,
    buildCurrentReferenceMonth(),
    normalizeReferenceMonth(selectedPeriodId),
  );
}

export async function getProceduresPageData(userId, baseId, filters = {}) {
  const repository = getProceduresRepository();
  const [proceduresResult, bookmakers] = await Promise.all([
    repository.listFilteredProcedures(userId, baseId, filters),
    getBookmakersCatalog(),
  ]);

  return {
    procedures: proceduresResult.items,
    pagination: {
      page: proceduresResult.page,
      pageSize: proceduresResult.pageSize,
      pageCount: proceduresResult.pageCount,
      totalItems: proceduresResult.totalItems,
    },
    bookmakers,
  };
}

async function getFreebetsPageDataUncached(userId, baseId) {
  const repository = getProceduresRepository();
  const [activeFreebets, convertedFreebets, bookmakers, summary] = await Promise.all([
    repository.listActiveFreebets(userId, baseId),
    repository.listConvertedFreebets(userId, baseId, { limit: 20 }),
    getBookmakersCatalog(),
    repository.getFreebetsSummary(userId, baseId),
  ]);

  return {
    pendingConfirmation: activeFreebets.pendentes_confirmacao ?? [],
    convertibleGroups: activeFreebets.agrupadas_convertiveis ?? [],
    convertedHistory: convertedFreebets,
    bookmakers,
    summary,
  };
}

const getCachedFreebetsPageData = unstable_cache(
  getFreebetsPageDataUncached,
  ["freebets-page-data-v3"],
  {
    tags: ["freebets-page-data"],
    revalidate: 30,
  },
);

export async function getFreebetsPageData(userId, baseId) {
  return getCachedFreebetsPageData(userId, baseId);
}

async function getBookmakersPageDataUncached(userId, baseId) {
  const repository = getProceduresRepository();
  const [bookmakers, availableBookmakers, notes] = await Promise.all([
    repository.listBookmakersWithBalance(userId, baseId),
    getBookmakersCatalog(),
    repository.getBookmakersNotes(userId, baseId),
  ]);

  return {
    availableBookmakers,
    bookmakers,
    notes,
  };
}

export async function getBookmakersPageData(userId, baseId) {
  return getBookmakersPageDataUncached(userId, baseId);
}

async function getHistoryPageDataUncached(userId, baseId, selectedMonth = "") {
  const repository = getProceduresRepository();
  const months = buildHistoryMonthOptions(
    await repository.listHistoryMonths(userId, baseId),
  );
  const requestedMonth = normalizeReferenceMonth(selectedMonth);
  const activeMonth =
    months.find((month) => month.value === requestedMonth)?.value ??
    months[0]?.value ??
    "";
  const [operations, bookmakers] = await Promise.all([
    months.length > 0
      ? repository.listHistoryOperationsByMonth(activeMonth, userId, baseId)
      : [],
    getBookmakersCatalog(),
  ]);

  return {
    bookmakers,
    months,
    operations,
    selectedMonth: activeMonth,
  };
}

const getCachedHistoryPageData = unstable_cache(
  getHistoryPageDataUncached,
  ["history-page-data"],
  {
    tags: ["history-page-data"],
    revalidate: 60,
  },
);

export async function getHistoryPageData(userId, baseId, selectedMonth = "") {
  return getCachedHistoryPageData(userId, baseId, selectedMonth);
}

export async function getCalculatorPageData() {
  return {
    bookmakers: await getBookmakersCatalog(),
  };
}
