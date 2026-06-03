import { calculateSurebet } from "@/core";

export type DuploPaCategory = "SEM_PA" | "COM_PA";
export type DuploSelection = "HOME" | "DRAW" | "AWAY";
export type DuploMode = "sem_pa" | "pa_um_lado" | "pa_dois_lados";
export type DuploFamily = "ML" | "DC";
export type DuploDoubleChanceKey = "HOME_DRAW" | "DRAW_AWAY" | "HOME_AWAY";

export type DuploOddItem = {
  bookmaker_event_url: string | null;
  bookmaker_name: string;
  bookmaker_slug: string;
  market_code: string;
  market_name: string;
  odd_updated_at: string | null;
  pa_category: string;
  price: number;
  selection: string;
};

export type DuploEvent = {
  away_team: string;
  fixture_id: string;
  fixture_name: string;
  home_team: string;
  league_country: string | null;
  league_name: string;
  starts_at: string;
  odds: DuploOddItem[];
};

export type DuploOpportunityLine = {
  bookmakerName: string;
  bookmakerSlug: string;
  eventUrl: string | null;
  marketLabel: string;
  odd: number;
  paCategory: DuploPaCategory;
  selectionLabel: string;
};

export type DuploOpportunity = {
  family: DuploFamily;
  investment: number;
  lines: DuploOpportunityLine[];
  mode: DuploMode;
  modeLabel: string;
  profitAmount: number;
  profitPercent: number;
  referenceReturn: number;
  title: string;
};

export type DuploAnalysis = {
  all: DuploOpportunity[];
  best: DuploOpportunity | null;
  paBothTop: DuploOpportunity[];
  paSingleTop: DuploOpportunity[];
  semPaDcTop: DuploOpportunity[];
  semPaMlTop: DuploOpportunity[];
};

const selectionLabels: Record<DuploSelection, string> = {
  AWAY: "2",
  DRAW: "X",
  HOME: "1",
};

const doubleChanceLabels: Record<DuploDoubleChanceKey, string> = {
  DRAW_AWAY: "X2",
  HOME_AWAY: "12",
  HOME_DRAW: "1X",
};

const modeLabels: Record<DuploMode, string> = {
  pa_dois_lados: "PA Casa e Fora",
  pa_um_lado: "PA Casa ou Fora",
  sem_pa: "Sem PA",
};

const topOddsPerSelection = 6;

function toFiniteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeToken(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function formatDuploBookmakerName(value: string) {
  const formatted = value
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      const rest = word.slice(1);
      const hasInternalCase = /[a-z][A-Z]/.test(word) || /[0-9][A-Z]/.test(word);
      const normalizedRest = hasInternalCase
        ? rest
        : rest.toLocaleLowerCase("pt-BR");

      return `${word.charAt(0).toLocaleUpperCase("pt-BR")}${normalizedRest}`;
    })
    .join(" ");

  return formatted || "Casa";
}

function isPaCategory(value: string): value is DuploPaCategory {
  return value === "SEM_PA" || value === "COM_PA";
}

function getSafePaCategory(value: string): DuploPaCategory | null {
  const normalized = normalizeToken(value);

  if (normalized === "SEM_PA") return "SEM_PA";
  if (normalized === "COM_PA") return "COM_PA";
  return null;
}

function is1x2Odd(odd: DuploOddItem) {
  return normalizeToken(odd.market_code) === "1X2";
}

function getSelection(value: string): DuploSelection | null {
  const normalized = normalizeToken(value);

  if (["HOME", "CASA", "1"].includes(normalized)) return "HOME";
  if (["DRAW", "EMPATE", "X"].includes(normalized)) return "DRAW";
  if (["AWAY", "FORA", "2"].includes(normalized)) return "AWAY";
  return null;
}

function getDoubleChanceKey(odd: DuploOddItem): DuploDoubleChanceKey | null {
  const selection = normalizeToken(odd.selection);
  const marketCode = normalizeToken(odd.market_code);
  const marketName = normalizeToken(odd.market_name);
  const combined = `${selection}_${marketCode}_${marketName}`;

  const looksLikeDoubleChance =
    marketCode.includes("DC") ||
    marketCode.includes("DOUBLE_CHANCE") ||
    marketName.includes("DUPLA_CHANCE") ||
    marketName.includes("DOUBLE_CHANCE");

  if (!looksLikeDoubleChance && !["1X", "X2", "12"].includes(selection)) {
    return null;
  }

  if (
    ["1X", "HOME_DRAW", "CASA_EMPATE", "HOME_OR_DRAW"].includes(selection) ||
    combined.includes("1X")
  ) {
    return "HOME_DRAW";
  }

  if (
    ["X2", "DRAW_AWAY", "EMPATE_FORA", "DRAW_OR_AWAY"].includes(selection) ||
    combined.includes("X2")
  ) {
    return "DRAW_AWAY";
  }

  if (
    ["12", "HOME_AWAY", "CASA_FORA", "HOME_OR_AWAY"].includes(selection) ||
    combined.includes("12")
  ) {
    return "HOME_AWAY";
  }

  return null;
}

function compareByOdd(left: DuploOddItem, right: DuploOddItem) {
  const priceOrder = right.price - left.price;
  if (priceOrder !== 0) return priceOrder;
  return left.bookmaker_name.localeCompare(right.bookmaker_name, "pt-BR");
}

function uniqueTopOdds(odds: DuploOddItem[]) {
  const byBookmaker = new Map<string, DuploOddItem>();

  for (const odd of odds) {
    const key = odd.bookmaker_slug || odd.bookmaker_name;
    const current = byBookmaker.get(key);

    if (!current || odd.price > current.price) {
      byBookmaker.set(key, odd);
    }
  }

  return Array.from(byBookmaker.values())
    .sort(compareByOdd)
    .slice(0, topOddsPerSelection);
}

function get1x2Odds(
  event: DuploEvent,
  selection: DuploSelection,
  category: DuploPaCategory,
) {
  return uniqueTopOdds(
    event.odds.filter((odd) => {
      const oddCategory = getSafePaCategory(odd.pa_category);

      return (
        is1x2Odd(odd) &&
        oddCategory === category &&
        getSelection(odd.selection) === selection &&
        toFiniteNumber(odd.price) > 1
      );
    }),
  );
}

function getBest1x2Odds(event: DuploEvent, selection: DuploSelection) {
  return uniqueTopOdds(
    event.odds.filter((odd) => {
      return (
        is1x2Odd(odd) &&
        getSelection(odd.selection) === selection &&
        toFiniteNumber(odd.price) > 1
      );
    }),
  );
}

function getDoubleChanceOdds(
  event: DuploEvent,
  key: DuploDoubleChanceKey,
  category: DuploPaCategory,
) {
  return uniqueTopOdds(
    event.odds.filter((odd) => {
      const oddCategory = getSafePaCategory(odd.pa_category);

      return (
        oddCategory === category &&
        getDoubleChanceKey(odd) === key &&
        toFiniteNumber(odd.price) > 1
      );
    }),
  );
}

function toLine(
  odd: DuploOddItem,
  selectionLabel: string,
  marketLabel: string,
): DuploOpportunityLine {
  const paCategory = getSafePaCategory(odd.pa_category) ?? "SEM_PA";

  return {
    bookmakerName: formatDuploBookmakerName(odd.bookmaker_name),
    bookmakerSlug: odd.bookmaker_slug,
    eventUrl: odd.bookmaker_event_url,
    marketLabel,
    odd: odd.price,
    paCategory,
    selectionLabel,
  };
}

function buildOpportunity(
  lines: DuploOpportunityLine[],
  mode: DuploMode,
  family: DuploFamily,
  title: string,
): DuploOpportunity | null {
  if (lines.length < 2 || lines.some((line) => line.odd <= 1)) {
    return null;
  }

  try {
    const calculation = calculateSurebet(
      lines.map((line, index) => ({
        odd: line.odd,
        stake: index === 0 ? 100 : 0,
        tipo: "B",
      })),
      0,
    );
    const investment = toFiniteNumber(calculation.investimento_efetivo);
    const profitAmount = toFiniteNumber(calculation.lucro_liquido);
    const profitPercent = toFiniteNumber(calculation.lucro_percentual);
    const referenceReturn = toFiniteNumber(calculation.retorno_referencia);

    if (!investment) {
      return null;
    }

    return {
      family,
      investment,
      lines,
      mode,
      modeLabel: modeLabels[mode],
      profitAmount,
      profitPercent,
      referenceReturn,
      title,
    };
  } catch {
    return null;
  }
}

function pushOpportunity(
  opportunities: DuploOpportunity[],
  opportunity: DuploOpportunity | null,
) {
  if (opportunity) {
    opportunities.push(opportunity);
  }
}

function sortOpportunities(opportunities: DuploOpportunity[]) {
  return [...opportunities].sort((left, right) => {
    const profitOrder = right.profitPercent - left.profitPercent;
    if (profitOrder !== 0) return profitOrder;
    return right.profitAmount - left.profitAmount;
  });
}

function combineThree<T>(left: T[], middle: T[], right: T[]) {
  const combinations: [T, T, T][] = [];

  for (const first of left) {
    for (const second of middle) {
      for (const third of right) {
        combinations.push([first, second, third]);
      }
    }
  }

  return combinations;
}

function buildMlOpportunities(event: DuploEvent, mode: DuploMode) {
  const opportunities: DuploOpportunity[] = [];
  const configs =
    mode === "sem_pa"
      ? [{ home: "SEM_PA", draw: "SEM_PA", away: "SEM_PA" }]
      : mode === "pa_um_lado"
        ? [
            { home: "COM_PA", draw: "SEM_PA", away: "SEM_PA" },
            { home: "SEM_PA", draw: "SEM_PA", away: "COM_PA" },
          ]
        : [{ home: "COM_PA", draw: "SEM_PA", away: "COM_PA" }];

  for (const config of configs) {
    if (
      !isPaCategory(config.home) ||
      !isPaCategory(config.draw) ||
      !isPaCategory(config.away)
    ) {
      continue;
    }

    const homeOdds = get1x2Odds(event, "HOME", config.home);
    const drawOdds = getBest1x2Odds(event, "DRAW");
    const awayOdds = get1x2Odds(event, "AWAY", config.away);

    for (const [home, draw, away] of combineThree(homeOdds, drawOdds, awayOdds)) {
      pushOpportunity(
        opportunities,
        buildOpportunity(
          [
            toLine(home, selectionLabels.HOME, "1X2"),
            toLine(draw, selectionLabels.DRAW, "1X2"),
            toLine(away, selectionLabels.AWAY, "1X2"),
          ],
          mode,
          "ML",
          "Calculadora ML",
        ),
      );
    }
  }

  return sortOpportunities(opportunities);
}

function getOppositeDoubleChance(selection: DuploSelection) {
  if (selection === "HOME") return "DRAW_AWAY";
  if (selection === "AWAY") return "HOME_DRAW";
  return "HOME_AWAY";
}

function buildDcOpportunities(event: DuploEvent, mode: DuploMode) {
  const opportunities: DuploOpportunity[] = [];
  const selectionsForDc: DuploSelection[] = ["HOME", "DRAW", "AWAY"];
  const configs =
    mode === "sem_pa"
      ? [{ straight: "SEM_PA", doubleChance: "SEM_PA" }]
      : mode === "pa_um_lado"
        ? [
            { straight: "COM_PA", doubleChance: "SEM_PA" },
            { straight: "SEM_PA", doubleChance: "COM_PA" },
          ]
        : [{ straight: "COM_PA", doubleChance: "COM_PA" }];

  for (const config of configs) {
    if (
      !isPaCategory(config.straight) ||
      !isPaCategory(config.doubleChance)
    ) {
      continue;
    }

    for (const selection of selectionsForDc) {
      const straightOdds = get1x2Odds(event, selection, config.straight);
      const doubleChanceKey = getOppositeDoubleChance(selection);
      const doubleChanceOdds = getDoubleChanceOdds(
        event,
        doubleChanceKey,
        config.doubleChance,
      );

      for (const straight of straightOdds) {
        for (const doubleChance of doubleChanceOdds) {
          pushOpportunity(
            opportunities,
            buildOpportunity(
              [
                toLine(
                  straight,
                  selectionLabels[selection],
                  "1X2",
                ),
                toLine(
                  doubleChance,
                  doubleChanceLabels[doubleChanceKey],
                  "Dupla chance",
                ),
              ],
              mode,
              "DC",
              "Calculadora DC",
            ),
          );
        }
      }
    }
  }

  return sortOpportunities(opportunities);
}

export function buildDuploAnalysis(event: DuploEvent): DuploAnalysis {
  const semPaMlTop = buildMlOpportunities(event, "sem_pa").slice(0, 5);
  const semPaDcTop = buildDcOpportunities(event, "sem_pa").slice(0, 5);
  const paSingleTop = sortOpportunities([
    ...buildMlOpportunities(event, "pa_um_lado"),
    ...buildDcOpportunities(event, "pa_um_lado"),
  ]).slice(0, 5);
  const paBothTop = sortOpportunities([
    ...buildMlOpportunities(event, "pa_dois_lados"),
    ...buildDcOpportunities(event, "pa_dois_lados"),
  ]).slice(0, 5);
  const all = sortOpportunities([
    ...semPaMlTop,
    ...semPaDcTop,
    ...paSingleTop,
    ...paBothTop,
  ]);

  return {
    all,
    best: all[0] ?? null,
    paBothTop,
    paSingleTop,
    semPaDcTop,
    semPaMlTop,
  };
}

export function getBestDuploOpportunity(
  event: DuploEvent,
  mode: DuploMode | "all" = "all",
) {
  const analysis = buildDuploAnalysis(event);
  const opportunities =
    mode === "all"
      ? analysis.all
      : analysis.all.filter((opportunity) => opportunity.mode === mode);

  return opportunities[0] ?? null;
}

export function formatDuploPercent(value: number) {
  const safeValue = Math.abs(value) < 0.005 ? 0 : value;
  return `${safeValue.toFixed(2)}%`;
}

export function getDuploModeLabel(mode: DuploMode | "all") {
  return mode === "all" ? "Todos" : modeLabels[mode];
}
