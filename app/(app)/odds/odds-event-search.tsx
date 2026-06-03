"use client";

import {
  ArrowLeft,
  ArrowUpDown,
  Check,
  ChevronDown,
  RotateCcw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  CalculatorSelectionDock,
  createCalculatorSelectionId,
  mergeCalculatorSelections,
  type CalculatorSelectionLine,
} from "@/app/_components/calculator-selection-dock";
import {
  buildDuploAnalysis,
  formatDuploPercent,
  type DuploOpportunity,
} from "@/lib/monitor-odds/duplo";
import {
  formatCompetitionName,
  formatNationalTeamName,
} from "@/lib/monitor-odds/display-names";

type OddsFeedItem = {
  fixture_id: string;
  api_football_fixture_id: number | null;
  fixture_name: string;
  home_team: string;
  away_team: string;
  starts_at: string;
  status: string | null;
  round: string | null;
  league_name: string;
  league_slug: string;
  league_country: string | null;
  league_logo_url: string | null;
  league_country_flag_url: string | null;
  bookmaker_slug: string;
  bookmaker_name: string;
  bookmaker_event_url: string | null;
  market_code: string;
  market_name: string;
  selection: string;
  price: number;
  pa_category: string;
  confidence_score: number | null;
  odd_updated_at: string | null;
};

type OddsSnapshotItem = Pick<
  OddsFeedItem,
  | "bookmaker_slug"
  | "bookmaker_name"
  | "bookmaker_event_url"
  | "market_code"
  | "market_name"
  | "selection"
  | "price"
  | "pa_category"
  | "confidence_score"
  | "odd_updated_at"
>;

type OddsSnapshot = {
  fixture_id: string;
  latest_odd_updated_at: string | null;
  odds: OddsSnapshotItem[];
};

type OddsEvent = {
  fixture_id: string;
  api_football_fixture_id: number | null;
  fixture_name: string;
  home_team: string;
  away_team: string;
  starts_at: string;
  status: string | null;
  round: string | null;
  league_name: string;
  league_slug: string;
  league_country: string | null;
  league_logo_url: string | null;
  league_country_flag_url: string | null;
  bookmaker_count: number;
  odd_count: number;
  latest_odd_updated_at: string | null;
  odds: OddsFeedItem[];
};

type SearchState = {
  events: OddsEvent[];
  loading: boolean;
  oddsPulseVersion: number;
  refreshingOdds: boolean;
  error: string | null;
};

type EventsResponse = {
  events?: OddsEvent[];
  fixtures_version?: string | null;
  latest_odd_updated_at?: string | null;
  odds_version?: string | null;
};

type OddsResponse = {
  complete?: boolean;
  odds_version?: string | null;
  snapshots?: OddsSnapshot[];
  stale?: boolean;
};

type StatusResponse = {
  fixtures_version?: string | null;
  latest_odd_updated_at?: string | null;
  odds_version?: string | null;
};

type OddsRefreshResult = {
  events: OddsEvent[];
  oddsVersion: string | null;
};

type DatePreset = "today" | "tomorrow";
type EventListSortMode = "league" | "nearest" | "farthest";
type EventsRequest =
  | {
      kind: "search";
      search: string;
    }
  | {
      from: string;
      kind: "date";
      preset: DatePreset;
      to: string;
    };
type PaCategory = "SEM_PA" | "COM_PA";
type Selection = "HOME" | "DRAW" | "AWAY";
type SortDirection = "asc" | "desc";
type OddsSortState = {
  direction: SortDirection;
  selection: Selection;
};
type OddsTableRow = {
  bookmakerName: string;
  key: string;
  odds: Partial<Record<Selection, OddsFeedItem>>;
};
type BookmakerFilterOption = {
  key: string;
  name: string;
};
type LeagueGroup = {
  events: OddsEvent[];
  key: string;
  leagueCountry: string | null;
  leagueCountryFlagUrl: string | null;
  leagueLogoUrl: string | null;
  leagueName: string;
};

const selections: Selection[] = ["HOME", "DRAW", "AWAY"];
const datePresets: DatePreset[] = ["today", "tomorrow"];
const datePresetLabels: Record<DatePreset, string> = {
  today: "Hoje",
  tomorrow: "Amanhã",
};
const eventListSortOptions: Array<{
  label: string;
  value: EventListSortMode;
}> = [
  { label: "Por campeonato", value: "league" },
  { label: "Mais próximos", value: "nearest" },
  { label: "Mais distantes", value: "farthest" },
];
const leagueLogoOutlinePositions = [
  "top",
  "top-right",
  "right",
  "bottom-right",
  "bottom",
  "bottom-left",
  "left",
  "top-left",
] as const;
const oddsTableGridClass =
  "grid grid-cols-[minmax(84px,1fr)_repeat(3,minmax(54px,78px))] items-center gap-1.5 sm:grid-cols-[minmax(120px,1fr)_repeat(3,minmax(62px,90px))] sm:gap-2";
const oddsBoxClass =
  "flex h-9 w-full min-w-0 items-center justify-center rounded-xl px-2 text-center";
const statusChannelName = "lz-monitor-odds-status";
const statusLeaderKey = "lz-monitor-odds-status-leader";
const statusLeaderTtlMs = 12_000;
const statusPollIntervalMs = 4_000;
const unversionedFixturesRefreshMs = 60_000;
const oddsSnapshotMemoryLimit = 300;
const emptyOddsEvents: OddsEvent[] = [];
const leagueCountryNames: Record<string, string> = {
  albania: "Albânia",
  algeria: "Argélia",
  andorra: "Andorra",
  angola: "Angola",
  argentina: "Argentina",
  armenia: "Armênia",
  aruba: "Aruba",
  australia: "Austrália",
  austria: "Áustria",
  azerbaijan: "Azerbaijão",
  bahrain: "Bahrein",
  belarus: "Belarus",
  belgium: "Bélgica",
  bolivia: "Bolívia",
  "bosnia-herzegovina": "Bósnia e Herzegovina",
  bosnia: "Bósnia e Herzegovina",
  brazil: "Brasil",
  bulgaria: "Bulgária",
  canada: "Canadá",
  chile: "Chile",
  china: "China",
  colombia: "Colômbia",
  "costa-rica": "Costa Rica",
  croatia: "Croácia",
  cyprus: "Chipre",
  "czech-republic": "República Tcheca",
  czechia: "República Tcheca",
  denmark: "Dinamarca",
  ecuador: "Equador",
  egypt: "Egito",
  england: "Inglaterra",
  estonia: "Estônia",
  "faroe-islands": "Ilhas Faroé",
  finland: "Finlândia",
  france: "França",
  georgia: "Geórgia",
  germany: "Alemanha",
  gibraltar: "Gibraltar",
  greece: "Grécia",
  hungary: "Hungria",
  iceland: "Islândia",
  india: "Índia",
  indonesia: "Indonésia",
  iran: "Irã",
  ireland: "Irlanda",
  israel: "Israel",
  italy: "Itália",
  japan: "Japão",
  kazakhstan: "Cazaquistão",
  kosovo: "Kosovo",
  latvia: "Letônia",
  lithuania: "Lituânia",
  luxembourg: "Luxemburgo",
  malaysia: "Malásia",
  malta: "Malta",
  mexico: "México",
  moldova: "Moldávia",
  montenegro: "Montenegro",
  morocco: "Marrocos",
  netherlands: "Holanda",
  "new-zealand": "Nova Zelândia",
  nigeria: "Nigéria",
  "north-macedonia": "Macedônia do Norte",
  "northern-ireland": "Irlanda do Norte",
  norway: "Noruega",
  paraguay: "Paraguai",
  peru: "Peru",
  poland: "Polônia",
  portugal: "Portugal",
  qatar: "Catar",
  romania: "Romênia",
  russia: "Rússia",
  "san-marino": "San Marino",
  "saudi-arabia": "Arábia Saudita",
  scotland: "Escócia",
  serbia: "Sérvia",
  singapore: "Singapura",
  slovakia: "Eslováquia",
  slovenia: "Eslovênia",
  "south-africa": "África do Sul",
  "south-korea": "Coreia do Sul",
  spain: "Espanha",
  sweden: "Suécia",
  switzerland: "Suíça",
  thailand: "Tailândia",
  tunisia: "Tunísia",
  turkey: "Turquia",
  ukraine: "Ucrânia",
  uruguay: "Uruguai",
  usa: "Estados Unidos",
  "united-states": "Estados Unidos",
  venezuela: "Venezuela",
  vietnam: "Vietnã",
  wales: "País de Gales",
  world: "Mundo",
};

const leagueCountryIsoCodes: Record<string, string> = {
  albania: "AL",
  algeria: "DZ",
  andorra: "AD",
  angola: "AO",
  argentina: "AR",
  armenia: "AM",
  aruba: "AW",
  australia: "AU",
  austria: "AT",
  azerbaijan: "AZ",
  bahrain: "BH",
  belarus: "BY",
  belgium: "BE",
  bolivia: "BO",
  "bosnia-herzegovina": "BA",
  bosnia: "BA",
  brazil: "BR",
  bulgaria: "BG",
  canada: "CA",
  chile: "CL",
  china: "CN",
  colombia: "CO",
  "costa-rica": "CR",
  croatia: "HR",
  cyprus: "CY",
  "czech-republic": "CZ",
  czechia: "CZ",
  denmark: "DK",
  ecuador: "EC",
  egypt: "EG",
  england: "GB",
  estonia: "EE",
  "faroe-islands": "FO",
  finland: "FI",
  france: "FR",
  georgia: "GE",
  germany: "DE",
  gibraltar: "GI",
  greece: "GR",
  hungary: "HU",
  iceland: "IS",
  india: "IN",
  indonesia: "ID",
  iran: "IR",
  ireland: "IE",
  israel: "IL",
  italy: "IT",
  japan: "JP",
  kazakhstan: "KZ",
  kosovo: "XK",
  latvia: "LV",
  lithuania: "LT",
  luxembourg: "LU",
  malaysia: "MY",
  malta: "MT",
  mexico: "MX",
  moldova: "MD",
  montenegro: "ME",
  morocco: "MA",
  netherlands: "NL",
  "new-zealand": "NZ",
  nigeria: "NG",
  "north-macedonia": "MK",
  "northern-ireland": "GB",
  norway: "NO",
  paraguay: "PY",
  peru: "PE",
  poland: "PL",
  portugal: "PT",
  qatar: "QA",
  romania: "RO",
  russia: "RU",
  "san-marino": "SM",
  "saudi-arabia": "SA",
  scotland: "GB",
  serbia: "RS",
  singapore: "SG",
  slovakia: "SK",
  slovenia: "SI",
  "south-africa": "ZA",
  "south-korea": "KR",
  spain: "ES",
  sweden: "SE",
  switzerland: "CH",
  thailand: "TH",
  tunisia: "TN",
  turkey: "TR",
  ukraine: "UA",
  uruguay: "UY",
  usa: "US",
  "united-states": "US",
  venezuela: "VE",
  vietnam: "VN",
  wales: "GB",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeStyle: "short",
});

const lastOddsUpdateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeStyle: "short",
});

function formatDate(value: string | null) {
  if (!value) return "Sem data";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";

  return dateFormatter.format(date);
}

function formatTime(value: string | null) {
  if (!value) return "Sem horário";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem horário";

  return timeFormatter.format(date);
}

function formatLastOddsUpdate(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return lastOddsUpdateFormatter.format(date);
}

function normalizeLabelKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatBookmakerName(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      const rest = word.slice(1);
      const hasInternalCase = /[a-z][A-Z]/.test(word) || /[0-9][A-Z]/.test(word);
      const normalizedRest = hasInternalCase ? rest : rest.toLocaleLowerCase("pt-BR");

      return `${word.charAt(0).toLocaleUpperCase("pt-BR")}${normalizedRest}`;
    })
    .join(" ");
}

function formatLeagueCountry(value: string | null) {
  if (!value) return "";
  return leagueCountryNames[normalizeLabelKey(value)] ?? value;
}

function formatLeagueName(value: string, country?: string | null) {
  const normalizedCountry = normalizeLabelKey(country ?? "");
  let formatted = formatCompetitionName(value, country).replace(
    /\bbrasileirao\b/gi,
    "Brasileirão",
  );
  const isBrazilianLeague =
    normalizedCountry === "brazil" || normalizeLabelKey(formatted).includes("brasileirao");

  if (isBrazilianLeague) {
    formatted = formatted.replace(/\bserie\b/gi, "Série");
  }

  return formatted;
}

function formatCountryFlag(value: string | null) {
  if (!value) return "";

  const countryCode = leagueCountryIsoCodes[normalizeLabelKey(value)] ?? "";

  if (countryCode.length !== 2) {
    return "";
  }

  return countryCode
    .toUpperCase()
    .split("")
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join("");
}

function getSafeImageUrl(value: string | null) {
  if (!value) return "";

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function formatLeagueLine(event: OddsEvent) {
  const country = formatLeagueCountry(event.league_country);
  const leagueName = formatLeagueName(event.league_name, event.league_country);
  return country ? `${leagueName} - ${country}` : leagueName;
}

function formatFixtureTeams(event: Pick<OddsEvent, "away_team" | "home_team">) {
  const homeTeam = formatNationalTeamName(event.home_team);
  const awayTeam = formatNationalTeamName(event.away_team);

  return {
    awayTeam,
    homeTeam,
    label: `${homeTeam} x ${awayTeam}`,
  };
}

function getEventHref(event: OddsEvent, basePath: string) {
  return `${basePath}/${encodeURIComponent(event.fixture_id)}`;
}

function getDatePresetRange(preset: DatePreset) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  if (preset === "tomorrow") {
    start.setDate(start.getDate() + 1);
  }

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return {
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

function getEventsRequestParams(request: EventsRequest) {
  const params = new URLSearchParams();

  if (request.kind === "search") {
    params.set("q", request.search);
    return params;
  }

  params.set("from", request.from);
  params.set("to", request.to);
  return params;
}

function isSameEventsRequest(
  left: EventsRequest | null,
  right: EventsRequest | null,
) {
  if (!left || !right || left.kind !== right.kind) {
    return false;
  }

  if (left.kind === "search" && right.kind === "search") {
    return left.search === right.search;
  }

  if (left.kind === "date" && right.kind === "date") {
    return left.preset === right.preset && left.from === right.from && left.to === right.to;
  }

  return false;
}

function getStatusLeader() {
  try {
    const raw = window.localStorage.getItem(statusLeaderKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { expiresAt?: unknown; id?: unknown };

    if (typeof parsed.id !== "string" || typeof parsed.expiresAt !== "number") {
      return null;
    }

    return {
      expiresAt: parsed.expiresAt,
      id: parsed.id,
    };
  } catch {
    return null;
  }
}

function canLeadStatusPolling(tabId: string) {
  if (document.visibilityState === "hidden") {
    return false;
  }

  const now = Date.now();
  const leader = getStatusLeader();

  if (leader && leader.id !== tabId && leader.expiresAt > now) {
    return false;
  }

  try {
    window.localStorage.setItem(
      statusLeaderKey,
      JSON.stringify({ expiresAt: now + statusLeaderTtlMs, id: tabId }),
    );
  } catch {
    return true;
  }

  return true;
}

function releaseStatusLeader(tabId: string) {
  const leader = getStatusLeader();

  if (leader?.id !== tabId) {
    return;
  }

  try {
    window.localStorage.removeItem(statusLeaderKey);
  } catch {
    // Best-effort cleanup only.
  }
}

function createStatusTabId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const oddsSnapshotsByFixtureId = new Map<string, OddsSnapshot>();

function getSnapshotFromEvent(event: OddsEvent): OddsSnapshot | null {
  if (!event.odds.length) {
    return null;
  }

  return {
    fixture_id: event.fixture_id,
    latest_odd_updated_at: event.latest_odd_updated_at,
    odds: event.odds.map((odd) => ({
      bookmaker_event_url: odd.bookmaker_event_url,
      bookmaker_name: odd.bookmaker_name,
      bookmaker_slug: odd.bookmaker_slug,
      confidence_score: odd.confidence_score,
      market_code: odd.market_code,
      market_name: odd.market_name,
      odd_updated_at: odd.odd_updated_at,
      pa_category: odd.pa_category,
      price: odd.price,
      selection: odd.selection,
    })),
  };
}

function rememberOddsSnapshots(snapshots: OddsSnapshot[]) {
  for (const snapshot of snapshots) {
    if (!snapshot.fixture_id || !snapshot.odds.length) {
      continue;
    }

    oddsSnapshotsByFixtureId.delete(snapshot.fixture_id);
    oddsSnapshotsByFixtureId.set(snapshot.fixture_id, snapshot);
  }

  while (oddsSnapshotsByFixtureId.size > oddsSnapshotMemoryLimit) {
    const oldestFixtureId = oddsSnapshotsByFixtureId.keys().next().value;

    if (!oldestFixtureId) {
      return;
    }

    oddsSnapshotsByFixtureId.delete(oldestFixtureId);
  }
}

function rememberEventOdds(events: OddsEvent[]) {
  const snapshots = events
    .map(getSnapshotFromEvent)
    .filter((snapshot): snapshot is OddsSnapshot => Boolean(snapshot));

  rememberOddsSnapshots(snapshots);
}

function hydrateEventsWithRememberedOdds(events: OddsEvent[]) {
  const snapshots = events
    .map((event) => oddsSnapshotsByFixtureId.get(event.fixture_id))
    .filter((snapshot): snapshot is OddsSnapshot => Boolean(snapshot));

  if (!snapshots.length) {
    return events;
  }

  return mergeOddsSnapshots(events, snapshots, {
    preserveExistingOddsOnEmptySnapshot: true,
  });
}

function mergeOddsSnapshots(
  events: OddsEvent[],
  snapshots: OddsSnapshot[],
  options: { preserveExistingOddsOnEmptySnapshot?: boolean } = {},
) {
  const snapshotsByFixtureId = new Map(
    snapshots.map((snapshot) => [snapshot.fixture_id, snapshot]),
  );

  return events.map((event) => {
    const snapshot = snapshotsByFixtureId.get(event.fixture_id);

    if (
      options.preserveExistingOddsOnEmptySnapshot &&
      event.odds.length &&
      (!snapshot || !snapshot.odds.length)
    ) {
      return event;
    }

    const odds = (snapshot?.odds ?? [])
      .map((odd) => ({
        fixture_id: event.fixture_id,
        api_football_fixture_id: event.api_football_fixture_id,
        fixture_name: event.fixture_name,
        home_team: event.home_team,
        away_team: event.away_team,
        starts_at: event.starts_at,
        status: event.status,
        round: event.round,
        league_name: event.league_name,
        league_slug: event.league_slug,
        league_country: event.league_country,
        league_logo_url: event.league_logo_url,
        league_country_flag_url: event.league_country_flag_url,
        ...odd,
      }))
      .sort((left, right) => {
        const marketOrder = left.market_code.localeCompare(right.market_code);
        if (marketOrder !== 0) return marketOrder;

        const categoryOrder = left.pa_category.localeCompare(right.pa_category);
        if (categoryOrder !== 0) return categoryOrder;

        const bookmakerOrder = left.bookmaker_name.localeCompare(right.bookmaker_name);
        if (bookmakerOrder !== 0) return bookmakerOrder;

        return left.selection.localeCompare(right.selection);
      });

    return {
      ...event,
      bookmaker_count: new Set(odds.map((odd) => odd.bookmaker_slug)).size,
      latest_odd_updated_at: snapshot?.latest_odd_updated_at ?? null,
      odd_count: odds.length,
      odds,
    };
  });
}

async function fetchOddsForEvents(
  events: OddsEvent[],
  oddsVersion: string | null,
  options: { signal?: AbortSignal } = {},
): Promise<OddsRefreshResult> {
  if (!events.length) {
    return {
      events,
      oddsVersion,
    };
  }

  const response = await fetch("/api/monitor-odds/odds", {
    body: JSON.stringify({
      fixtureIds: events.map((event) => event.fixture_id),
      oddsVersion,
    }),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    signal: options.signal,
  });

  if (response.status === 429) {
    throw new Error("Muitas atualizacoes em pouco tempo. Aguarde alguns segundos.");
  }

  if (!response.ok) {
    throw new Error("Nao foi possivel atualizar as odds.");
  }

  const payload = (await response.json()) as OddsResponse;
  const isComplete = payload.complete !== false && payload.stale !== true;

  if (!isComplete) {
    return {
      events,
      oddsVersion: null,
    };
  }

  const snapshots = payload.snapshots ?? [];
  rememberOddsSnapshots(snapshots);

  return {
    events: mergeOddsSnapshots(events, snapshots, {
      preserveExistingOddsOnEmptySnapshot: true,
    }),
    oddsVersion: payload.odds_version ?? oddsVersion,
  };
}

function useMonitorOddsStatusFeed(
  canPollStatus: () => boolean,
  onStatusUpdate: (payload: StatusResponse) => Promise<void> | void,
) {
  const statusChannelRef = useRef<BroadcastChannel | null>(null);
  const tabIdRef = useRef<string>("");

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") {
      return;
    }

    const channel = new BroadcastChannel(statusChannelName);
    statusChannelRef.current = channel;

    function handleMessage(event: MessageEvent) {
      const data = event.data as {
        status?: StatusResponse;
        type?: string;
      };

      if (data?.type === "monitor-odds-status" && data.status) {
        void onStatusUpdate(data.status);
      }
    }

    channel.addEventListener("message", handleMessage);

    return () => {
      channel.removeEventListener("message", handleMessage);
      channel.close();
      statusChannelRef.current = null;
    };
  }, [onStatusUpdate]);

  useEffect(() => {
    let active = true;
    tabIdRef.current = tabIdRef.current || createStatusTabId();

    async function checkFeedStatus() {
      if (
        !active ||
        !canPollStatus() ||
        !canLeadStatusPolling(tabIdRef.current)
      ) {
        return;
      }

      try {
        const response = await fetch("/api/monitor-odds/status", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as StatusResponse;

        if (!active) {
          return;
        }

        statusChannelRef.current?.postMessage({
          status: payload,
          type: "monitor-odds-status",
        });
        await onStatusUpdate(payload);
      } catch {
        // Status polling is only a freshness hint; the search remains usable.
      }
    }

    const timeoutId = window.setTimeout(checkFeedStatus, 750);
    const intervalId = window.setInterval(checkFeedStatus, statusPollIntervalMs);

    return () => {
      active = false;
      releaseStatusLeader(tabIdRef.current);
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [canPollStatus, onStatusUpdate]);
}

function groupEventsByLeague(events: OddsEvent[]) {
  const groups = new Map<string, LeagueGroup>();

  for (const event of events) {
    const key = `${event.league_slug}:${normalizeLabelKey(event.league_country ?? "")}`;
    const current =
      groups.get(key) ??
      ({
        events: [],
        key,
        leagueCountry: event.league_country,
        leagueCountryFlagUrl: event.league_country_flag_url,
        leagueLogoUrl: event.league_logo_url,
        leagueName: event.league_name,
      } satisfies LeagueGroup);

    current.events.push(event);
    current.leagueCountryFlagUrl =
      current.leagueCountryFlagUrl ?? event.league_country_flag_url;
    current.leagueLogoUrl = current.leagueLogoUrl ?? event.league_logo_url;
    groups.set(key, current);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      events: [...group.events].sort((left, right) => {
        const startOrder =
          new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime();

        if (startOrder !== 0) return startOrder;
        return left.fixture_name.localeCompare(right.fixture_name, "pt-BR");
      }),
    }))
    .sort((left, right) => {
      const countryOrder = formatLeagueCountry(left.leagueCountry).localeCompare(
        formatLeagueCountry(right.leagueCountry),
        "pt-BR",
      );

      if (countryOrder !== 0) return countryOrder;
      return left.leagueName.localeCompare(right.leagueName, "pt-BR");
    });
}

function getEventStartTime(event: OddsEvent) {
  const time = new Date(event.starts_at).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function sortEventsForList(events: OddsEvent[], mode: EventListSortMode) {
  if (mode === "league") {
    return events;
  }

  return [...events].sort((left, right) => {
    const startOrder = getEventStartTime(left) - getEventStartTime(right);
    const fixtureOrder = formatFixtureTeams(left).label.localeCompare(
      formatFixtureTeams(right).label,
      "pt-BR",
    );

    if (mode === "nearest") {
      return startOrder || fixtureOrder;
    }

    return -startOrder || fixtureOrder;
  });
}

function selectionLabel(value: string) {
  if (value === "HOME") return "1";
  if (value === "DRAW") return "X";
  if (value === "AWAY") return "2";
  return value;
}

function formatOdd(value: number | undefined) {
  return value ? value.toFixed(2) : "-";
}

function BookmakerEventLink({
  bookmakerName,
  children,
  className,
  eventUrl,
}: {
  bookmakerName: string;
  children: ReactNode;
  className: string;
  eventUrl: string | null | undefined;
}) {
  if (eventUrl) {
    return (
      <a
        aria-label={`Abrir evento na ${bookmakerName}`}
        className={`${className} pointer-events-auto`}
        href={eventUrl}
        onClick={(event) => event.stopPropagation()}
        rel="noopener noreferrer"
        target="_blank"
      >
        {children}
      </a>
    );
  }

  return <span className={className}>{children}</span>;
}

function get1x2Rows(event: OddsEvent, category: PaCategory) {
  const rows = new Map<string, OddsTableRow>();

  for (const odd of event.odds) {
    if (odd.market_code !== "1X2") continue;
    if (odd.pa_category !== category) continue;
    if (!selections.includes(odd.selection as Selection)) continue;

    const selection = odd.selection as Selection;
    const key = `${odd.bookmaker_slug}-${category}`;
    const existing = rows.get(key) ?? {
      bookmakerName: formatBookmakerName(odd.bookmaker_name),
      key,
      odds: {},
    };
    const current = existing.odds[selection];

    if (!current || odd.price > current.price) {
      existing.odds[selection] = odd;
    }

    rows.set(key, existing);
  }

  return Array.from(rows.values()).sort((left, right) =>
    left.bookmakerName.localeCompare(right.bookmakerName, "pt-BR"),
  );
}

function sortRows(rows: OddsTableRow[], sort: OddsSortState | null) {
  if (!sort) {
    return rows;
  }

  return [...rows].sort((left, right) => {
    const leftPrice = left.odds[sort.selection]?.price;
    const rightPrice = right.odds[sort.selection]?.price;

    if (leftPrice === undefined && rightPrice === undefined) {
      return left.bookmakerName.localeCompare(right.bookmakerName, "pt-BR");
    }

    if (leftPrice === undefined) return 1;
    if (rightPrice === undefined) return -1;

    return sort.direction === "desc"
      ? rightPrice - leftPrice
      : leftPrice - rightPrice;
  });
}

function getNextSort(
  current: OddsSortState | null,
  selection: Selection,
): OddsSortState {
  if (!current || current.selection !== selection) {
    return { direction: "desc", selection };
  }

  return {
    direction: current.direction === "desc" ? "asc" : "desc",
    selection,
  };
}

function getHighestPrices(rows: OddsTableRow[]) {
  return selections.reduce<Partial<Record<Selection, number>>>((accumulator, selection) => {
    const prices = rows
      .map((row) => row.odds[selection]?.price)
      .filter((price): price is number => price !== undefined);

    if (prices.length) {
      accumulator[selection] = Math.max(...prices);
    }

    return accumulator;
  }, {});
}

function getRowEventUrl(row: OddsTableRow) {
  return selections
    .map((selection) => row.odds[selection]?.bookmaker_event_url)
    .find((eventUrl): eventUrl is string => Boolean(eventUrl)) ?? null;
}

function getCalculatorMeta(marketLabel: string) {
  return marketLabel.trim().toUpperCase() === "1X2"
    ? undefined
    : marketLabel;
}

function getOddCalculatorSelection(
  fixtureId: string,
  odd: OddsFeedItem,
): CalculatorSelectionLine {
  const house = formatBookmakerName(odd.bookmaker_name);
  const lineSelectionLabel = selectionLabel(odd.selection);
  const marketLabel = odd.market_code || odd.market_name || "Odd";

  return {
    house,
    id: createCalculatorSelectionId([
      fixtureId,
      odd.bookmaker_slug || odd.bookmaker_name,
      marketLabel,
      lineSelectionLabel,
      odd.pa_category,
    ]),
    meta: getCalculatorMeta(marketLabel),
    odd: odd.price,
    pa: odd.pa_category === "COM_PA",
    selectionKey: lineSelectionLabel,
    selectionLabel: lineSelectionLabel,
  };
}

function getOpportunityCalculatorSelections(
  fixtureId: string,
  opportunity: DuploOpportunity,
): CalculatorSelectionLine[] {
  return opportunity.lines.map((line) => ({
    house: line.bookmakerName,
    id: createCalculatorSelectionId([
      fixtureId,
      line.bookmakerSlug || line.bookmakerName,
      line.marketLabel,
      line.selectionLabel,
      line.paCategory,
    ]),
    meta: getCalculatorMeta(line.marketLabel),
    odd: line.odd,
    pa: line.paCategory === "COM_PA",
    selectionKey: line.selectionLabel,
    selectionLabel: line.selectionLabel,
  }));
}

function areCalculatorSelectionsActive(
  selectedIds: ReadonlySet<string>,
  lines: CalculatorSelectionLine[],
) {
  return lines.length > 0 && lines.every((line) => selectedIds.has(line.id));
}

function getBookmakerKey(slug: string | null | undefined, name: string) {
  return (slug?.trim() || name.trim() || "casa").toLocaleLowerCase("pt-BR");
}

function getAvailableBookmakers(event: OddsEvent): BookmakerFilterOption[] {
  const bookmakers = new Map<string, string>();

  for (const odd of event.odds) {
    const key = getBookmakerKey(odd.bookmaker_slug, odd.bookmaker_name);
    const name = formatBookmakerName(odd.bookmaker_name);

    if (!bookmakers.has(key)) {
      bookmakers.set(key, name);
    }
  }

  return Array.from(bookmakers, ([key, name]) => ({ key, name })).sort((left, right) =>
    left.name.localeCompare(right.name, "pt-BR"),
  );
}

function filterEventBookmakers(
  event: OddsEvent,
  hiddenBookmakers: ReadonlySet<string>,
) {
  if (!hiddenBookmakers.size) {
    return event;
  }

  const odds = event.odds.filter((odd) => {
    return !hiddenBookmakers.has(
      getBookmakerKey(odd.bookmaker_slug, odd.bookmaker_name),
    );
  });

  return {
    ...event,
    bookmaker_count: new Set(
      odds.map((odd) => getBookmakerKey(odd.bookmaker_slug, odd.bookmaker_name)),
    ).size,
    odd_count: odds.length,
    odds,
  };
}

function OddPricePulse({
  children,
  className,
  price,
  pulseId,
  pulseVersion,
}: {
  children: ReactNode;
  className: string;
  price: number | undefined;
  pulseId: string;
  pulseVersion: number;
}) {
  const elementRef = useRef<HTMLSpanElement | null>(null);
  const previousPriceRef = useRef(price);
  const previousPulseIdRef = useRef(pulseId);
  const previousPulseVersionRef = useRef(pulseVersion);

  useEffect(() => {
    const element = elementRef.current;

    if (previousPulseIdRef.current !== pulseId) {
      previousPulseIdRef.current = pulseId;
      previousPriceRef.current = price;
      previousPulseVersionRef.current = pulseVersion;
      element?.classList.remove("odds-price-move-up", "odds-price-move-down");
      return;
    }

    const previousPrice = previousPriceRef.current;
    const previousPulseVersion = previousPulseVersionRef.current;
    previousPriceRef.current = price;
    previousPulseVersionRef.current = pulseVersion;

    if (
      pulseVersion === previousPulseVersion ||
      price === undefined ||
      previousPrice === undefined ||
      price === previousPrice
    ) {
      return;
    }

    if (!element) {
      return;
    }

    const movementClass =
      price > previousPrice ? "odds-price-move-up" : "odds-price-move-down";

    element.classList.remove("odds-price-move-up", "odds-price-move-down");
    void element.offsetWidth;
    element.classList.add(movementClass);

    const timeoutId = window.setTimeout(() => {
      element.classList.remove(movementClass);
    }, 1400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [price, pulseId, pulseVersion]);

  return (
    <span className={className} ref={elementRef}>
      {children}
    </span>
  );
}

function EventCard({
  event,
  eventBasePath,
  showLeague = true,
}: {
  event: OddsEvent;
  eventBasePath: string;
  showLeague?: boolean;
}) {
  const teams = formatFixtureTeams(event);

  return (
    <article
      className="group relative flex min-h-[124px] w-full flex-col rounded-[22px] border border-white/10 bg-white/[0.025] p-4 text-left transition hover:border-[rgba(255,139,187,0.28)] hover:bg-white/[0.04] hover:shadow-[0_14px_34px_rgba(0,0,0,0.2)]"
    >
      <Link
        aria-label={`Abrir odds de ${teams.label}`}
        className="absolute inset-0 z-0 rounded-[22px] border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        href={getEventHref(event, eventBasePath)}
      />

      <div className="pointer-events-none relative z-10 flex h-full flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
          <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1">
            {formatDate(event.starts_at)}
          </span>
          <span className="inline-flex rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-[var(--text-muted)]">
            {formatTime(event.starts_at)}
          </span>
        </div>

        <div className="min-w-0">
          <h2 className="line-clamp-2 text-base font-semibold tracking-tight text-white md:text-lg">
            {teams.label}
          </h2>

          {showLeague ? (
            <p className="mt-2 truncate text-xs font-medium text-[var(--text-muted)]">
              {formatLeagueLine(event)}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function DatePresetButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`inline-flex h-13 items-center justify-center rounded-full border px-5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
        active
          ? "border-[rgba(255,139,187,0.42)] bg-[rgba(255,139,187,0.16)] text-white shadow-[0_0_22px_rgba(255,139,187,0.08)]"
          : "border-white/10 bg-white/[0.035] text-[var(--text-secondary)] hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function EventListSortMenu({
  onChange,
  value,
}: {
  onChange: (value: EventListSortMode) => void;
  value: EventListSortMode;
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedLabel =
    eventListSortOptions.find((option) => option.value === value)?.label ??
    eventListSortOptions[0]?.label ??
    "Organizar";

  const updateMenuPosition = useCallback(() => {
    const button = buttonRef.current;

    if (!button) return;

    const rect = button.getBoundingClientRect();
    const gap = 8;
    const menuHeight = 132;
    const viewportPadding = 16;
    const width = Math.max(rect.width, 220);
    const left = Math.min(
      Math.max(viewportPadding, rect.right - width),
      window.innerWidth - width - viewportPadding,
    );
    const hasRoomBelow = rect.bottom + gap + menuHeight <= window.innerHeight;
    const top = hasRoomBelow
      ? rect.bottom + gap
      : Math.max(viewportPadding, rect.top - menuHeight - gap);

    setMenuPosition({ left, top, width });
  }, []);

  useEffect(() => {
    if (!open) return;

    updateMenuPosition();

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) return;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;

      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, updateMenuPosition]);

  const menu =
    open && menuPosition
      ? createPortal(
          <div
            className="fixed z-[80] overflow-hidden rounded-2xl border border-white/10 bg-[rgba(18,5,13,0.98)] p-1 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
            ref={menuRef}
            role="listbox"
            style={{
              left: menuPosition.left,
              top: menuPosition.top,
              width: menuPosition.width,
            }}
          >
            {eventListSortOptions.map((option) => (
              <button
                aria-selected={value === option.value}
                className={`flex h-10 w-full items-center rounded-xl px-3 text-left text-sm font-semibold transition ${
                  value === option.value
                    ? "bg-[rgba(211,27,91,0.22)] text-white"
                    : "text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-white"
                }`}
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                role="option"
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative w-full">
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`inline-flex h-13 w-full items-center justify-between gap-3 rounded-full border px-4 text-sm font-semibold transition ${
          open
            ? "border-[rgba(255,139,187,0.52)] bg-[rgba(255,139,187,0.12)] text-white shadow-[0_12px_30px_rgba(211,27,91,0.12)]"
            : "border-white/10 bg-white/[0.035] text-white hover:border-white/20 hover:bg-white/[0.06]"
        }`}
        onClick={() => setOpen((current) => !current)}
        ref={buttonRef}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2">
          <ArrowUpDown
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-[var(--text-secondary)]"
          />
          <span className="truncate">{selectedLabel}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-[var(--text-secondary)] transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {menu}
    </div>
  );
}

function GlobalLeagueIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3.5 12h17M12 3.5c2.2 2.3 3.3 5.1 3.3 8.5s-1.1 6.2-3.3 8.5M12 3.5C9.8 5.8 8.7 8.6 8.7 12s1.1 6.2 3.3 8.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <circle
        cx="12"
        cy="12"
        r="8.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function LeagueIcon({
  country,
  flagUrl,
  leagueName,
  logoUrl,
}: {
  country: string;
  flagUrl: string | null;
  leagueName: string;
  logoUrl: string | null;
}) {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());
  const safeLogoUrl = getSafeImageUrl(logoUrl);
  const safeFlagUrl = getSafeImageUrl(flagUrl);
  const countryFlag = formatCountryFlag(country);
  const imageUrl = safeLogoUrl && !failedUrls.has(safeLogoUrl)
    ? safeLogoUrl
    : safeFlagUrl && !failedUrls.has(safeFlagUrl)
      ? safeFlagUrl
      : "";
  const isLogoImage = Boolean(imageUrl && imageUrl === safeLogoUrl);
  const imageAlt = imageUrl === safeLogoUrl ? `Logo ${leagueName}` : `Bandeira ${country}`;

  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-base text-[var(--text-secondary)]">
      {imageUrl && isLogoImage ? (
        <span className="lz-league-logo-outline relative inline-flex h-7 w-7 items-center justify-center">
          {leagueLogoOutlinePositions.map((position) => (
            <Image
              alt=""
              aria-hidden="true"
              className="lz-league-logo-outline-copy pointer-events-none absolute inset-0 h-full w-full object-contain"
              data-outline-position={position}
              height={28}
              key={position}
              loading="lazy"
              onError={() => {
                setFailedUrls((current) => new Set(current).add(imageUrl));
              }}
              referrerPolicy="no-referrer"
              src={imageUrl}
              unoptimized
              width={28}
            />
          ))}
          <Image
            alt={imageAlt}
            className="relative z-10 h-full w-full object-contain"
            height={28}
            loading="lazy"
            onError={() => {
              setFailedUrls((current) => new Set(current).add(imageUrl));
            }}
            referrerPolicy="no-referrer"
            src={imageUrl}
            unoptimized
            width={28}
          />
        </span>
      ) : imageUrl ? (
        <Image
          alt={imageAlt}
          className="h-6 w-6 object-contain"
          height={24}
          loading="lazy"
          onError={() => {
            setFailedUrls((current) => new Set(current).add(imageUrl));
          }}
          referrerPolicy="no-referrer"
          src={imageUrl}
          unoptimized
          width={24}
        />
      ) : countryFlag ? (
        <span aria-label={`Bandeira ${country}`} role="img">
          {countryFlag}
        </span>
      ) : (
        <GlobalLeagueIcon />
      )}
    </span>
  );
}

function LeagueEventsSection({
  group,
  eventBasePath,
}: {
  group: LeagueGroup;
  eventBasePath: string;
}) {
  const country = formatLeagueCountry(group.leagueCountry);
  const leagueName = formatLeagueName(group.leagueName, group.leagueCountry);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <LeagueIcon
            country={country || group.leagueCountry || "Internacional"}
            flagUrl={group.leagueCountryFlagUrl}
            leagueName={leagueName}
            logoUrl={group.leagueLogoUrl}
          />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-white">
              {leagueName}
            </h2>
            {country ? (
              <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                {country}
              </p>
            ) : null}
          </div>
        </div>

        <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
          {group.events.length} {group.events.length === 1 ? "jogo" : "jogos"}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {group.events.map((event) => (
          <EventCard
            event={event}
            eventBasePath={eventBasePath}
            key={event.fixture_id}
            showLeague={false}
          />
        ))}
      </div>
    </section>
  );
}

function EventCardSkeleton() {
  return (
    <div className="min-h-[124px] w-full rounded-[22px] border border-white/10 bg-white/[0.025] p-4">
      <div className="flex h-full animate-pulse flex-col gap-3">
        <div className="flex gap-2">
          <span className="h-6 w-20 rounded-full bg-white/8" />
          <span className="h-6 w-14 rounded-full bg-white/8" />
        </div>

        <div>
          <span className="block h-5 w-4/5 rounded-full bg-white/10" />
          <span className="mt-2 block h-4 w-3/5 rounded-full bg-white/8" />
        </div>
      </div>
    </div>
  );
}

function SearchResultsSkeleton() {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <EventCardSkeleton key={`search-skeleton-${index}`} />
      ))}
    </section>
  );
}

function LeagueEventsSkeleton() {
  return (
    <section className="space-y-6">
      {Array.from({ length: 3 }).map((_, groupIndex) => (
        <div className="space-y-3" key={`league-skeleton-${groupIndex}`}>
          <div className="flex animate-pulse items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-3">
              <span className="h-10 w-12 rounded-2xl bg-white/8" />
              <div>
                <span className="block h-4 w-40 rounded-full bg-white/10" />
                <span className="mt-2 block h-3 w-24 rounded-full bg-white/8" />
              </div>
            </div>
            <span className="h-6 w-16 rounded-full bg-white/8" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <EventCardSkeleton />
            <EventCardSkeleton />
            <EventCardSkeleton />
          </div>
        </div>
      ))}
    </section>
  );
}

function SortHeaderButton({
  label,
  onClick,
  selection,
  sort,
}: {
  label: string;
  onClick: (selection: Selection) => void;
  selection: Selection;
  sort: OddsSortState | null;
}) {
  const active = sort?.selection === selection;
  const directionLabel = active ? (sort.direction === "desc" ? "↓" : "↑") : "";

  return (
    <button
      className={`${oddsBoxClass} odds-sort-button ${
        active ? "odds-sort-button--active" : ""
      } text-[11px] font-semibold transition`}
      onClick={() => onClick(selection)}
      type="button"
    >
      <span>{label}</span>
      {directionLabel ? (
        <span className="ml-1 text-[10px] font-medium text-[var(--text-muted)]">
          {directionLabel}
        </span>
      ) : null}
    </button>
  );
}

function OddsTableLoadingRows() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, rowIndex) => (
        <div
          aria-hidden="true"
          className={`${oddsTableGridClass} rounded-2xl bg-white/[0.026] p-1.5`}
          key={`odds-loading-row-${rowIndex}`}
        >
          <span className="mx-2 h-4 rounded-full bg-white/8" />
          {selections.map((selection) => (
            <span
              className={`${oddsBoxClass} animate-pulse border border-transparent bg-white/[0.04]`}
              key={`odds-loading-row-${rowIndex}-${selection}`}
            />
          ))}
        </div>
      ))}
    </>
  );
}

function OddsTable({
  category,
  event,
  isOddSelected,
  oddsLoading = false,
  onOddToggle,
  pulseVersion,
  sort,
  onSortChange,
}: {
  category: PaCategory;
  event: OddsEvent;
  isOddSelected: (odd: OddsFeedItem) => boolean;
  oddsLoading?: boolean;
  onOddToggle: (odd: OddsFeedItem) => void;
  pulseVersion: number;
  sort: OddsSortState | null;
  onSortChange: (category: PaCategory, selection: Selection) => void;
}) {
  const baseRows = get1x2Rows(event, category);
  const highestPrices = getHighestPrices(baseRows);
  const rows = sortRows(baseRows, sort);

  return (
    <section className="flex min-h-0 min-w-0 flex-col rounded-[22px] border border-white/10 bg-white/[0.025] p-3 md:p-4">
      <div className="mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
          {category === "COM_PA" ? "COM PA" : "SEM PA"}
        </h3>
      </div>

      <div className="mt-2 min-h-0 max-h-[34dvh] space-y-2 overflow-y-auto overscroll-contain pr-1 sm:max-h-[40dvh] lg:max-h-[56vh] [scrollbar-gutter:stable]">
        <div
          className={`${oddsTableGridClass} odds-table-header sticky top-0 z-10 rounded-2xl p-1.5 backdrop-blur`}
        >
          <span className="px-2 text-xs font-medium text-[var(--text-muted)]">
            Casa
          </span>
          {selections.map((selection) => (
            <SortHeaderButton
              key={`${category}-${selection}`}
              label={selectionLabel(selection)}
              onClick={(nextSelection) => onSortChange(category, nextSelection)}
              selection={selection}
              sort={sort}
            />
          ))}
        </div>

        {rows.length ? (
          rows.map((row) => {
            const eventUrl = getRowEventUrl(row);

            return (
              <div
                className={`${oddsTableGridClass} rounded-2xl bg-white/[0.026] p-1.5`}
                key={row.key}
              >
                <BookmakerEventLink
                  bookmakerName={row.bookmakerName}
                  className={`min-w-0 truncate px-2 text-xs font-medium no-underline transition ${
                    eventUrl
                      ? "text-white hover:text-[var(--accent-soft)] focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                      : "text-white"
                  }`}
                  eventUrl={eventUrl}
                >
                  {row.bookmakerName}
                </BookmakerEventLink>
                {selections.map((selection) => {
                  const odd = row.odds[selection];
                  const selected = odd ? isOddSelected(odd) : false;
                  const highlighted = odd?.price === highestPrices[selection];

                  return (
                    <button
                      aria-pressed={selected}
                      className={`${oddsBoxClass} text-[13px] font-semibold text-white transition ${
                        selected
                          ? "border border-[rgba(191,219,254,0.72)] bg-[rgba(59,130,246,0.18)] shadow-[0_0_18px_rgba(147,197,253,0.16)]"
                          : highlighted
                            ? "border border-[rgba(255,139,187,0.45)] bg-[rgba(255,139,187,0.16)] shadow-[0_0_18px_rgba(255,139,187,0.08)]"
                            : "border border-transparent bg-white/[0.04]"
                      } ${
                        odd
                          ? "hover:border-[rgba(191,219,254,0.5)] hover:bg-[rgba(59,130,246,0.12)]"
                          : "cursor-default opacity-55"
                      }`}
                      disabled={!odd}
                      key={`${row.key}-${selection}`}
                      onClick={() => {
                        if (odd) {
                          onOddToggle(odd);
                        }
                      }}
                      type="button"
                    >
                      <OddPricePulse
                        className="tabular-nums"
                        price={odd?.price}
                        pulseId={`table:${row.key}:${selection}`}
                        pulseVersion={pulseVersion}
                      >
                        {formatOdd(odd?.price)}
                      </OddPricePulse>
                    </button>
                  );
                })}
              </div>
            );
          })
        ) : oddsLoading ? (
          <OddsTableLoadingRows />
        ) : (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-sm text-[var(--text-muted)]">
            Sem odds 1X2.
          </div>
        )}
      </div>
    </section>
  );
}

function BookmakerToggleButton({
  active,
  name,
  onClick,
}: {
  active: boolean;
  name: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`min-w-0 rounded-xl border px-3 py-2 text-left text-xs font-semibold transition ${
        active
          ? "border-[rgba(211,27,91,0.78)] bg-[rgba(211,27,91,0.18)] text-white"
          : "border-white/10 bg-white/[0.035] text-[var(--text-secondary)] hover:border-white/18 hover:bg-white/[0.06] hover:text-white"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="block truncate">{name}</span>
    </button>
  );
}

function BookmakerFiltersDialog({
  availableBookmakers,
  hiddenBookmakers,
  onClose,
  onReset,
  onToggleBookmaker,
}: {
  availableBookmakers: BookmakerFilterOption[];
  hiddenBookmakers: ReadonlySet<string>;
  onClose: () => void;
  onReset: () => void;
  onToggleBookmaker: (key: string) => void;
}) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-black/65 p-4 backdrop-blur-md sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        aria-modal="true"
        className="flex max-h-[min(760px,calc(100dvh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(18,5,13,0.96)] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.48)] [zoom:0.92]"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-dim)]">
              Filtros
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Ocultar casas
            </h2>
          </div>
          <button
            aria-label="Fechar filtros"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-[var(--text-secondary)] transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Casas</h3>
            <button
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
              onClick={onReset}
              type="button"
            >
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
              <span>Limpar</span>
            </button>
          </div>

          {availableBookmakers.length ? (
            <div className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-3">
              {availableBookmakers.map((bookmaker) => (
                <BookmakerToggleButton
                  active={hiddenBookmakers.has(bookmaker.key)}
                  key={bookmaker.key}
                  name={bookmaker.name}
                  onClick={() => onToggleBookmaker(bookmaker.key)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-sm text-[var(--text-muted)]">
              Nenhuma casa encontrada.
            </div>
          )}
        </div>

        <div className="mt-3 flex shrink-0 justify-end border-t border-white/8 pt-3">
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[rgba(211,27,91,0.7)] bg-[linear-gradient(180deg,rgba(211,27,91,0.95),rgba(163,8,63,0.95))] px-5 text-xs font-semibold text-white shadow-[0_14px_30px_rgba(211,27,91,0.2)] transition hover:brightness-110"
            onClick={onClose}
            type="button"
          >
            <Check aria-hidden="true" className="h-3.5 w-3.5" />
            <span>Aplicar</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function getDuploProfitClass(value: number) {
  if (Math.abs(value) < 0.005) {
    return "text-white";
  }

  return value > 0 ? "text-emerald-400" : "text-rose-400";
}

function DuploLineBadge({
  line,
}: {
  line: DuploOpportunity["lines"][number];
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/8 bg-white/[0.035] px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <BookmakerEventLink
            bookmakerName={line.bookmakerName}
            className="min-w-0 truncate text-xs font-semibold text-white no-underline transition hover:text-[var(--accent-soft)] focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            eventUrl={line.eventUrl}
          >
            {line.bookmakerName}
          </BookmakerEventLink>
          {line.paCategory === "COM_PA" ? (
            <span className="shrink-0 rounded-full border border-[rgba(45,212,191,0.32)] bg-[rgba(45,212,191,0.12)] px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
              PA
            </span>
          ) : null}
        </span>
        <span className="text-sm font-semibold text-white">
          {line.odd.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function DuploTopList({
  event,
  onToggleOpportunity,
  opportunities,
  selectedIds,
  title,
}: {
  event: OddsEvent;
  onToggleOpportunity: (opportunity: DuploOpportunity) => void;
  opportunities: DuploOpportunity[];
  selectedIds: ReadonlySet<string>;
  title: string;
}) {
  return (
    <section className="rounded-[22px] border border-white/10 bg-white/[0.025] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
        {title}
      </h3>

      <div className="mt-4 space-y-2">
        {opportunities.length ? (
          opportunities.map((opportunity, index) => {
            const selected = areCalculatorSelectionsActive(
              selectedIds,
              getOpportunityCalculatorSelections(event.fixture_id, opportunity),
            );

            return (
              <div
                aria-pressed={selected}
                className={`grid cursor-pointer gap-3 rounded-2xl border p-3 transition lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center ${
                  selected
                    ? "border-[rgba(191,219,254,0.66)] bg-[rgba(59,130,246,0.14)] shadow-[0_0_20px_rgba(147,197,253,0.12)]"
                    : "border-white/8 bg-white/[0.024] hover:border-[rgba(255,139,187,0.24)] hover:bg-white/[0.04]"
                }`}
                key={`${opportunity.mode}-${opportunity.family}-${index}`}
                onClick={() => onToggleOpportunity(opportunity)}
                onKeyDown={(keyboardEvent: ReactKeyboardEvent<HTMLDivElement>) => {
                  if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") {
                    return;
                  }

                  keyboardEvent.preventDefault();
                  onToggleOpportunity(opportunity);
                }}
                role="button"
                tabIndex={0}
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-xs font-semibold text-[var(--text-secondary)]">
                  {index + 1}
                </span>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {opportunity.lines.map((line, lineIndex) => (
                    <DuploLineBadge
                      key={`${line.bookmakerSlug}-${line.selectionLabel}-${lineIndex}`}
                      line={line}
                    />
                  ))}
                </div>
                <span
                  className={`text-sm font-semibold ${getDuploProfitClass(
                    opportunity.profitPercent,
                  )}`}
                >
                  {formatDuploPercent(opportunity.profitPercent)}
                </span>
              </div>
            );
          })
        ) : (
          <p className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-sm text-[var(--text-muted)]">
            Sem combinações suficientes.
          </p>
        )}
      </div>
    </section>
  );
}

function DuploEventAnalysis({
  event,
  onToggleOpportunity,
  selectedIds,
}: {
  event: OddsEvent;
  onToggleOpportunity: (opportunity: DuploOpportunity) => void;
  selectedIds: ReadonlySet<string>;
}) {
  const analysis = buildDuploAnalysis(event);

  if (!analysis.all.length) {
    return (
      <section className="rounded-[22px] border border-white/10 bg-white/[0.025] p-4 text-sm text-[var(--text-muted)]">
        Sem sinais de duplo suficientes para este evento.
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-2">
        <DuploTopList
          event={event}
          onToggleOpportunity={onToggleOpportunity}
          opportunities={analysis.paSingleTop}
          selectedIds={selectedIds}
          title="Top 5 - PA Casa ou Fora"
        />
        <DuploTopList
          event={event}
          onToggleOpportunity={onToggleOpportunity}
          opportunities={analysis.paBothTop}
          selectedIds={selectedIds}
          title="Top 5 - PA em Casa e Fora"
        />
      </div>
    </section>
  );
}

export function OddsEventDetails({
  backHref = "/monitor/odds",
  event,
}: {
  backHref?: string;
  event: OddsEvent;
}) {
  const [currentEventState, setCurrentEvent] = useState(() => ({
    event,
    fixtureId: event.fixture_id,
  }));
  const currentEvent =
    currentEventState.fixtureId === event.fixture_id
      ? currentEventState.event
      : event;
  const [sorts, setSorts] = useState<Record<PaCategory, OddsSortState | null>>({
    COM_PA: null,
    SEM_PA: null,
  });
  const [oddsPulseVersion, setOddsPulseVersion] = useState(0);
  const [refreshingOdds, setRefreshingOdds] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hiddenBookmakers, setHiddenBookmakers] = useState<string[]>([]);
  const [calculatorSelections, setCalculatorSelections] = useState<
    CalculatorSelectionLine[]
  >([]);
  const currentEventRef = useRef(event);
  const currentEventFixtureIdRef = useRef(event.fixture_id);
  const latestOddsVersionRef = useRef<string | null>(event.latest_odd_updated_at);
  const lastOddsUpdateLabel = formatLastOddsUpdate(
    currentEvent.latest_odd_updated_at,
  );
  const currentFixtureTeams = formatFixtureTeams(currentEvent);
  const availableBookmakers = useMemo(
    () => getAvailableBookmakers(currentEvent),
    [currentEvent],
  );
  const activeHiddenBookmakers = useMemo(() => {
    const availableKeys = new Set(availableBookmakers.map((bookmaker) => bookmaker.key));
    return new Set(hiddenBookmakers.filter((key) => availableKeys.has(key)));
  }, [availableBookmakers, hiddenBookmakers]);
  const filteredCurrentEvent = useMemo(
    () => filterEventBookmakers(currentEvent, activeHiddenBookmakers),
    [activeHiddenBookmakers, currentEvent],
  );
  const selectedCalculatorIds = useMemo(
    () => new Set(calculatorSelections.map((selection) => selection.id)),
    [calculatorSelections],
  );

  useEffect(() => {
    currentEventRef.current = currentEvent;
    rememberEventOdds([currentEvent]);

    if (currentEvent.fixture_id !== currentEventFixtureIdRef.current) {
      currentEventFixtureIdRef.current = currentEvent.fixture_id;
      latestOddsVersionRef.current = currentEvent.latest_odd_updated_at;
    }
  }, [currentEvent]);

  useEffect(() => {
    let active = true;
    const [rememberedEvent] = hydrateEventsWithRememberedOdds([event]);

    if (
      rememberedEvent &&
      rememberedEvent.odds.length > event.odds.length
    ) {
      currentEventRef.current = rememberedEvent;
      window.setTimeout(() => {
        if (!active) {
          return;
        }

        setCurrentEvent({
          event: rememberedEvent,
          fixtureId: rememberedEvent.fixture_id,
        });
      }, 0);
    }

    return () => {
      active = false;
    };
  }, [event]);

  const handleStatusUpdate = useCallback(async (payload: StatusResponse) => {
    const nextOddsVersion =
      payload.odds_version ?? payload.latest_odd_updated_at ?? null;

    if (!nextOddsVersion || nextOddsVersion === latestOddsVersionRef.current) {
      return;
    }

    setRefreshingOdds(true);

    try {
      const previousEvent = currentEventRef.current;
      const result = await fetchOddsForEvents(
        [previousEvent],
        nextOddsVersion,
      );
      const [updatedEvent] = result.events;

      if (!updatedEvent) {
        return;
      }

      if (result.oddsVersion) {
        latestOddsVersionRef.current = result.oddsVersion;
      }

      if (
        updatedEvent.latest_odd_updated_at === previousEvent.latest_odd_updated_at &&
        updatedEvent.odd_count === previousEvent.odd_count
      ) {
        return;
      }

      currentEventRef.current = updatedEvent;
      setCurrentEvent({
        event: updatedEvent,
        fixtureId: updatedEvent.fixture_id,
      });
      setOddsPulseVersion((current) => current + 1);
    } catch {
      // Detail odds refresh is best-effort; the current snapshot remains visible.
    } finally {
      setRefreshingOdds(false);
    }
  }, []);
  const canPollStatus = useCallback(() => Boolean(currentEventRef.current.fixture_id), []);

  useMonitorOddsStatusFeed(canPollStatus, handleStatusUpdate);

  function handleSortChange(category: PaCategory, selection: Selection) {
    setSorts((current) => ({
      ...current,
      [category]: getNextSort(current[category], selection),
    }));
  }

  function handleToggleBookmaker(key: string) {
    setHiddenBookmakers((current) =>
      current.includes(key)
        ? current.filter((bookmakerKey) => bookmakerKey !== key)
        : [...current, key],
    );
  }

  function handleResetFilters() {
    setHiddenBookmakers([]);
  }

  function handleToggleCalculatorOdd(odd: OddsFeedItem) {
    const selection = getOddCalculatorSelection(currentEvent.fixture_id, odd);

    setCalculatorSelections((current) =>
      current.some((item) => item.id === selection.id)
        ? current.filter((item) => item.id !== selection.id)
        : mergeCalculatorSelections(current, [selection]),
    );
  }

  function handleToggleCalculatorOpportunity(opportunity: DuploOpportunity) {
    const selections = getOpportunityCalculatorSelections(
      currentEvent.fixture_id,
      opportunity,
    );

    setCalculatorSelections((current) => {
      const currentIds = new Set(current.map((selection) => selection.id));
      const selected = areCalculatorSelectionsActive(currentIds, selections);

      return selected
        ? current.filter(
            (selection) => !selections.some((item) => item.id === selection.id),
          )
        : mergeCalculatorSelections(current, selections, { replaceAll: true });
    });
  }

  function handleRemoveCalculatorSelection(id: string) {
    setCalculatorSelections((current) =>
      current.filter((selection) => selection.id !== id),
    );
  }

  return (
    <div className="space-y-5">
      <section className="lz-panel rounded-[28px] p-4 md:p-6">
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {formatDate(currentEvent.starts_at)}
              </span>
              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {formatTime(currentEvent.starts_at)}
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              {currentFixtureTeams.label}
            </h1>
            <p className="mt-2 text-sm font-medium text-[var(--text-muted)]">
              {formatLeagueLine(currentEvent)}
            </p>
            {lastOddsUpdateLabel ? (
              <p className="mt-1 text-xs text-[var(--text-dim)]">
                Odds atualizadas às {lastOddsUpdateLabel}
              </p>
            ) : null}
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <Link
              className="lz-button-secondary inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition sm:w-auto"
              href={backHref}
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              <span>Voltar</span>
            </Link>

            <button
              className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition sm:w-auto ${
                filtersOpen || activeHiddenBookmakers.size
                  ? "border-[rgba(211,27,91,0.72)] bg-[rgba(211,27,91,0.18)] text-white"
                  : "border-white/10 bg-white/[0.035] text-[var(--text-secondary)] hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
              }`}
              onClick={() => setFiltersOpen(true)}
              type="button"
            >
              <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
              <span>Filtros</span>
              {activeHiddenBookmakers.size ? (
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-white/10 px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                  {activeHiddenBookmakers.size}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </section>

      {filtersOpen ? (
        <BookmakerFiltersDialog
          availableBookmakers={availableBookmakers}
          hiddenBookmakers={activeHiddenBookmakers}
          onClose={() => setFiltersOpen(false)}
          onReset={handleResetFilters}
          onToggleBookmaker={handleToggleBookmaker}
        />
      ) : null}

      <DuploEventAnalysis
        event={filteredCurrentEvent}
        onToggleOpportunity={handleToggleCalculatorOpportunity}
        selectedIds={selectedCalculatorIds}
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <OddsTable
          category="COM_PA"
          event={filteredCurrentEvent}
          isOddSelected={(odd) =>
            selectedCalculatorIds.has(
              getOddCalculatorSelection(currentEvent.fixture_id, odd).id,
            )
          }
          onOddToggle={handleToggleCalculatorOdd}
          onSortChange={handleSortChange}
          oddsLoading={refreshingOdds}
          pulseVersion={oddsPulseVersion}
          sort={sorts.COM_PA}
        />
        <OddsTable
          category="SEM_PA"
          event={filteredCurrentEvent}
          isOddSelected={(odd) =>
            selectedCalculatorIds.has(
              getOddCalculatorSelection(currentEvent.fixture_id, odd).id,
            )
          }
          onOddToggle={handleToggleCalculatorOdd}
          onSortChange={handleSortChange}
          oddsLoading={refreshingOdds}
          pulseVersion={oddsPulseVersion}
          sort={sorts.SEM_PA}
        />
      </div>

      <CalculatorSelectionDock
        onClear={() => setCalculatorSelections([])}
        onRemove={handleRemoveCalculatorSelection}
        selections={calculatorSelections}
      />
    </div>
  );
}

export function OddsEventSearch({
  eventBasePath = "/monitor/odds",
}: {
  eventBasePath?: string;
}) {
  const [query, setQuery] = useState("");
  const [activeDatePreset, setActiveDatePreset] = useState<DatePreset | null>("today");
  const [activeListSort, setActiveListSort] =
    useState<EventListSortMode>("league");
  const [state, setState] = useState<SearchState>({
    events: [],
    loading: true,
    oddsPulseVersion: 0,
    refreshingOdds: false,
    error: null,
  });
  const eventsRef = useRef<OddsEvent[]>([]);
  const latestFixturesVersionRef = useRef<string | null>(null);
  const latestOddUpdatedAtRef = useRef<string | null>(null);
  const latestOddsVersionRef = useRef<string | null>(null);
  const lastUnversionedFixturesRefreshAtRef = useRef(0);
  const activeRequestRef = useRef<EventsRequest | null>(null);

  const loadEvents = useCallback(
    async (
      request: EventsRequest,
      options: { signal?: AbortSignal; showLoading?: boolean } = {},
    ) => {
      activeRequestRef.current = request;

      if (options.showLoading !== false) {
        eventsRef.current = [];
        setState({
          events: [],
          loading: true,
          oddsPulseVersion: 0,
          refreshingOdds: false,
          error: null,
        });
      }

      try {
        const params = getEventsRequestParams(request);
        const response = await fetch(`/api/monitor-odds/events?${params.toString()}`, {
          cache: "no-store",
          signal: options.signal,
        });

        if (response.status === 429) {
          throw new Error("Muitas buscas em pouco tempo. Aguarde alguns segundos.");
        }

        if (!response.ok) {
          throw new Error("Não foi possível buscar os eventos.");
        }

        const payload = (await response.json()) as EventsResponse;

        if (
          options.signal?.aborted ||
          !isSameEventsRequest(activeRequestRef.current, request)
        ) {
          return;
        }

        const nextFixturesVersion = payload.fixtures_version ?? null;
        const nextOddsVersion =
          payload.odds_version ?? payload.latest_odd_updated_at ?? null;
        const events = hydrateEventsWithRememberedOdds(payload.events ?? []);

        if (
          options.signal?.aborted ||
          !isSameEventsRequest(activeRequestRef.current, request)
        ) {
          return;
        }

        latestFixturesVersionRef.current = nextFixturesVersion;
        lastUnversionedFixturesRefreshAtRef.current = Date.now();
        latestOddsVersionRef.current = null;
        latestOddUpdatedAtRef.current = null;

        eventsRef.current = events;
        setState({
          events,
          loading: false,
          oddsPulseVersion: 0,
          refreshingOdds: Boolean(events.length && nextOddsVersion),
          error: null,
        });

        if (!events.length || !nextOddsVersion) {
          return;
        }

        try {
          const result = await fetchOddsForEvents(events, nextOddsVersion, {
            signal: options.signal,
          });

          if (
            options.signal?.aborted ||
            !isSameEventsRequest(activeRequestRef.current, request)
          ) {
            return;
          }

          if (result.oddsVersion) {
            latestOddsVersionRef.current = result.oddsVersion;
            latestOddUpdatedAtRef.current =
              payload.latest_odd_updated_at ?? result.oddsVersion;
          }

          eventsRef.current = result.events;
          setState((current) => ({
            ...current,
            events: result.events,
            error: null,
            loading: false,
            oddsPulseVersion: current.oddsPulseVersion,
            refreshingOdds: false,
          }));
        } catch {
          if (options.signal?.aborted) {
            return;
          }

          setState((current) => ({
            ...current,
            refreshingOdds: false,
          }));
        }
      } catch (error) {
        if (
          options.signal?.aborted ||
          !isSameEventsRequest(activeRequestRef.current, request)
        ) {
          return;
        }

        eventsRef.current = [];
        setState({
          events: [],
          loading: false,
          oddsPulseVersion: 0,
          refreshingOdds: false,
          error: error instanceof Error ? error.message : "Erro ao buscar eventos.",
        });
      }
    },
    [],
  );

  const loadDatePreset = useCallback(
    (
      preset: DatePreset,
      options: { signal?: AbortSignal; showLoading?: boolean } = {},
    ) => {
      const range = getDatePresetRange(preset);
      const request: EventsRequest = {
        from: range.from,
        kind: "date",
        preset,
        to: range.to,
      };

      return loadEvents(request, options);
    },
    [loadEvents],
  );

  const handleDatePresetClick = useCallback(
    (preset: DatePreset) => {
      setQuery("");
      setActiveDatePreset(preset);
      void loadDatePreset(preset);
    },
    [loadDatePreset],
  );
  const handleListSortChange = useCallback((value: EventListSortMode) => {
    setActiveListSort(value);
  }, []);

  function handleQueryChange(event: ChangeEvent<HTMLInputElement>) {
    const nextQuery = event.target.value;
    const trimmedQuery = nextQuery.trim();

    setQuery(nextQuery);

    if (trimmedQuery.length === 0) {
      setActiveDatePreset("today");
      void loadDatePreset("today");
      return;
    }

    if (activeDatePreset) {
      setActiveDatePreset(null);
    }

    if (trimmedQuery.length < 2) {
      activeRequestRef.current = null;
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadDatePreset("today", {
        showLoading: false,
        signal: controller.signal,
      });
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [loadDatePreset]);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      if (!activeDatePreset) {
        activeRequestRef.current = null;
      }

      return;
    }

    const request: EventsRequest = {
      kind: "search",
      search: trimmedQuery,
    };
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadEvents(request, { signal: controller.signal });
    }, 260);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [activeDatePreset, loadEvents, query]);

  const handleStatusUpdate = useCallback(
    async (payload: StatusResponse) => {
      const activeRequest = activeRequestRef.current;

      if (!activeRequest) {
        return;
      }

      const nextFixturesVersion = payload.fixtures_version ?? null;
      const nextOddsVersion =
        payload.odds_version ?? payload.latest_odd_updated_at ?? null;
      const previousFixturesVersion = latestFixturesVersionRef.current;
      const previousOddsVersion =
        latestOddsVersionRef.current ?? latestOddUpdatedAtRef.current;
      const shouldRefreshUnversionedFixtures =
        !nextFixturesVersion &&
        !previousFixturesVersion &&
        Date.now() - lastUnversionedFixturesRefreshAtRef.current >
          unversionedFixturesRefreshMs;

      if (
        nextFixturesVersion &&
        previousFixturesVersion &&
        nextFixturesVersion !== previousFixturesVersion
      ) {
        await loadEvents(activeRequest, { showLoading: false });
        return;
      }

      if (!previousFixturesVersion && nextFixturesVersion) {
        await loadEvents(activeRequest, { showLoading: false });
        return;
      }

      if (shouldRefreshUnversionedFixtures) {
        await loadEvents(activeRequest, { showLoading: false });
        return;
      }

      if (!nextOddsVersion) {
        return;
      }

      if (nextOddsVersion === previousOddsVersion) {
        return;
      }

      const currentEvents = eventsRef.current;

      if (!currentEvents.length) {
        return;
      }

      setState((current) => ({
        ...current,
        refreshingOdds: true,
      }));

      try {
        const result = await fetchOddsForEvents(currentEvents, nextOddsVersion);
        const updatedEvents = result.events;

        if (!isSameEventsRequest(activeRequestRef.current, activeRequest)) {
          setState((current) => ({
            ...current,
            refreshingOdds: false,
          }));
          return;
        }

        if (result.oddsVersion) {
          latestOddsVersionRef.current = result.oddsVersion;
          latestOddUpdatedAtRef.current =
            payload.latest_odd_updated_at ?? result.oddsVersion;
        } else {
          latestOddsVersionRef.current = null;
          latestOddUpdatedAtRef.current = null;
        }

        eventsRef.current = updatedEvents;
        setState((current) => ({
          ...current,
          events: updatedEvents,
          oddsPulseVersion: current.oddsPulseVersion + 1,
          refreshingOdds: false,
        }));
      } catch {
        // Odds refresh is best-effort; the current snapshot remains visible.
        setState((current) => ({
          ...current,
          refreshingOdds: false,
        }));
      }
    },
    [loadEvents],
  );

  const canPollStatus = useCallback(() => Boolean(activeRequestRef.current), []);

  useMonitorOddsStatusFeed(canPollStatus, handleStatusUpdate);

  const hasQuery = query.trim().length >= 2;
  const hasDatePreset = activeDatePreset !== null;
  const hasActiveList = hasQuery || hasDatePreset;
  const events = hasActiveList ? state.events : emptyOddsEvents;
  const sortedEvents = useMemo(
    () => sortEventsForList(events, activeListSort),
    [activeListSort, events],
  );
  const leagueGroups =
    activeListSort === "league" ? groupEventsByLeague(events) : [];
  const showEmpty =
    hasActiveList && !state.loading && !state.error && events.length === 0;
  const activeDateLabel = activeDatePreset
    ? datePresetLabels[activeDatePreset].toLocaleLowerCase("pt-BR")
    : "";
  const emptyMessage = hasDatePreset
    ? `Nenhum jogo encontrado para ${activeDateLabel}.`
    : "Nenhum evento encontrado.";

  return (
    <div className="space-y-5">
      <section className="lz-panel rounded-[28px] p-5 md:p-6">
        <div className="relative z-10 flex flex-col gap-4">
          <label
            className="text-sm font-semibold text-white"
            htmlFor="odds-event-search"
          >
            Buscar eventos
          </label>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
            <input
              autoComplete="off"
              className="lz-input h-13 w-full rounded-full px-5 text-base"
              id="odds-event-search"
              onChange={handleQueryChange}
              placeholder="Digite um time, evento ou liga"
              type="search"
              value={query}
            />

            <div className="grid gap-3 sm:grid-cols-[repeat(2,minmax(112px,1fr))_minmax(190px,1.25fr)] xl:grid-cols-[112px_120px_220px]">
              {datePresets.map((preset) => (
                <DatePresetButton
                  active={activeDatePreset === preset}
                  key={preset}
                  label={datePresetLabels[preset]}
                  onClick={() => handleDatePresetClick(preset)}
                />
              ))}

              <EventListSortMenu
                onChange={handleListSortChange}
                value={activeListSort}
              />
            </div>
          </div>
        </div>
      </section>

      {hasActiveList && state.loading ? (
        hasDatePreset ? <LeagueEventsSkeleton /> : <SearchResultsSkeleton />
      ) : null}

      {hasActiveList && state.error ? (
        <div className="rounded-[24px] border border-[rgba(255,107,133,0.2)] bg-[rgba(255,107,133,0.08)] p-5 text-sm text-[var(--negative)]">
          {state.error}
        </div>
      ) : null}

      {showEmpty ? (
        <div className="rounded-[24px] border border-white/10 bg-white/[0.025] p-5 text-sm text-[var(--text-muted)]">
          {emptyMessage}
        </div>
      ) : null}

      {events.length && activeListSort === "league" && !state.loading ? (
        <section className="space-y-4">
          {leagueGroups.map((group) => (
            <LeagueEventsSection
              eventBasePath={eventBasePath}
              group={group}
              key={group.key}
            />
          ))}
        </section>
      ) : null}

      {events.length && activeListSort !== "league" && !state.loading ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sortedEvents.map((event) => (
            <EventCard
              event={event}
              eventBasePath={eventBasePath}
              key={event.fixture_id}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}
