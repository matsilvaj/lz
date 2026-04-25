import "server-only";

import { getProceduresRepository } from "@/lib/server";

function toNumber(value, defaultValue = 0) {
  const parsed = Number(value ?? defaultValue);
  return Number.isFinite(parsed) ? parsed : defaultValue;
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

function parseOperationDate(value = "") {
  const [day, month, year] = String(value).split("/").map(Number);

  if (!Number.isInteger(day) || !Number.isInteger(month) || !Number.isInteger(year)) {
    return 0;
  }

  return year * 10000 + month * 100 + day;
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
    const label = String(procedure.mes_referencia ?? "").trim() || "Sem mes";
    const current = groups.get(label) ?? { label, value: 0, count: 0 };
    current.value += toNumber(procedure.lucro_real);
    current.count += 1;
    groups.set(label, current);
  }

  return [...groups.values()]
    .sort((left, right) => parseReferenceMonth(left.label) - parseReferenceMonth(right.label))
    .slice(limit > 0 ? -limit : 0);
}

function buildTypeBreakdown(procedures) {
  const groups = new Map();

  for (const procedure of procedures ?? []) {
    const label = String(procedure.tipo_procedimento ?? "").trim() || "Sem tipo";
    const current = groups.get(label) ?? { label, count: 0, profit: 0 };
    current.count += 1;
    current.profit += toNumber(procedure.lucro_real);
    groups.set(label, current);
  }

  return [...groups.values()].sort((left, right) => right.count - left.count);
}

function buildBookmakerUsageData(ranking) {
  return (ranking?.mais_usadas ?? []).map((name) => ({
    label: name,
    value: toNumber(ranking?.frequencia?.[name]),
  }));
}

function buildMonthGroups(procedures, limit = 6) {
  return buildMonthlyProfitSeries(procedures, 0)
    .slice()
    .sort((left, right) => parseReferenceMonth(right.label) - parseReferenceMonth(left.label))
    .slice(0, limit);
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

function buildBookmakersSummary(bookmakers, usage) {
  const topBalance =
    [...(bookmakers ?? [])].sort((left, right) => toNumber(right.saldo) - toNumber(left.saldo))[0] ??
    null;

  return {
    totalBalance: sum(bookmakers, (bookmaker) => bookmaker.saldo),
    totalBookmakers: bookmakers.length,
    topBalance,
    topUsage: usage[0] ?? null,
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

export async function getDashboardData() {
  const repository = getProceduresRepository();
  const [
    procedures,
    activeFreebets,
    convertedFreebets,
    bookmakers,
    ranking,
  ] = await Promise.all([
    repository.listProcedures(),
    repository.listActiveFreebets(),
    repository.listConvertedFreebets(),
    repository.listBookmakersWithBalance(),
    repository.listBookmakersRankedByUsage(),
  ]);

  const freebetsSummary = buildFreebetsSummary(activeFreebets, convertedFreebets);

  return {
    metrics: {
      totalProfit: sum(procedures, (procedure) => procedure.lucro_real),
      totalProcedures: procedures.length,
      activeFreebetsCount: freebetsSummary.convertibleCount,
      pendingConfirmations: freebetsSummary.pendingConfirmationCount,
      totalBankBalance: sum(bookmakers, (bookmaker) => bookmaker.saldo),
      totalBookmakers: bookmakers.length,
      convertedFreebetsCount: freebetsSummary.convertedCount,
      convertedFreebetsProfit: freebetsSummary.convertedProfit,
    },
    monthlyProfit: buildMonthlyProfitSeries(procedures, 6),
    typeBreakdown: buildTypeBreakdown(procedures),
    recentProcedures: sortProceduresDesc(procedures).slice(0, 8),
    bookmakerUsage: buildBookmakerUsageData(ranking).slice(0, 6),
  };
}

export async function getProceduresPageData() {
  const repository = getProceduresRepository();
  const [procedures, bookmakers] = await Promise.all([
    repository.listProcedures(),
    repository.listBookmakers(),
  ]);
  const latestReferenceMonth =
    sortProceduresDesc(procedures)[0]?.mes_referencia ?? buildMonthlyProfitSeries(procedures, 1)[0]?.label;

  return {
    procedures: sortProceduresDesc(procedures),
    bookmakers,
    heading: latestReferenceMonth
      ? `Procedimentos - ${formatReferenceMonthLabel(latestReferenceMonth)}`
      : "Procedimentos",
  };
}

export async function getFreebetsPageData() {
  const repository = getProceduresRepository();
  const [activeFreebets, convertedFreebets, bookmakers] = await Promise.all([
    repository.listActiveFreebets(),
    repository.listConvertedFreebets(),
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

export async function getBookmakersPageData() {
  const repository = getProceduresRepository();
  const [bookmakers, ranking] = await Promise.all([
    repository.listBookmakersWithBalance(),
    repository.listBookmakersRankedByUsage(),
  ]);

  const usage = buildBookmakerUsageData(ranking).slice(0, 8);

  return {
    bookmakers,
    usage,
    summary: buildBookmakersSummary(bookmakers, usage),
  };
}

export async function getHistoryPageData() {
  const repository = getProceduresRepository();
  const procedures = await repository.listProcedures();
  const monthlyProfit = buildMonthlyProfitSeries(procedures, 8);

  return {
    timeline: sortProceduresDesc(procedures).slice(0, 18),
    monthlyProfit,
    monthGroups: buildMonthGroups(procedures, 6),
    summary: {
      totalMonths: monthlyProfit.length,
      totalProcedures: procedures.length,
      totalProfit: sum(procedures, (procedure) => procedure.lucro_real),
      latestMonth: monthlyProfit.at(-1) ?? null,
    },
  };
}

export async function getCalculatorPageData() {
  const repository = getProceduresRepository();
  return {
    bookmakers: await repository.listBookmakers(),
  };
}
