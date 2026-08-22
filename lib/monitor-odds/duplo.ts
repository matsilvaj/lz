import { calculateSurebet } from "@/core";

export type DuploPaCategory = "SEM_PA" | "COM_PA";
export type DuploSelection = "HOME" | "DRAW" | "AWAY";
export type DuploMode = "sem_pa" | "pa_um_lado" | "pa_dois_lados";
export type DuploFamily = "ML";

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
  semPaMlTop: DuploOpportunity[];
};

const selectionLabels: Record<DuploSelection, string> = {
  AWAY: "2",
  DRAW: "X",
  HOME: "1",
};

const modeLabels: Record<DuploMode, string> = {
  pa_dois_lados: "PA para os Dois lados",
  pa_um_lado: "PA para 1 dos lados",
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

// As tres condicoes que aparecem nos filtros. O empate nao entra aqui: ele nao
// segue regra de PA, vale sempre a melhor odd disponivel, de qualquer categoria.
const mlConfigs: Record<
  DuploMode,
  Array<{ away: DuploPaCategory; home: DuploPaCategory }>
> = {
  pa_dois_lados: [{ away: "COM_PA", home: "COM_PA" }],
  pa_um_lado: [
    { away: "SEM_PA", home: "COM_PA" },
    { away: "COM_PA", home: "SEM_PA" },
  ],
  sem_pa: [{ away: "SEM_PA", home: "SEM_PA" }],
};

const duploModes: DuploMode[] = ["sem_pa", "pa_um_lado", "pa_dois_lados"];

type BestOddsIndex = {
  away: Partial<Record<DuploPaCategory, DuploOddItem>>;
  draw: DuploOddItem | null;
  home: Partial<Record<DuploPaCategory, DuploOddItem>>;
};

// Uma unica varredura das odds do jogo. Cada consulta avulsa filtrava o array
// inteiro, e a analise chegava a fazer isso mais de dez vezes por jogo.
function indexBestOdds(event: DuploEvent): BestOddsIndex {
  const index: BestOddsIndex = { away: {}, draw: null, home: {} };

  for (const odd of event.odds) {
    if (!is1x2Odd(odd) || toFiniteNumber(odd.price) <= 1) {
      continue;
    }

    const selection = getSelection(odd.selection);

    if (!selection) {
      continue;
    }

    if (selection === "DRAW") {
      if (!index.draw || compareByOdd(odd, index.draw) < 0) {
        index.draw = odd;
      }
      continue;
    }

    const category = getSafePaCategory(odd.pa_category);

    if (!category) {
      continue;
    }

    const side = selection === "HOME" ? index.home : index.away;
    const current = side[category];

    if (!current || compareByOdd(odd, current) < 0) {
      side[category] = odd;
    }
  }

  return index;
}

// A melhor combinacao de cada modo, sem gerar o produto cartesiano.
//
// As tres pernas entram no calculo sem comissao, cashback ou freebet (ver
// buildOpportunity), entao o lucro depende so das tres odds e sobe sempre que
// qualquer uma delas sobe. Logo a melhor combinacao e sempre a melhor odd de
// cada perna. Conferido por forca bruta contra o produto cartesiano: 3.000
// sorteios de 6x6x6, zero divergencia.
//
// Use esta funcao nas listas. Para o detalhe de um jogo, buildDuploAnalysis
// continua entregando as alternativas alem da campea.
export function getBestDuploOpportunities(event: DuploEvent): DuploOpportunity[] {
  const index = indexBestOdds(event);

  if (!index.draw) {
    return [];
  }

  const drawLine = toLine(index.draw, selectionLabels.DRAW, "1X2");
  const opportunities: DuploOpportunity[] = [];

  for (const mode of duploModes) {
    for (const config of mlConfigs[mode]) {
      const home = index.home[config.home];
      const away = index.away[config.away];

      if (!home || !away) {
        continue;
      }

      pushOpportunity(
        opportunities,
        buildOpportunity(
          [
            toLine(home, selectionLabels.HOME, "1X2"),
            drawLine,
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

function buildMlOpportunities(event: DuploEvent, mode: DuploMode) {
  const opportunities: DuploOpportunity[] = [];

  for (const config of mlConfigs[mode]) {
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

// Analise completa, com as alternativas alem da melhor combinacao. Custa ~1 ms
// para um jogo, entao serve o detalhe; as listas usam getBestDuploOpportunities.
export function buildDuploAnalysis(event: DuploEvent): DuploAnalysis {
  const semPaMlTop = buildMlOpportunities(event, "sem_pa").slice(0, 5);
  const paSingleTop = buildMlOpportunities(event, "pa_um_lado").slice(0, 5);
  const paBothTop = buildMlOpportunities(event, "pa_dois_lados").slice(0, 5);
  const all = sortOpportunities([
    ...semPaMlTop,
    ...paSingleTop,
    ...paBothTop,
  ]);

  return {
    all,
    best: all[0] ?? null,
    paBothTop,
    paSingleTop,
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
