import { calculateSurebet } from "@/core";

import { getBookmakerCommission, getNetOdd } from "./exchange";

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
  commission_percent?: number;
  raw_price?: number;
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
  commission: number;
  odd: number;
  paCategory: DuploPaCategory;
  rawOdd: number;
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
    commission: odd.commission_percent ?? 0,
    marketLabel,
    odd: odd.price,
    rawOdd: odd.raw_price ?? odd.price,
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
function indexBestOdds(
  event: DuploEvent,
  includeOdd: (odd: DuploOddItem) => boolean = () => true,
): BestOddsIndex {
  const index: BestOddsIndex = { away: {}, draw: null, home: {} };

  for (const odd of event.odds) {
    if (!is1x2Odd(odd) || toFiniteNumber(odd.price) <= 1 || !includeOdd(odd)) {
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
export function getBestDuploOpportunities(rawEvent: DuploEvent): DuploOpportunity[] {
  // Com a comissao ja descontada, a melhor odd liquida de cada perna segue sendo a campea.
  const index = indexBestOdds(applyExchangeCommission(rawEvent));

  if (!index.draw) {
    return [];
  }

  const opportunities: DuploOpportunity[] = [];

  for (const mode of duploModes) {
    for (const config of mlConfigs[mode]) {
      pushOpportunity(
        opportunities,
        buildMlOpportunityFromLegs(
          index.home[config.home],
          index.draw,
          index.away[config.away],
          mode,
        ),
      );
    }
  }

  return sortOpportunities(opportunities);
}

export const BET365_BOOKMAKER_KEY = "bet365";
export const BET365_BOOKMAKER_LABEL = "Bet365";
// Parâmetro da URL do evento aberto pelo Semanal Bet365.
export const REQUIRED_BOOKMAKER_PARAM = "casaObrigatoria";

export function isRequiredBookmaker(
  odd: { bookmaker_name?: string; bookmaker_slug?: string },
  bookmakerKey: string,
) {
  const key = normalizeToken(bookmakerKey);
  return (
    normalizeToken(odd.bookmaker_slug ?? "") === key ||
    normalizeToken(odd.bookmaker_name ?? "") === key
  );
}

// Melhor combinacao de cada modo com a casa obrigatoria em pelo menos uma perna.
// Fixada a perna da casa, o lucro so sobe com as outras odds, entao basta testar a
// casa em cada perna (casa, empate, fora) com as melhores odds gerais nas demais.
export function getBestDuploOpportunitiesWithBookmaker(
  rawEvent: DuploEvent,
  bookmakerKey: string,
): DuploOpportunity[] {
  const event = applyExchangeCommission(rawEvent);
  const best = indexBestOdds(event);
  const required = indexBestOdds(event, (odd) => isRequiredBookmaker(odd, bookmakerKey));
  const opportunities: DuploOpportunity[] = [];

  for (const mode of duploModes) {
    for (const config of mlConfigs[mode]) {
      const candidates = [
        [required.home[config.home], best.draw, best.away[config.away]],
        [best.home[config.home], required.draw, best.away[config.away]],
        [best.home[config.home], best.draw, required.away[config.away]],
      ] as const;
      const modeOpportunities: DuploOpportunity[] = [];

      for (const [home, draw, away] of candidates) {
        pushOpportunity(
          modeOpportunities,
          buildMlOpportunityFromLegs(home, draw, away, mode),
        );
      }

      pushOpportunity(opportunities, sortOpportunities(modeOpportunities)[0] ?? null);
    }
  }

  return sortOpportunities(opportunities);
}

function buildMlOpportunityFromLegs(
  home: DuploOddItem | null | undefined,
  draw: DuploOddItem | null | undefined,
  away: DuploOddItem | null | undefined,
  mode: DuploMode,
) {
  if (!home || !draw || !away) {
    return null;
  }

  return buildOpportunity(
    [
      toLine(home, selectionLabels.HOME, "1X2"),
      toLine(draw, selectionLabels.DRAW, "1X2"),
      toLine(away, selectionLabels.AWAY, "1X2"),
    ],
    mode,
    "ML",
    "Calculadora ML",
  );
}

// Garante a melhor odd da casa obrigatória entre as candidatas da perna, mesmo fora do top.
function withRequiredOdd(
  odds: DuploOddItem[],
  candidates: DuploOddItem[],
  requiredBookmaker: string | null,
) {
  if (!requiredBookmaker || odds.some((odd) => isRequiredBookmaker(odd, requiredBookmaker))) {
    return odds;
  }

  const required = candidates
    .filter((odd) => isRequiredBookmaker(odd, requiredBookmaker))
    .sort(compareByOdd)[0];

  return required ? [...odds, required] : odds;
}

function buildMlOpportunities(
  event: DuploEvent,
  mode: DuploMode,
  requiredBookmaker: string | null = null,
) {
  const opportunities: DuploOpportunity[] = [];
  const legCandidates = (selection: DuploSelection, category?: DuploPaCategory) =>
    event.odds.filter(
      (odd) =>
        is1x2Odd(odd) &&
        getSelection(odd.selection) === selection &&
        (!category || getSafePaCategory(odd.pa_category) === category) &&
        toFiniteNumber(odd.price) > 1,
    );

  for (const config of mlConfigs[mode]) {
    const homeOdds = withRequiredOdd(
      get1x2Odds(event, "HOME", config.home),
      legCandidates("HOME", config.home),
      requiredBookmaker,
    );
    const drawOdds = withRequiredOdd(
      getBest1x2Odds(event, "DRAW"),
      legCandidates("DRAW"),
      requiredBookmaker,
    );
    const awayOdds = withRequiredOdd(
      get1x2Odds(event, "AWAY", config.away),
      legCandidates("AWAY", config.away),
      requiredBookmaker,
    );

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

  return sortOpportunities(
    requiredBookmaker
      ? opportunities.filter((opportunity) =>
          opportunity.lines.some((line) =>
            isRequiredBookmaker(
              { bookmaker_name: line.bookmakerName, bookmaker_slug: line.bookmakerSlug },
              requiredBookmaker,
            ),
          ),
        )
      : opportunities,
  );
}

// A comissão entra antes do ranking: odds e cálculos passam a usar o valor líquido.
export function applyExchangeCommission<T extends DuploEvent>(event: T): T {
  return {
    ...event,
    odds: event.odds.map((odd) => {
      const commission = getBookmakerCommission(odd.bookmaker_name, odd.bookmaker_slug);

      if (!commission || odd.commission_percent !== undefined) {
        return odd;
      }

      return {
        ...odd,
        commission_percent: commission,
        price: getNetOdd(odd.price, commission),
        raw_price: odd.price,
      };
    }),
  };
}

// Analise completa, com as alternativas alem da melhor combinacao. Custa ~1 ms
// para um jogo, entao serve o detalhe; as listas usam getBestDuploOpportunities.
// Com casa obrigatória (Semanal Bet365), só entram combinações com ela em alguma perna.
export function buildDuploAnalysis(
  rawEvent: DuploEvent,
  requiredBookmaker: string | null = null,
): DuploAnalysis {
  const event = applyExchangeCommission(rawEvent);
  const semPaMlTop = buildMlOpportunities(event, "sem_pa", requiredBookmaker).slice(0, 5);
  const paSingleTop = buildMlOpportunities(event, "pa_um_lado", requiredBookmaker).slice(0, 5);
  const paBothTop = buildMlOpportunities(event, "pa_dois_lados", requiredBookmaker).slice(0, 5);
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
