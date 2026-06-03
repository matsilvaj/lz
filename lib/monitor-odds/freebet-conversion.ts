import { calculateSurebet } from "@/core";
import {
  formatDuploBookmakerName,
  type DuploEvent,
  type DuploOddItem,
} from "@/lib/monitor-odds/duplo";

export type FreebetConversionPaCategory = "SEM_PA" | "COM_PA";
export type FreebetConversionSelection = "HOME" | "DRAW" | "AWAY";
export type FreebetConversionMode = "sem_pa" | "pa_um_lado" | "pa_dois_lados";

export type FreebetConversionInput = {
  freebetHouse: string;
  freebetValue: number;
  maxOdd?: number;
  minOdd?: number;
};

export type FreebetConversionLine = {
  bookmakerName: string;
  bookmakerSlug: string;
  eventUrl: string | null;
  marketLabel: string;
  odd: number;
  paCategory: FreebetConversionPaCategory;
  role: "freebet" | "protection";
  selectionLabel: string;
  selectionKey: FreebetConversionSelection;
};

export type FreebetConversionOpportunity = {
  conversionPercent: number;
  freebetHouse: string;
  freebetValue: number;
  investment: number;
  lines: FreebetConversionLine[];
  mode: FreebetConversionMode;
  modeLabel: string;
  profitAmount: number;
  profitPercent: number;
  referenceReturn: number;
  title: string;
};

export type FreebetConversionAnalysis = {
  all: FreebetConversionOpportunity[];
  best: FreebetConversionOpportunity | null;
};

const conversionSelectionLabels: Record<FreebetConversionSelection, string> = {
  AWAY: "2",
  DRAW: "X",
  HOME: "1",
};

const conversionModeLabels: Record<FreebetConversionMode, string> = {
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

function normalizeBookmakerToken(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "");
}

export function getFreebetConversionBookmakerKey(
  name: string | null | undefined,
  slug?: string | null,
) {
  const normalizedName = normalizeBookmakerToken(
    formatDuploBookmakerName(name ?? ""),
  );
  const normalizedSlug = normalizeBookmakerToken(slug);

  return normalizedName || normalizedSlug || "casa";
}

function getOddBookmakerKeys(odd: Pick<DuploOddItem, "bookmaker_name" | "bookmaker_slug">) {
  return new Set([
    getFreebetConversionBookmakerKey(odd.bookmaker_name, odd.bookmaker_slug),
    normalizeBookmakerToken(odd.bookmaker_name),
    normalizeBookmakerToken(odd.bookmaker_slug),
  ]);
}

function isSameBookmaker(
  odd: Pick<DuploOddItem, "bookmaker_name" | "bookmaker_slug">,
  bookmakerKey: string,
) {
  return getOddBookmakerKeys(odd).has(bookmakerKey);
}

function getSafePaCategory(value: string): FreebetConversionPaCategory {
  return normalizeToken(value) === "COM_PA" ? "COM_PA" : "SEM_PA";
}

function is1x2Odd(odd: DuploOddItem) {
  return normalizeToken(odd.market_code) === "1X2";
}

function getSelection(value: string): FreebetConversionSelection | null {
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
    const key = `${odd.bookmaker_slug || odd.bookmaker_name}:${getSafePaCategory(
      odd.pa_category,
    )}`;
    const current = byBookmaker.get(key);

    if (!current || odd.price > current.price) {
      byBookmaker.set(key, odd);
    }
  }

  return Array.from(byBookmaker.values())
    .sort(compareByOdd)
    .slice(0, topOddsPerSelection);
}

function get1x2Odds(event: DuploEvent, selection: FreebetConversionSelection) {
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

function getFreebetOdds(
  event: DuploEvent,
  selection: FreebetConversionSelection,
  bookmakerKey: string,
  minOdd: number,
  maxOdd: number,
) {
  return uniqueTopOdds(
    event.odds.filter((odd) => {
      const price = toFiniteNumber(odd.price);

      return (
        is1x2Odd(odd) &&
        getSelection(odd.selection) === selection &&
        isSameBookmaker(odd, bookmakerKey) &&
        price >= minOdd &&
        price <= maxOdd &&
        price > 1
      );
    }),
  );
}

function toLine(
  odd: DuploOddItem,
  selection: FreebetConversionSelection,
  role: FreebetConversionLine["role"],
): FreebetConversionLine {
  return {
    bookmakerName: formatDuploBookmakerName(odd.bookmaker_name),
    bookmakerSlug: odd.bookmaker_slug,
    eventUrl: odd.bookmaker_event_url,
    marketLabel: "1X2",
    odd: odd.price,
    paCategory: getSafePaCategory(odd.pa_category),
    role,
    selectionKey: selection,
    selectionLabel: conversionSelectionLabels[selection],
  };
}

function getMode(lines: FreebetConversionLine[]): FreebetConversionMode {
  const paCount = lines.filter(
    (line) =>
      line.selectionKey !== "DRAW" && line.paCategory === "COM_PA",
  ).length;

  if (paCount === 0) return "sem_pa";
  if (paCount === 1) return "pa_um_lado";
  return "pa_dois_lados";
}

function sortOpportunities(opportunities: FreebetConversionOpportunity[]) {
  return [...opportunities].sort((left, right) => {
    const conversionOrder = right.conversionPercent - left.conversionPercent;
    if (conversionOrder !== 0) return conversionOrder;
    return right.profitAmount - left.profitAmount;
  });
}

function combineTwo<T>(left: T[], right: T[]) {
  const combinations: [T, T][] = [];

  for (const first of left) {
    for (const second of right) {
      combinations.push([first, second]);
    }
  }

  return combinations;
}

function buildOpportunity(
  lines: FreebetConversionLine[],
  input: Required<Pick<FreebetConversionInput, "freebetHouse" | "freebetValue">>,
) {
  const freebetLine = lines.find((line) => line.role === "freebet");
  const protectionLines = lines.filter((line) => line.role !== "freebet");
  const calculationLines = freebetLine ? [freebetLine, ...protectionLines] : [];

  if (lines.length !== 3 || calculationLines.length !== 3 || input.freebetValue <= 0) {
    return null;
  }

  try {
    const calculation = calculateSurebet(
      calculationLines.map((line, index) => ({
        freebet: index === 0,
        odd: line.odd,
        stake: index === 0 ? input.freebetValue : 0,
        tipo: "B",
      })),
      0,
    );
    const profitAmount = toFiniteNumber(calculation.lucro_liquido);
    const investment = toFiniteNumber(calculation.investimento_efetivo);
    const profitPercent = toFiniteNumber(calculation.lucro_percentual);
    const referenceReturn = toFiniteNumber(calculation.retorno_referencia);
    const conversionPercent = (profitAmount / input.freebetValue) * 100;
    const mode = getMode(lines);

    return {
      conversionPercent,
      freebetHouse: input.freebetHouse,
      freebetValue: input.freebetValue,
      investment,
      lines,
      mode,
      modeLabel: conversionModeLabels[mode],
      profitAmount,
      profitPercent,
      referenceReturn,
      title: "Converter Freebet",
    } satisfies FreebetConversionOpportunity;
  } catch {
    return null;
  }
}

export function buildFreebetConversionAnalysis(
  event: DuploEvent,
  input: FreebetConversionInput,
): FreebetConversionAnalysis {
  const freebetHouse = formatDuploBookmakerName(input.freebetHouse);
  const freebetValue = toFiniteNumber(input.freebetValue);
  const minOdd = Math.max(1.01, toFiniteNumber(input.minOdd) || 1.5);
  const maxOdd = Math.max(minOdd, toFiniteNumber(input.maxOdd) || 999999);
  const bookmakerKey = getFreebetConversionBookmakerKey(freebetHouse);
  const opportunities: FreebetConversionOpportunity[] = [];
  const selections: FreebetConversionSelection[] = ["HOME", "DRAW", "AWAY"];

  if (!freebetHouse || freebetValue <= 0) {
    return {
      all: [],
      best: null,
    };
  }

  for (const freebetSelection of selections) {
    const protectionSelections = selections.filter(
      (selection) => selection !== freebetSelection,
    );
    const freebetOdds = getFreebetOdds(
      event,
      freebetSelection,
      bookmakerKey,
      minOdd,
      maxOdd,
    );
    const firstProtectionOdds = get1x2Odds(event, protectionSelections[0]);
    const secondProtectionOdds = get1x2Odds(event, protectionSelections[1]);

    for (const freebetOdd of freebetOdds) {
      for (const [firstProtection, secondProtection] of combineTwo(
        firstProtectionOdds,
        secondProtectionOdds,
      )) {
        const selectedOdds = {
          [freebetSelection]: {
            odd: freebetOdd,
            role: "freebet" as const,
          },
          [protectionSelections[0]]: {
            odd: firstProtection,
            role: "protection" as const,
          },
          [protectionSelections[1]]: {
            odd: secondProtection,
            role: "protection" as const,
          },
        };
        const opportunity = buildOpportunity(
          selections.map((selection) =>
            toLine(
              selectedOdds[selection].odd,
              selection,
              selectedOdds[selection].role,
            ),
          ),
          {
            freebetHouse,
            freebetValue,
          },
        );

        if (opportunity) {
          opportunities.push(opportunity);
        }
      }
    }
  }

  const all = sortOpportunities(opportunities);

  return {
    all,
    best: all[0] ?? null,
  };
}

export function formatFreebetConversionPercent(value: number) {
  const safeValue = Math.abs(value) < 0.005 ? 0 : value;
  return `${safeValue.toFixed(2)}%`;
}
