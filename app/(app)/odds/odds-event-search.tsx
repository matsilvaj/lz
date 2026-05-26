"use client";

import Image from "next/image";
import Link from "next/link";
import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

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
  let formatted = value.trim().replace(/\bbrasileirao\b/gi, "Brasileirão");
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

function getEventHref(event: OddsEvent) {
  return `/odds/${encodeURIComponent(event.fixture_id)}`;
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

function mergeOddsSnapshots(events: OddsEvent[], snapshots: OddsSnapshot[]) {
  const snapshotsByFixtureId = new Map(
    snapshots.map((snapshot) => [snapshot.fixture_id, snapshot]),
  );

  return events.map((event) => {
    const snapshot = snapshotsByFixtureId.get(event.fixture_id);
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

  return {
    events: mergeOddsSnapshots(events, payload.snapshots ?? []),
    oddsVersion: isComplete ? payload.odds_version ?? oddsVersion : null,
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

function selectionLabel(value: string) {
  if (value === "HOME") return "1";
  if (value === "DRAW") return "X";
  if (value === "AWAY") return "2";
  return value;
}

function formatOdd(value: number | undefined) {
  return value ? value.toFixed(2) : "-";
}

function getBest1x2Odds(event: OddsEvent, category?: PaCategory) {
  const bestBySelection = new Map<string, OddsFeedItem>();

  for (const odd of event.odds) {
    if (odd.market_code !== "1X2") continue;
    if (category && odd.pa_category !== category) continue;
    if (!["HOME", "DRAW", "AWAY"].includes(odd.selection)) continue;

    const current = bestBySelection.get(odd.selection);
    if (!current || odd.price > current.price) {
      bestBySelection.set(odd.selection, odd);
    }
  }

  return selections.map((selection) => ({
    selection,
    odd: bestBySelection.get(selection),
  }));
}

function summaryCategoryLabel(value: string | undefined) {
  if (value === "COM_PA") return "PA";
  if (value === "SEM_PA") return "SEM PA";
  return "";
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

function OddsSummaryRow({ event }: { event: OddsEvent }) {
  const bestOdds = getBest1x2Odds(event);
  const hasAnyOdd = bestOdds.some(({ odd }) => odd);

  return (
    <span className="w-full max-w-[360px] rounded-[18px] border border-white/8 bg-white/[0.025] p-3">
      {!hasAnyOdd ? (
        <span className="mb-2 block text-xs text-[var(--text-muted)]">Sem odds</span>
      ) : null}

      <span className="grid grid-cols-3 gap-2">
        {bestOdds.map(({ selection, odd }) => {
          const bookmakerName = odd ? formatBookmakerName(odd.bookmaker_name) : "";
          const categoryLabel = summaryCategoryLabel(odd?.pa_category);

          return (
            <span
              className="flex min-h-[66px] flex-col items-center justify-center rounded-[14px] border border-transparent bg-white/[0.035] px-2 py-2 text-center"
              key={`best-${selection}`}
            >
              <span className="text-base font-semibold text-white">
                {formatOdd(odd?.price)}
              </span>
              <span className="mt-0.5 max-w-[96px] truncate text-[10px] text-[var(--text-muted)]">
                {odd ? (
                  <>
                    <BookmakerEventLink
                      bookmakerName={bookmakerName}
                      className="text-[var(--text-muted)] no-underline transition hover:text-white focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                      eventUrl={odd.bookmaker_event_url}
                    >
                      {bookmakerName}
                    </BookmakerEventLink>
                    {categoryLabel ? ` ${categoryLabel}` : ""}
                  </>
                ) : (
                  "Sem odd"
                )}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}

function EventCard({
  event,
  showLeague = true,
}: {
  event: OddsEvent;
  showLeague?: boolean;
}) {
  return (
    <article
      className="group relative w-full rounded-[24px] border border-white/10 bg-white/[0.025] p-4 text-left transition hover:border-[rgba(255,139,187,0.28)] hover:bg-white/[0.04] md:p-5"
    >
      <Link
        aria-label={`Abrir odds de ${event.home_team} x ${event.away_team}`}
        className="absolute inset-0 z-0 rounded-[24px] border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        href={getEventHref(event)}
      />
      <div className="pointer-events-none relative z-10 flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.38fr)] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
            <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {formatDate(event.starts_at)}
            </span>
            {showLeague ? (
              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {formatLeagueLine(event)}
              </span>
            ) : null}
          </div>

          <h2 className="mt-4 text-lg font-semibold tracking-tight text-white md:text-xl">
            {event.home_team} x {event.away_team}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            {formatTime(event.starts_at)}
          </p>
        </div>

        <div className="flex w-full justify-center xl:justify-end">
          <OddsSummaryRow event={event} />
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
      className={`inline-flex h-13 items-center justify-center rounded-2xl border px-5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
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
}: {
  group: LeagueGroup;
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

      <div className="space-y-3">
        {group.events.map((event) => (
          <EventCard
            event={event}
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
    <div className="w-full rounded-[24px] border border-white/10 bg-white/[0.025] p-4 md:p-5">
      <div className="flex animate-pulse flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.38fr)] xl:items-center">
        <div className="min-w-0">
          <div className="flex gap-2">
            <span className="h-6 w-20 rounded-full bg-white/8" />
            <span className="h-6 w-44 rounded-full bg-white/8" />
          </div>
          <span className="mt-4 block h-6 w-3/5 rounded-full bg-white/10" />
          <span className="mt-3 block h-4 w-20 rounded-full bg-white/8" />
        </div>

        <div className="grid w-full max-w-[360px] grid-cols-3 gap-2 justify-self-end rounded-[18px] border border-white/8 bg-white/[0.025] p-3">
          {selections.map((selection) => (
            <span
              className="h-[66px] rounded-[14px] bg-white/[0.055]"
              key={`skeleton-odd-${selection}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function SearchResultsSkeleton() {
  return (
    <section className="space-y-3">
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

          <EventCardSkeleton />
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

function OddsTable({
  category,
  event,
  sort,
  onSortChange,
}: {
  category: PaCategory;
  event: OddsEvent;
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

                  return (
                    <span
                      className={`${oddsBoxClass} text-[13px] font-semibold text-white ${
                        odd?.price === highestPrices[selection]
                          ? "border border-[rgba(255,139,187,0.45)] bg-[rgba(255,139,187,0.16)] shadow-[0_0_18px_rgba(255,139,187,0.08)]"
                          : "border border-transparent bg-white/[0.04]"
                      }`}
                      key={`${row.key}-${selection}`}
                    >
                      {formatOdd(odd?.price)}
                    </span>
                  );
                })}
              </div>
            );
          })
        ) : (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-sm text-[var(--text-muted)]">
            Sem odds 1X2.
          </div>
        )}
      </div>
    </section>
  );
}

export function OddsEventDetails({ event }: { event: OddsEvent }) {
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
  const currentEventRef = useRef(event);
  const currentEventFixtureIdRef = useRef(event.fixture_id);
  const latestOddsVersionRef = useRef<string | null>(event.latest_odd_updated_at);

  useEffect(() => {
    currentEventRef.current = currentEvent;

    if (currentEvent.fixture_id !== currentEventFixtureIdRef.current) {
      currentEventFixtureIdRef.current = currentEvent.fixture_id;
      latestOddsVersionRef.current = currentEvent.latest_odd_updated_at;
    }
  }, [currentEvent]);

  const handleStatusUpdate = useCallback(async (payload: StatusResponse) => {
    const nextOddsVersion =
      payload.odds_version ?? payload.latest_odd_updated_at ?? null;

    if (!nextOddsVersion || nextOddsVersion === latestOddsVersionRef.current) {
      return;
    }

    try {
      const result = await fetchOddsForEvents(
        [currentEventRef.current],
        nextOddsVersion,
      );
      const [updatedEvent] = result.events;

      if (!updatedEvent) {
        return;
      }

      if (result.oddsVersion) {
        latestOddsVersionRef.current = result.oddsVersion;
      }

      currentEventRef.current = updatedEvent;
      setCurrentEvent({
        event: updatedEvent,
        fixtureId: updatedEvent.fixture_id,
      });
    } catch {
      // Detail odds refresh is best-effort; the current snapshot remains visible.
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
                {formatLeagueLine(currentEvent)}
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              {currentEvent.home_team} x {currentEvent.away_team}
            </h1>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              {formatTime(currentEvent.starts_at)}
            </p>
          </div>

          <Link
            className="lz-button-secondary inline-flex h-11 w-full items-center justify-center rounded-full px-4 text-sm font-semibold transition sm:w-auto"
            href="/odds"
          >
            Voltar
          </Link>
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <OddsTable
          category="COM_PA"
          event={currentEvent}
          onSortChange={handleSortChange}
          sort={sorts.COM_PA}
        />
        <OddsTable
          category="SEM_PA"
          event={currentEvent}
          onSortChange={handleSortChange}
          sort={sorts.SEM_PA}
        />
      </div>
    </div>
  );
}

export function OddsEventSearch() {
  const [query, setQuery] = useState("");
  const [activeDatePreset, setActiveDatePreset] = useState<DatePreset | null>("today");
  const [state, setState] = useState<SearchState>({
    events: [],
    loading: true,
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
        setState({ events: [], loading: true, error: null });
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
        let events = payload.events ?? [];
        let loadedOddsVersion: string | null = null;

        try {
          const result = await fetchOddsForEvents(events, nextOddsVersion, {
            signal: options.signal,
          });
          events = result.events;
          loadedOddsVersion = result.oddsVersion;
        } catch {
          if (options.signal?.aborted) {
            return;
          }
        }

        if (
          options.signal?.aborted ||
          !isSameEventsRequest(activeRequestRef.current, request)
        ) {
          return;
        }

        latestFixturesVersionRef.current = nextFixturesVersion;
        lastUnversionedFixturesRefreshAtRef.current = Date.now();

        if (loadedOddsVersion) {
          latestOddsVersionRef.current = loadedOddsVersion;
          latestOddUpdatedAtRef.current =
            payload.latest_odd_updated_at ?? loadedOddsVersion;
        } else {
          latestOddsVersionRef.current = null;
          latestOddUpdatedAtRef.current = null;
        }

        eventsRef.current = events;
        setState({
          events,
          loading: false,
          error: null,
        });
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

      try {
        const result = await fetchOddsForEvents(currentEvents, nextOddsVersion);
        const updatedEvents = result.events;

        if (!isSameEventsRequest(activeRequestRef.current, activeRequest)) {
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
        }));
      } catch {
        // Odds refresh is best-effort; the current snapshot remains visible.
      }
    },
    [loadEvents],
  );

  const canPollStatus = useCallback(() => Boolean(activeRequestRef.current), []);

  useMonitorOddsStatusFeed(canPollStatus, handleStatusUpdate);

  const hasQuery = query.trim().length >= 2;
  const hasDatePreset = activeDatePreset !== null;
  const hasActiveList = hasQuery || hasDatePreset;
  const events = hasActiveList ? state.events : [];
  const leagueGroups = hasDatePreset ? groupEventsByLeague(events) : [];
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
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1 lg:max-w-3xl">
            <label
              className="block text-sm font-semibold text-white"
              htmlFor="odds-event-search"
            >
              Buscar eventos
            </label>
            <input
              autoComplete="off"
              className="lz-input mt-3 h-13 w-full rounded-2xl px-4 text-base"
              id="odds-event-search"
              onChange={handleQueryChange}
              placeholder="Digite um time, evento ou liga"
              type="search"
              value={query}
            />
          </div>

          <div className="flex flex-wrap gap-2 lg:pb-0">
            {datePresets.map((preset) => (
              <DatePresetButton
                active={activeDatePreset === preset}
                key={preset}
                label={datePresetLabels[preset]}
                onClick={() => handleDatePresetClick(preset)}
              />
            ))}
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

      {events.length && hasDatePreset && !state.loading ? (
        <section className="space-y-4">
          {leagueGroups.map((group) => (
            <LeagueEventsSection
              group={group}
              key={group.key}
            />
          ))}
        </section>
      ) : null}

      {events.length && !hasDatePreset && !state.loading ? (
        <section className="space-y-3">
          {events.map((event) => (
            <EventCard
              event={event}
              key={event.fixture_id}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}
