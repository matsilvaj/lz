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
      fullLabel,
      label: padNumber(day),
      dateKey: parseOperationDate(fullLabel),
    };
  });
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
    .map((row) => parseOperationDateParts(row?.data_operacao))
    .filter(isSameMonth)
    .map((dateParts) => dateParts.day);

  return Math.min(Math.max(now.getDate(), ...days), monthTotalDays);
}

function groupDailyStatsByFilter(dailyRows) {
  const grouped = new Map();

  for (const row of dailyRows ?? []) {
    const filter = String(row?.filtro ?? "").trim() || "Todos";
    const dateLabel = String(row?.data_operacao ?? "").trim();

    if (!dateLabel) {
      continue;
    }

    if (!grouped.has(filter)) {
      grouped.set(filter, new Map());
    }

    grouped.get(filter).set(dateLabel, {
      label: dateLabel.slice(0, 2),
      fullLabel: dateLabel,
      dateKey: parseOperationDate(dateLabel),
      profit: toNumber(row.profit),
      volume: toNumber(row.volume),
    });
  }

  return grouped;
}

function buildDailySeriesFromStats(dailyStats, referenceMonth, timelineDays) {
  return buildMonthTimeline(referenceMonth, { totalDays: timelineDays }).map((day) => {
    const current = dailyStats?.get(day.fullLabel);

    return (
      current ?? {
        label: day.label,
        fullLabel: day.fullLabel,
        dateKey: day.dateKey,
        profit: 0,
        volume: 0,
      }
    );
  });
}

function buildDashboardMetricsFromStats(row, referenceMonth) {
  const monthlyProfit = toNumber(row?.monthly_profit);
  const activeDays = toNumber(row?.active_days);
  const monthlyProcedureCount = toNumber(row?.monthly_procedure_count);

  return {
    todayProfit: toNumber(row?.today_profit),
    monthlyProfit,
    dailyAverage: activeDays > 0 ? monthlyProfit / activeDays : 0,
    averagePerProcedure:
      monthlyProcedureCount > 0 ? monthlyProfit / monthlyProcedureCount : 0,
    proceduresToday: toNumber(row?.procedures_today),
    todayLabel: buildCurrentOperationDate(),
    referenceMonth,
    referenceMonthLabel: formatReferenceMonthLabel(referenceMonth),
    monthlyProcedureCount,
    activeDays,
  };
}

function buildDashboardViewsFromStats(procedureFilters, metricsRows, dailyRows, referenceMonth, timelineDays) {
  const metricsByFilter = new Map(
    (metricsRows ?? []).map((row) => [String(row?.filtro ?? "").trim() || "Todos", row]),
  );
  const dailyByFilter = groupDailyStatsByFilter(dailyRows);

  return Object.fromEntries(
    procedureFilters.map((filter) => {
      const dailySeries = buildDailySeriesFromStats(
        dailyByFilter.get(filter),
        referenceMonth,
        timelineDays,
      );

      return [
        filter,
        {
          metrics: buildDashboardMetricsFromStats(
            metricsByFilter.get(filter),
            referenceMonth,
          ),
          monthlyEvolution: buildMonthlyEvolutionSeries(dailySeries),
          dailyProfit: dailySeries.map((item) => ({
            label: item.label,
            fullLabel: item.fullLabel,
            value: item.profit,
            detail: `${toNumber(item.volume)} procedimentos`,
          })),
          dailyVolume: dailySeries.map((item) => ({
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

function buildDailyCollectedFreebetSeriesFromStats(dailyRows, referenceMonth, timelineDays) {
  const dailyByFilter = groupDailyStatsByFilter(dailyRows);

  return buildDailySeriesFromStats(
    dailyByFilter.get("Coletar Freebet"),
    referenceMonth,
    timelineDays,
  ).map((item) => ({
    label: item.label,
    fullLabel: item.fullLabel,
    value: item.volume,
  }));
}

function buildDailyConvertedFreebetProfitSeriesFromStats(rows, referenceMonth, timelineDays) {
  const grouped = new Map();

  for (const row of rows ?? []) {
    const dateLabel = String(row?.data_operacao ?? "").trim();

    if (!dateLabel) {
      continue;
    }

    grouped.set(dateLabel, {
      value: toNumber(row.value),
      count: toNumber(row.count),
    });
  }

  return buildMonthTimeline(referenceMonth, { totalDays: timelineDays }).map((day) => {
    const current = grouped.get(day.fullLabel);

    return {
      label: day.label,
      fullLabel: day.fullLabel,
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

async function getDashboardDataUncached(userId, baseId, referenceMonth) {
  const repository = getProceduresRepository();
  const todayLabel = buildCurrentOperationDate();
  const [
    dashboardStats,
    freebetsSummary,
    convertedFreebetDailyProfit,
  ] = await Promise.all([
    repository.getDashboardProcedureStats(referenceMonth, todayLabel, userId, baseId),
    repository.getFreebetsSummary(userId, baseId),
    repository.getConvertedFreebetDailyProfit(referenceMonth, userId, baseId),
  ]);

  const timelineDays = getTimelineDayLimitFromStats(referenceMonth, {
    dailyRows: dashboardStats.daily,
    convertedRows: convertedFreebetDailyProfit,
  });
  const procedureFilters = ["Todos", ...PROCEDURE_TYPES];
  const views = buildDashboardViewsFromStats(
    procedureFilters,
    dashboardStats.metrics,
    dashboardStats.daily,
    referenceMonth,
    timelineDays,
  );

  return {
    procedureFilters,
    views,
    openFreebets: buildOpenFreebetMetrics(freebetsSummary),
    freebets: {
      collectedDaily: buildDailyCollectedFreebetSeriesFromStats(
        dashboardStats.daily,
        referenceMonth,
        timelineDays,
      ),
      convertedProfitDaily: buildDailyConvertedFreebetProfitSeriesFromStats(
        convertedFreebetDailyProfit,
        referenceMonth,
        timelineDays,
      ),
    },
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

export async function getDashboardData(userId, baseId) {
  return getCachedDashboardData(userId, baseId, buildCurrentReferenceMonth());
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

export async function getFreebetsPageData(userId, baseId) {
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

export async function getBookmakersPageData(userId, baseId) {
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

export async function getHistoryPageData(userId, baseId, selectedMonth = "") {
  const repository = getProceduresRepository();
  const months = buildHistoryMonthOptions(
    await repository.listHistoryMonths(userId, baseId),
  );
  const requestedMonth = normalizeReferenceMonth(selectedMonth);
  const activeMonth =
    months.find((month) => month.value === requestedMonth)?.value ??
    months[0]?.value ??
    "";
  const operations = months.length > 0
    ? await repository.listHistoryOperationsByMonth(activeMonth, userId, baseId)
    : [];

  return {
    months,
    operations,
    selectedMonth: activeMonth,
  };
}

export async function getCalculatorPageData() {
  return {
    bookmakers: await getBookmakersCatalog(),
  };
}
