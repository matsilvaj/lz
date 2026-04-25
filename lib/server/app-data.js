import "server-only";

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

function sum(items, selectValue) {
  return (items ?? []).reduce((total, item) => total + toNumber(selectValue(item)), 0);
}

function parseReferenceMonth(value = "") {
  const [month, year] = String(value).split("/").map(Number);

  if (!Number.isInteger(month) || !Number.isInteger(year)) {
    return 0;
  }

  return year * 100 + month;
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

function buildReferenceMonthFromDateParts(parts) {
  if (!parts) {
    return "";
  }

  return `${padNumber(parts.month)}/${parts.year}`;
}

function buildReferenceMonthFromOperationDate(value = "") {
  return buildReferenceMonthFromDateParts(parseOperationDateParts(value));
}

function buildCurrentOperationDate(now = new Date()) {
  return `${padNumber(now.getDate())}/${padNumber(now.getMonth() + 1)}/${now.getFullYear()}`;
}

function buildCurrentReferenceMonth(now = new Date()) {
  return `${padNumber(now.getMonth() + 1)}/${now.getFullYear()}`;
}

function buildMonthTimeline(referenceMonth) {
  const parts = parseReferenceMonthParts(referenceMonth);

  if (!parts) {
    return [];
  }

  const totalDays = new Date(parts.year, parts.month, 0).getDate();

  return Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1;
    const fullLabel = `${padNumber(day)}/${padNumber(parts.month)}/${parts.year}`;

    return {
      fullLabel,
      label: fullLabel.slice(0, 5),
      dateKey: parseOperationDate(fullLabel),
    };
  });
}

function getProcedureReferenceMonth(procedure) {
  const explicitReferenceMonth = String(procedure?.mes_referencia ?? "").trim();

  if (explicitReferenceMonth) {
    return explicitReferenceMonth;
  }

  return buildReferenceMonthFromOperationDate(procedure?.data_operacao);
}

function sortProceduresDesc(procedures) {
  return [...(procedures ?? [])].sort((left, right) => {
    const idDiff = toNumber(right.id) - toNumber(left.id);
    if (idDiff !== 0) {
      return idDiff;
    }

    return parseOperationDate(right.data_operacao) - parseOperationDate(left.data_operacao);
  });
}

function buildMonthlyProfitSeries(procedures, limit = 6) {
  const groups = new Map();

  for (const procedure of procedures ?? []) {
    const label = getProcedureReferenceMonth(procedure) || "Sem mes";
    const current = groups.get(label) ?? { label, value: 0, count: 0 };
    current.value += toNumber(procedure.lucro_real);
    current.count += 1;
    groups.set(label, current);
  }

  return [...groups.values()]
    .sort((left, right) => parseReferenceMonth(left.label) - parseReferenceMonth(right.label))
    .slice(limit > 0 ? -limit : 0);
}

function buildHistoryMonths(procedures) {
  return buildMonthlyProfitSeries(procedures, 0)
    .slice()
    .sort((left, right) => parseReferenceMonth(right.label) - parseReferenceMonth(left.label))
    .map((item) => ({
      value: item.label,
      label: item.label || "Sem mes",
      profit: item.value,
      count: item.count,
    }));
}

function buildFreebetsSummary(activeFreebets, convertedFreebets) {
  const pendingConfirmation = activeFreebets?.pendentes_confirmacao ?? [];
  const convertibleGroups = activeFreebets?.agrupadas_convertiveis ?? [];

  return {
    pendingConfirmationCount: pendingConfirmation.length,
    convertibleCount: sum(convertibleGroups, (item) => item.quantidade),
    convertibleValue: sum(convertibleGroups, (item) => item.valor_total),
    convertedCount: convertedFreebets.length,
    convertedProfit: sum(convertedFreebets, (item) => item.lucro_total),
    activeProfit:
      sum(convertibleGroups, (item) => item.lucro_total) +
      sum(pendingConfirmation, (item) => item.lucro_real),
  };
}

function getLatestReferenceMonth(procedures) {
  return [...(procedures ?? [])]
    .map((procedure) => getProcedureReferenceMonth(procedure))
    .filter(Boolean)
    .sort((left, right) => parseReferenceMonth(right) - parseReferenceMonth(left))[0];
}

function filterProceduresByType(procedures, procedureType) {
  const normalizedType = String(procedureType ?? "").trim();

  if (!normalizedType || normalizedType === "Todos") {
    return [...(procedures ?? [])];
  }

  return (procedures ?? []).filter(
    (procedure) => String(procedure.tipo_procedimento ?? "").trim() === normalizedType,
  );
}

function buildDashboardReferenceMonth(procedures) {
  const currentReferenceMonth = buildCurrentReferenceMonth();
  const hasCurrentMonthData = (procedures ?? []).some(
    (procedure) => getProcedureReferenceMonth(procedure) === currentReferenceMonth,
  );

  if (hasCurrentMonthData) {
    return currentReferenceMonth;
  }

  return getLatestReferenceMonth(procedures) || currentReferenceMonth;
}

function filterProceduresByReferenceMonth(procedures, referenceMonth) {
  return (procedures ?? []).filter(
    (procedure) => getProcedureReferenceMonth(procedure) === referenceMonth,
  );
}

function buildDailyOperationSeries(procedures, referenceMonth) {
  const groups = new Map();

  for (const procedure of procedures ?? []) {
    const dateLabel = String(procedure.data_operacao ?? "").trim();
    const dateKey = parseOperationDate(dateLabel);

    if (!dateLabel || dateKey === 0) {
      continue;
    }

    const current = groups.get(dateLabel) ?? {
      label: dateLabel.slice(0, 5),
      fullLabel: dateLabel,
      dateKey,
      profit: 0,
      volume: 0,
    };

    current.profit += toNumber(procedure.lucro_real);
    current.volume += 1;
    groups.set(dateLabel, current);
  }

  return buildMonthTimeline(referenceMonth).map((day) => {
    const current = groups.get(day.fullLabel);

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

function buildMonthlyEvolutionSeries(dailySeries) {
  let accumulatedProfit = 0;

  return (dailySeries ?? []).map((item) => {
    accumulatedProfit += toNumber(item.profit);

    return {
      label: item.label,
      value: accumulatedProfit,
    };
  });
}

function buildDailyCollectedFreebetSeries(procedures, referenceMonth) {
  const groups = new Map();

  for (const procedure of filterProceduresByReferenceMonth(procedures, referenceMonth)) {
    if (String(procedure.tipo_procedimento ?? "").trim() !== "Coletar Freebet") {
      continue;
    }

    const dateLabel = String(procedure.data_operacao ?? "").trim();
    const dateKey = parseOperationDate(dateLabel);

    if (!dateLabel || dateKey === 0) {
      continue;
    }

    const current = groups.get(dateLabel) ?? {
      label: dateLabel.slice(0, 5),
      dateKey,
      count: 0,
    };

    current.count += 1;
    groups.set(dateLabel, current);
  }

  return buildMonthTimeline(referenceMonth).map((day) => {
    const current = groups.get(day.fullLabel);

    return {
      label: day.label,
      value: current?.count ?? 0,
    };
  });
}

function buildDailyConvertedFreebetProfitSeries(convertedFreebets, referenceMonth) {
  const groups = new Map();

  for (const item of convertedFreebets ?? []) {
    const conversionDate = String(item?.data_conversao ?? "").trim();

    if (!conversionDate) {
      continue;
    }

    if (buildReferenceMonthFromOperationDate(conversionDate) !== referenceMonth) {
      continue;
    }

    const dateKey = parseOperationDate(conversionDate);

    if (dateKey === 0) {
      continue;
    }

    const current = groups.get(conversionDate) ?? {
      label: conversionDate.slice(0, 5),
      dateKey,
      value: 0,
      count: 0,
    };

    current.value += toNumber(item.lucro_total);
    current.count += 1;
    groups.set(conversionDate, current);
  }

  return buildMonthTimeline(referenceMonth).map((day) => {
    const current = groups.get(day.fullLabel);

    return {
      label: day.label,
      value: current?.value ?? 0,
      detail: `${current?.count ?? 0} freebets`,
    };
  });
}

function buildDashboardMetrics(procedures, referenceMonth) {
  const todayLabel = buildCurrentOperationDate();
  const proceduresToday = (procedures ?? []).filter(
    (procedure) => String(procedure.data_operacao ?? "").trim() === todayLabel,
  );
  const monthlyProcedures = filterProceduresByReferenceMonth(procedures, referenceMonth);
  const activeDays = new Set(
    monthlyProcedures
      .map((procedure) => String(procedure.data_operacao ?? "").trim())
      .filter(Boolean),
  ).size;
  const monthlyProfit = sum(monthlyProcedures, (procedure) => procedure.lucro_real);

  return {
    todayProfit: sum(proceduresToday, (procedure) => procedure.lucro_real),
    monthlyProfit,
    dailyAverage: activeDays > 0 ? monthlyProfit / activeDays : 0,
    averagePerProcedure:
      monthlyProcedures.length > 0 ? monthlyProfit / monthlyProcedures.length : 0,
    proceduresToday: proceduresToday.length,
    todayLabel,
    referenceMonth,
    referenceMonthLabel: formatReferenceMonthLabel(referenceMonth),
    monthlyProcedureCount: monthlyProcedures.length,
    activeDays,
  };
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

function buildFreebetMetrics(procedures, convertedFreebets, referenceMonth) {
  return {
    collectedDaily: buildDailyCollectedFreebetSeries(procedures, referenceMonth),
    convertedProfitDaily: buildDailyConvertedFreebetProfitSeries(
      convertedFreebets,
      referenceMonth,
    ),
  };
}

function buildDashboardView(procedures, referenceMonth) {
  const monthlyProcedures = filterProceduresByReferenceMonth(procedures, referenceMonth);
  const dailySeries = buildDailyOperationSeries(monthlyProcedures, referenceMonth);

  return {
    metrics: buildDashboardMetrics(procedures, referenceMonth),
    monthlyEvolution: buildMonthlyEvolutionSeries(dailySeries),
    dailyProfit: dailySeries.map((item) => ({
      label: item.label,
      value: item.profit,
      detail: `${toNumber(item.volume)} procedimentos`,
    })),
    dailyVolume: dailySeries.map((item) => ({
      label: item.label,
      value: item.volume,
      detail: formatCurrencyValue(item.profit),
    })),
  };
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

export async function getDashboardData(userId, baseId) {
  const repository = getProceduresRepository();
  const [procedures, activeFreebets, convertedFreebets] = await Promise.all([
    repository.listProcedures(userId, baseId),
    repository.listActiveFreebets(userId, baseId),
    repository.listConvertedFreebets(userId, baseId),
  ]);

  const freebetsSummary = buildFreebetsSummary(activeFreebets, convertedFreebets);
  const referenceMonth = buildDashboardReferenceMonth(procedures);
  const procedureFilters = ["Todos", ...PROCEDURE_TYPES];
  const views = Object.fromEntries(
    procedureFilters.map((filter) => [
      filter,
      buildDashboardView(filterProceduresByType(procedures, filter), referenceMonth),
    ]),
  );

  return {
    procedureFilters,
    views,
    openFreebets: buildOpenFreebetMetrics(freebetsSummary),
    freebets: buildFreebetMetrics(procedures, convertedFreebets, referenceMonth),
  };
}

export async function getProceduresPageData(userId, baseId) {
  const repository = getProceduresRepository();
  const [procedures, bookmakers] = await Promise.all([
    repository.listProcedures(userId, baseId),
    repository.listBookmakers(),
  ]);

  return {
    procedures: sortProceduresDesc(procedures),
    bookmakers,
  };
}

export async function getFreebetsPageData(userId, baseId) {
  const repository = getProceduresRepository();
  const [activeFreebets, convertedFreebets, bookmakers] = await Promise.all([
    repository.listActiveFreebets(userId, baseId),
    repository.listConvertedFreebets(userId, baseId),
    repository.listBookmakers(),
  ]);

  return {
    pendingConfirmation: activeFreebets?.pendentes_confirmacao ?? [],
    convertibleGroups: activeFreebets?.agrupadas_convertiveis ?? [],
    convertedHistory: convertedFreebets.slice(0, 20),
    bookmakers,
    summary: buildFreebetsSummary(activeFreebets, convertedFreebets),
  };
}

export async function getBookmakersPageData(userId, baseId) {
  const repository = getProceduresRepository();
  const [bookmakers, availableBookmakers, notes] = await Promise.all([
    repository.listBookmakersWithBalance(userId, baseId),
    repository.listBookmakers(),
    repository.getBookmakersNotes(userId, baseId),
  ]);

  return {
    availableBookmakers,
    bookmakers,
    notes,
  };
}

export async function getHistoryPageData(userId, baseId) {
  const repository = getProceduresRepository();
  const procedures = await repository.listProcedures(userId, baseId);

  return {
    months: buildHistoryMonths(procedures),
    operations: sortProceduresDesc(procedures),
  };
}

export async function getCalculatorPageData() {
  const repository = getProceduresRepository();
  return {
    bookmakers: await repository.listBookmakers(),
  };
}
