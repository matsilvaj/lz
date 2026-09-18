// Funções compartilhadas pelas telas de sinais do monitor (Duplo, Semanal e Converter).

import type { CalculatorSelectionLine } from "@/app/_components/calculator-selection-dock";

import {
  formatCompetitionName,
  formatLeagueCountryName,
  formatNationalTeamName,
} from "./display-names";
import { formatDuploBookmakerName, type DuploEvent, type DuploMode } from "./duplo";

export type SignalDateFilter = "all" | "today" | "tomorrow";
export type SignalModeFilter = DuploMode | "all";

export type FilterOption = {
  key: string;
  name: string;
};

export const signalModeFilters: SignalModeFilter[] = [
  "all",
  "pa_dois_lados",
  "pa_um_lado",
  "sem_pa",
];

export function formatSignalDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatSignalTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

// Data local no formato "aaaa-mm-dd".
export function formatDateParam(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateFilterKey(filter: SignalDateFilter) {
  if (filter === "all") {
    return null;
  }

  const date = new Date();
  date.setHours(0, 0, 0, 0);

  if (filter === "tomorrow") {
    date.setDate(date.getDate() + 1);
  }

  return formatDateParam(date);
}

export function isEventInDateFilter(
  event: Pick<DuploEvent, "starts_at">,
  filter: SignalDateFilter,
) {
  const filterKey = getDateFilterKey(filter);

  if (!filterKey) {
    return true;
  }

  const eventDate = new Date(event.starts_at);

  if (Number.isNaN(eventDate.getTime())) {
    return false;
  }

  return formatDateParam(eventDate) === filterKey;
}

// "Hoje" ou "Amanhã" para o jogo; nos demais dias, nada.
export function getRelativeDateLabel(value: string) {
  const eventDate = new Date(value);

  if (Number.isNaN(eventDate.getTime())) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const eventKey = formatDateParam(eventDate);

  if (eventKey === formatDateParam(today)) {
    return "Hoje";
  }

  if (eventKey === formatDateParam(tomorrow)) {
    return "Amanhã";
  }

  return null;
}

export function formatLeagueLine(
  event: Pick<DuploEvent, "league_country" | "league_name">,
) {
  const leagueName = formatCompetitionName(event.league_name, event.league_country);
  const country = formatLeagueCountryName(event.league_country);

  return country ? `${leagueName} - ${country}` : leagueName;
}

export function formatFixtureTeams(event: Pick<DuploEvent, "away_team" | "home_team">) {
  const homeTeam = formatNationalTeamName(event.home_team);
  const awayTeam = formatNationalTeamName(event.away_team);

  return {
    awayTeam,
    homeTeam,
    label: `${homeTeam} x ${awayTeam}`,
  };
}

// Branco no zero, verde no lucro, vermelho no prejuízo.
export function getSignalProfitClass(value: number) {
  if (Math.abs(value) < 0.005) {
    return "text-white";
  }

  return value > 0 ? "text-emerald-400" : "text-rose-400";
}

export function getAvailableBookmakers(
  events: DuploEvent[],
  getBookmakerKey: (slug: string | null | undefined, name: string) => string,
): FilterOption[] {
  const bookmakers = new Map<string, string>();

  for (const event of events) {
    for (const odd of event.odds) {
      const key = getBookmakerKey(odd.bookmaker_slug, odd.bookmaker_name);
      const name = formatDuploBookmakerName(odd.bookmaker_name);

      if (!bookmakers.has(key)) {
        bookmakers.set(key, name);
      }
    }
  }

  return Array.from(bookmakers, ([key, name]) => ({ key, name })).sort((left, right) =>
    left.name.localeCompare(right.name, "pt-BR"),
  );
}

export function getLeagueKey(event: Pick<DuploEvent, "league_country" | "league_name">) {
  return `${event.league_name || "campeonato"}::${event.league_country || ""}`;
}

export function getAvailableLeagues(events: DuploEvent[]): FilterOption[] {
  const leagues = new Map<string, string>();

  for (const event of events) {
    const key = getLeagueKey(event);
    const name = formatLeagueLine(event);

    if (!leagues.has(key)) {
      leagues.set(key, name);
    }
  }

  return Array.from(leagues, ([key, name]) => ({ key, name })).sort((left, right) =>
    left.name.localeCompare(right.name, "pt-BR"),
  );
}

export function getEventTimeValue(event: Pick<DuploEvent, "starts_at">) {
  const timestamp = new Date(event.starts_at).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

// Quantos jogos têm ao menos uma oportunidade de cada modo (números dos filtros).
export function getModeCounts(
  analyzedEvents: Array<{ opportunities: Array<{ mode: DuploMode }> }>,
) {
  const counts: Record<SignalModeFilter, number> = {
    all: 0,
    pa_dois_lados: 0,
    pa_um_lado: 0,
    sem_pa: 0,
  };

  for (const { opportunities } of analyzedEvents) {
    if (!opportunities.length) {
      continue;
    }

    counts.all += 1;

    for (const mode of signalModeFilters) {
      if (
        mode !== "all" &&
        opportunities.some((opportunity) => opportunity.mode === mode)
      ) {
        counts[mode] += 1;
      }
    }
  }

  return counts;
}

export function areCalculatorSelectionsActive(
  selectedIds: ReadonlySet<string>,
  lines: CalculatorSelectionLine[],
) {
  return lines.length > 0 && lines.every((line) => selectedIds.has(line.id));
}
