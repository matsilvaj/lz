import "server-only";

import { unstable_cache } from "next/cache";

import { getMonitorSupabaseClient } from "./client";
import { formatDuploBookmakerName } from "./duplo";

const FIXTURE_FEED_COLUMNS = [
  "fixture_id",
  "api_football_fixture_id",
  "fixture_name",
  "home_team",
  "away_team",
  "starts_at",
  "status",
  "round",
  "league_name",
  "league_slug",
  "league_country",
  "league_logo_url",
  "league_country_flag_url",
].join(",");

const ODDS_SNAPSHOT_COLUMNS = [
  "fixture_id",
  "latest_odd_updated_at",
  "odds",
].join(",");

const SEARCH_PAGE_SIZE = 100;
const MAX_SEARCH_PAGES = 3;
const DEFAULT_EVENT_LIMIT = 20;
const DATE_RANGE_PAGE_SIZE = 200;
// Teto de jogos por listagem, e o unico numero que precisa ser ajustado.
//
// Antes eram 150, e um fim de semana cheio passava disso: os jogos excedentes
// sumiam do site sem aviso. Nao da para simplesmente remover o teto — o laco de
// paginacao tem o proprio limite de paginas, entao "sem teto" viraria um teto
// invisivel nascido da multiplicacao de duas constantes. Por isso o numero de
// paginas e derivado daqui: mexer neste valor muda o limite de verdade.
//
// A valvula existe porque cada jogo carrega ~36 KB de odds; sem ela, uma
// anomalia nos dados vira uma resposta de dezenas de MB no navegador.
const DEFAULT_DATE_RANGE_EVENT_LIMIT = 1000;
const MAX_DATE_RANGE_PAGES = Math.ceil(
  DEFAULT_DATE_RANGE_EVENT_LIMIT / DATE_RANGE_PAGE_SIZE,
);
const MAX_DATE_RANGE_DAYS = 3;
export const MAX_ODDS_FIXTURE_IDS = 200;
const EVENTS_SHARED_CACHE_TTL_SECONDS = 15 * 60;
const EVENTS_UNVERSIONED_SHARED_CACHE_TTL_SECONDS = 60;
const ODDS_SNAPSHOT_CACHE_TTL_SECONDS = 3;
const UNVERSIONED_FIXTURES_VERSION = "unversioned";
const EXCLUDED_FREEBET_CONSULTATION_BOOKMAKERS = new Set(["tradeball"]);

export type MonitorOddsSnapshotItem = {
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

export type MonitorOddsFeedItem = MonitorOddsSnapshotItem & {
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
};

export type MonitorOddsEvent = {
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
  odds: MonitorOddsFeedItem[];
};

export type MonitorOddsSnapshot = {
  fixture_id: string;
  latest_odd_updated_at: string | null;
  odds: MonitorOddsSnapshotItem[];
};

export type MonitorOddsSnapshotsResult = {
  complete: boolean;
  snapshots: MonitorOddsSnapshot[];
};

export type MonitorOddsFeedStatus = {
  fixtures_version: string | null;
  odds_version: string | null;
  latest_odd_updated_at: string | null;
  upcoming_fixture_count: number;
  odd_count: number;
};

type RawOddsFixtureRow = Partial<
  Record<
    | "fixture_id"
    | "api_football_fixture_id"
    | "fixture_name"
    | "home_team"
    | "away_team"
    | "starts_at"
    | "status"
    | "round"
    | "league_name"
    | "league_slug"
    | "league_country"
    | "league_logo_url"
    | "league_country_flag_url",
    unknown
  >
>;
type RawOddsSnapshotItem = Partial<Record<keyof MonitorOddsSnapshotItem, unknown>>;
type RawOddsSnapshotRow = Partial<
  Record<"fixture_id" | "latest_odd_updated_at" | "odds", unknown>
>;
type RawOddsFeedStatus = Partial<Record<keyof MonitorOddsFeedStatus, unknown>>;

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanOptionalString(value: unknown) {
  const parsed = cleanString(value);
  return parsed || null;
}

function cleanExternalUrl(value: unknown) {
  const parsed = cleanString(value);
  if (!parsed) return null;

  try {
    const url = new URL(parsed);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function cleanNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function cleanCount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

function cleanCachePart(value: string | null | undefined) {
  const parsed = cleanString(value);
  return encodeURIComponent(parsed || "none").slice(0, 180);
}

function normalizeBookmakerOptionKey(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "");
}

function shouldExposeFreebetConsultationBookmaker(
  odd: Pick<MonitorOddsSnapshotItem, "bookmaker_name" | "bookmaker_slug">,
) {
  const keys = [
    odd.bookmaker_name,
    odd.bookmaker_slug,
    formatDuploBookmakerName(odd.bookmaker_name),
  ].map(normalizeBookmakerOptionKey);

  return keys.every((key) => !EXCLUDED_FREEBET_CONSULTATION_BOOKMAKERS.has(key));
}

function cleanOddsSnapshotItem(
  row: RawOddsSnapshotItem,
): MonitorOddsSnapshotItem | null {
  const bookmakerSlug = cleanString(row.bookmaker_slug);
  const bookmakerName = cleanString(row.bookmaker_name);
  const marketCode = cleanString(row.market_code);
  const marketName = cleanString(row.market_name);
  const selection = cleanString(row.selection);
  const price = cleanNumber(row.price);
  const paCategory = cleanString(row.pa_category);

  if (
    !bookmakerSlug ||
    !bookmakerName ||
    !marketCode ||
    !marketName ||
    !selection ||
    !paCategory ||
    price === null ||
    price <= 1
  ) {
    return null;
  }

  return {
    bookmaker_slug: bookmakerSlug,
    bookmaker_name: bookmakerName,
    bookmaker_event_url: cleanExternalUrl(row.bookmaker_event_url),
    market_code: marketCode,
    market_name: marketName,
    selection,
    price,
    pa_category: paCategory,
    confidence_score: cleanNumber(row.confidence_score),
    odd_updated_at: cleanOptionalString(row.odd_updated_at),
  };
}

function cleanOddsFixtureRow(row: RawOddsFixtureRow): MonitorOddsEvent | null {
  const fixtureId = cleanString(row.fixture_id);
  const fixtureName = cleanString(row.fixture_name);
  const homeTeam = cleanString(row.home_team);
  const awayTeam = cleanString(row.away_team);
  const startsAt = cleanString(row.starts_at);
  const leagueName = cleanString(row.league_name);
  const leagueSlug = cleanString(row.league_slug);

  if (
    !fixtureId ||
    !fixtureName ||
    !homeTeam ||
    !awayTeam ||
    !startsAt ||
    !leagueName ||
    !leagueSlug
  ) {
    return null;
  }

  return {
    fixture_id: fixtureId,
    api_football_fixture_id: cleanNumber(row.api_football_fixture_id),
    fixture_name: fixtureName,
    home_team: homeTeam,
    away_team: awayTeam,
    starts_at: startsAt,
    status: cleanOptionalString(row.status),
    round: cleanOptionalString(row.round),
    league_name: leagueName,
    league_slug: leagueSlug,
    league_country: cleanOptionalString(row.league_country),
    league_logo_url: cleanOptionalString(row.league_logo_url),
    league_country_flag_url: cleanOptionalString(row.league_country_flag_url),
    bookmaker_count: 0,
    odd_count: 0,
    latest_odd_updated_at: null,
    odds: [],
  };
}

function expandOddsSnapshotRow(row: RawOddsSnapshotRow): MonitorOddsSnapshotItem[] {
  if (!Array.isArray(row.odds)) {
    return [];
  }

  const odds: MonitorOddsSnapshotItem[] = [];

  for (const oddRow of row.odds) {
    if (!oddRow || typeof oddRow !== "object" || Array.isArray(oddRow)) {
      continue;
    }

    const odd = cleanOddsSnapshotItem(oddRow as RawOddsSnapshotItem);

    if (odd) {
      odds.push(odd);
    }
  }

  return odds;
}

function cleanOddsSnapshotRow(row: RawOddsSnapshotRow): MonitorOddsSnapshot | null {
  const fixtureId = cleanString(row.fixture_id);

  if (!fixtureId) {
    return null;
  }

  return {
    fixture_id: fixtureId,
    latest_odd_updated_at: cleanOptionalString(row.latest_odd_updated_at),
    odds: expandOddsSnapshotRow(row),
  };
}

function cleanOddsFeedStatus(row: RawOddsFeedStatus | null): MonitorOddsFeedStatus {
  const oddsVersion =
    cleanOptionalString(row?.odds_version) ??
    cleanOptionalString(row?.latest_odd_updated_at);
  const latestOddUpdatedAt =
    cleanOptionalString(row?.latest_odd_updated_at) ?? oddsVersion;

  return {
    fixtures_version: cleanOptionalString(row?.fixtures_version),
    odds_version: oddsVersion,
    latest_odd_updated_at: latestOddUpdatedAt,
    upcoming_fixture_count: cleanCount(row?.upcoming_fixture_count),
    odd_count: cleanCount(row?.odd_count),
  };
}

function sanitizeSearchTerm(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function normalizeLimit(value: number) {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_EVENT_LIMIT;
  return Math.min(Math.trunc(value), 50);
}

function normalizeDateRangeLimit(value: number) {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_DATE_RANGE_EVENT_LIMIT;
  return Math.min(Math.trunc(value), DEFAULT_DATE_RANGE_EVENT_LIMIT);
}

function parseDateRangeBound(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeDateRange(from: string, to: string) {
  const fromDate = parseDateRangeBound(from);
  const toDate = parseDateRangeBound(to);

  if (!fromDate || !toDate || toDate.getTime() <= fromDate.getTime()) {
    return null;
  }

  const durationMs = toDate.getTime() - fromDate.getTime();

  if (durationMs > MAX_DATE_RANGE_DAYS * 24 * 60 * 60 * 1000) {
    return null;
  }

  return {
    from: fromDate.toISOString(),
    to: toDate.toISOString(),
  };
}

function emptyOddsSnapshot(fixtureId: string): MonitorOddsSnapshot {
  return {
    fixture_id: fixtureId,
    latest_odd_updated_at: null,
    odds: [],
  };
}

function getSafeFixtureIds(fixtureIds: string[]) {
  return Array.from(
    new Set(
      fixtureIds
        .map((fixtureId) => cleanString(fixtureId).slice(0, 160))
        .filter(Boolean),
    ),
  )
    .sort()
    .slice(0, MAX_ODDS_FIXTURE_IDS);
}

function getFixturesCacheVersion(fixturesVersion: string | null | undefined) {
  const parsed = cleanString(fixturesVersion);

  if (parsed) {
    return parsed;
  }

  const bucket = Math.floor(
    Date.now() / (EVENTS_UNVERSIONED_SHARED_CACHE_TTL_SECONDS * 1000),
  );

  return `${UNVERSIONED_FIXTURES_VERSION}:${bucket}`;
}

function mergeEventWithSnapshot(
  event: MonitorOddsEvent,
  snapshot: MonitorOddsSnapshot | null | undefined,
) {
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
    odd_count: odds.length,
    latest_odd_updated_at: snapshot?.latest_odd_updated_at ?? null,
    odds,
  } satisfies MonitorOddsEvent;
}

async function searchOddsEventsUncached(
  search: string,
  limit = DEFAULT_EVENT_LIMIT,
  fixturesVersion = "unknown",
) {
  void fixturesVersion;

  const term = sanitizeSearchTerm(search);
  const eventLimit = normalizeLimit(limit);

  if (term.length < 2) {
    return [];
  }

  const supabase = getMonitorSupabaseClient();
  const events: MonitorOddsEvent[] = [];
  const filter = [
    `fixture_name.ilike.%${term}%`,
    `home_team.ilike.%${term}%`,
    `away_team.ilike.%${term}%`,
    `league_name.ilike.%${term}%`,
  ].join(",");

  for (let page = 0; page < MAX_SEARCH_PAGES; page += 1) {
    const offset = page * SEARCH_PAGE_SIZE;
    const { data, error } = await supabase
      .from("public_jogos_com_cotacoes")
      .select(FIXTURE_FEED_COLUMNS)
      .or(filter)
      .order("starts_at", { ascending: true })
      .order("fixture_name", { ascending: true })
      .range(offset, offset + SEARCH_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    for (const row of (data ?? []) as RawOddsFixtureRow[]) {
      const event = cleanOddsFixtureRow(row);

      if (event) {
        events.push(event);
      }

      if (events.length >= eventLimit) {
        break;
      }
    }

    if (events.length >= eventLimit || !data || data.length < SEARCH_PAGE_SIZE) {
      break;
    }
  }

  return events.slice(0, eventLimit);
}

async function listOddsEventsByDateRangeUncached(
  from: string,
  to: string,
  limit = DEFAULT_DATE_RANGE_EVENT_LIMIT,
  fixturesVersion = "unknown",
) {
  void fixturesVersion;

  const dateRange = normalizeDateRange(from, to);
  const eventLimit = normalizeDateRangeLimit(limit);

  if (!dateRange) {
    return [];
  }

  const supabase = getMonitorSupabaseClient();
  const events: MonitorOddsEvent[] = [];

  for (let page = 0; page < MAX_DATE_RANGE_PAGES; page += 1) {
    const offset = page * DATE_RANGE_PAGE_SIZE;
    const { data, error } = await supabase
      .from("public_jogos_com_cotacoes")
      .select(FIXTURE_FEED_COLUMNS)
      .gte("starts_at", dateRange.from)
      .lt("starts_at", dateRange.to)
      .order("league_name", { ascending: true })
      .order("starts_at", { ascending: true })
      .order("fixture_name", { ascending: true })
      .range(offset, offset + DATE_RANGE_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    for (const row of (data ?? []) as RawOddsFixtureRow[]) {
      const event = cleanOddsFixtureRow(row);

      if (event) {
        events.push(event);
      }

      if (events.length >= eventLimit) {
        break;
      }
    }

    if (events.length >= eventLimit || !data || data.length < DATE_RANGE_PAGE_SIZE) {
      break;
    }
  }

  return events.slice(0, eventLimit);
}

async function listAvailableOddsEventsUncached(
  limit = DEFAULT_DATE_RANGE_EVENT_LIMIT,
  fixturesVersion = "unknown",
) {
  void fixturesVersion;

  const eventLimit = normalizeDateRangeLimit(limit);
  const supabase = getMonitorSupabaseClient();
  const events: MonitorOddsEvent[] = [];

  for (let page = 0; page < MAX_DATE_RANGE_PAGES; page += 1) {
    const offset = page * DATE_RANGE_PAGE_SIZE;
    const { data, error } = await supabase
      .from("public_jogos_com_cotacoes")
      .select(FIXTURE_FEED_COLUMNS)
      .order("starts_at", { ascending: true })
      .order("league_name", { ascending: true })
      .order("fixture_name", { ascending: true })
      .range(offset, offset + DATE_RANGE_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    for (const row of (data ?? []) as RawOddsFixtureRow[]) {
      const event = cleanOddsFixtureRow(row);

      if (event) {
        events.push(event);
      }

      if (events.length >= eventLimit) {
        break;
      }
    }

    if (events.length >= eventLimit || !data || data.length < DATE_RANGE_PAGE_SIZE) {
      break;
    }
  }

  return events.slice(0, eventLimit);
}

async function getOddsFixtureByFixtureIdUncached(
  fixtureId: string,
  fixturesVersion = "unknown",
) {
  void fixturesVersion;

  const safeFixtureId = cleanString(fixtureId).slice(0, 160);

  if (!safeFixtureId) {
    return null;
  }

  const supabase = getMonitorSupabaseClient();
  const { data, error } = await supabase
    .from("public_jogos_com_cotacoes")
    .select(FIXTURE_FEED_COLUMNS)
    .eq("fixture_id", safeFixtureId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ? cleanOddsFixtureRow(data as RawOddsFixtureRow) : null;
}

async function getOddsFeedStatusFromDatabase() {
  const supabase = getMonitorSupabaseClient();
  const { data, error } = await supabase
    .from("public_status_feed_cotacoes")
    .select(
      "fixtures_version,odds_version,latest_odd_updated_at,upcoming_fixture_count,odd_count",
    )
    .maybeSingle();

  if (error) {
    throw error;
  }

  return cleanOddsFeedStatus(data as RawOddsFeedStatus | null);
}

async function fetchOddsSnapshotsByFixtureIds(fixtureIds: string[]) {
  if (!fixtureIds.length) {
    return [];
  }

  const supabase = getMonitorSupabaseClient();
  const { data, error } = await supabase
    .from("public_snapshot_cotacoes")
    .select(ODDS_SNAPSHOT_COLUMNS)
    .in("fixture_id", fixtureIds);

  if (error) {
    throw error;
  }

  return ((data ?? []) as RawOddsSnapshotRow[])
    .map(cleanOddsSnapshotRow)
    .filter((snapshot): snapshot is MonitorOddsSnapshot => Boolean(snapshot));
}

const getCachedOddsEventSearch = unstable_cache(
  searchOddsEventsUncached,
  ["monitor-odds-event-search-v2"],
  {
    tags: ["monitor-odds-event-search"],
    revalidate: EVENTS_SHARED_CACHE_TTL_SECONDS,
  },
);

const getCachedOddsEventsByDateRange = unstable_cache(
  listOddsEventsByDateRangeUncached,
  ["monitor-odds-events-by-date-range-v2"],
  {
    tags: ["monitor-odds-events-by-date-range"],
    revalidate: EVENTS_SHARED_CACHE_TTL_SECONDS,
  },
);

const getCachedAvailableOddsEvents = unstable_cache(
  listAvailableOddsEventsUncached,
  ["monitor-odds-available-events-v1"],
  {
    tags: ["monitor-odds-available-events"],
    revalidate: EVENTS_SHARED_CACHE_TTL_SECONDS,
  },
);

const getCachedOddsFixtureByFixtureId = unstable_cache(
  getOddsFixtureByFixtureIdUncached,
  ["monitor-odds-fixture-by-fixture-id-v2"],
  {
    tags: ["monitor-odds-fixture-by-fixture-id"],
    revalidate: EVENTS_SHARED_CACHE_TTL_SECONDS,
  },
);

const getCachedOddsFeedStatusFromDatabase = unstable_cache(
  getOddsFeedStatusFromDatabase,
  ["monitor-odds-feed-status-v2"],
  {
    tags: ["monitor-odds-feed-status"],
    revalidate: 5,
  },
);

const getCachedOddsSnapshotsByFixtureIds = unstable_cache(
  async (fixtureIds: string[], oddsVersion = "unknown") => {
    void oddsVersion;
    return fetchOddsSnapshotsByFixtureIds(fixtureIds);
  },
  ["monitor-odds-snapshots-by-fixture-ids-v4"],
  {
    tags: ["monitor-odds-snapshots"],
    revalidate: ODDS_SNAPSHOT_CACHE_TTL_SECONDS,
  },
);

const getCachedAvailableFreebetConsultationBookmakers = unstable_cache(
  async (fixturesVersion = "unknown", oddsVersion = "unknown") => {
    const events = await listAvailableOddsEvents(
      DEFAULT_DATE_RANGE_EVENT_LIMIT,
      fixturesVersion,
    );
    const snapshotsResult = await getOddsSnapshotsByFixtureIds(
      events.map((event) => event.fixture_id),
      oddsVersion,
    );
    const bookmakers = new Map<string, string>();

    for (const snapshot of snapshotsResult.snapshots) {
      for (const odd of snapshot.odds) {
        if (!shouldExposeFreebetConsultationBookmaker(odd)) {
          continue;
        }

        const name = formatDuploBookmakerName(odd.bookmaker_name);
        const key =
          normalizeBookmakerOptionKey(name) ||
          normalizeBookmakerOptionKey(odd.bookmaker_slug);

        if (key && !bookmakers.has(key)) {
          bookmakers.set(key, name);
        }
      }
    }

    return Array.from(bookmakers.values()).sort((left, right) =>
      left.localeCompare(right, "pt-BR"),
    );
  },
  ["monitor-odds-freebet-consultation-bookmakers-v1"],
  {
    tags: ["monitor-odds-freebet-consultation-bookmakers"],
    revalidate: EVENTS_SHARED_CACHE_TTL_SECONDS,
  },
);

export async function searchOddsEvents(
  search: string,
  limit = DEFAULT_EVENT_LIMIT,
  fixturesVersion?: string | null,
) {
  const term = sanitizeSearchTerm(search);

  if (term.length < 2) {
    return [];
  }

  const eventLimit = normalizeLimit(limit);
  const version = cleanCachePart(getFixturesCacheVersion(fixturesVersion));

  return getCachedOddsEventSearch(term, eventLimit, version);
}

export async function listOddsEventsByDateRange(
  from: string,
  to: string,
  limit = DEFAULT_DATE_RANGE_EVENT_LIMIT,
  fixturesVersion?: string | null,
) {
  const dateRange = normalizeDateRange(from, to);

  if (!dateRange) {
    return [];
  }

  const eventLimit = normalizeDateRangeLimit(limit);
  const version = cleanCachePart(getFixturesCacheVersion(fixturesVersion));

  return getCachedOddsEventsByDateRange(
    dateRange.from,
    dateRange.to,
    eventLimit,
    version,
  );
}

export async function listAvailableOddsEvents(
  limit = DEFAULT_DATE_RANGE_EVENT_LIMIT,
  fixturesVersion?: string | null,
) {
  const eventLimit = normalizeDateRangeLimit(limit);
  const version = cleanCachePart(getFixturesCacheVersion(fixturesVersion));

  return getCachedAvailableOddsEvents(eventLimit, version);
}

export async function getOddsSnapshotsByFixtureIds(
  fixtureIds: string[],
  oddsVersion?: string | null,
) {
  const safeFixtureIds = getSafeFixtureIds(fixtureIds);

  if (!safeFixtureIds.length) {
    return {
      complete: true,
      snapshots: [],
    } satisfies MonitorOddsSnapshotsResult;
  }

  const version = cleanCachePart(oddsVersion ?? "unknown");
  const snapshots = await getCachedOddsSnapshotsByFixtureIds(
    safeFixtureIds,
    version,
  );
  const snapshotsByFixtureId = new Map(
    snapshots.map((snapshot) => [snapshot.fixture_id, snapshot]),
  );

  return {
    complete: true,
    snapshots: safeFixtureIds.map(
      (fixtureId) =>
        snapshotsByFixtureId.get(fixtureId) ?? emptyOddsSnapshot(fixtureId),
    ),
  } satisfies MonitorOddsSnapshotsResult;
}

export async function listAvailableFreebetConsultationBookmakers() {
  const status = await getOddsFeedStatus();
  const fixturesVersion = getFixturesCacheVersion(status.fixtures_version);
  const oddsVersion =
    status.odds_version ?? status.latest_odd_updated_at ?? "unknown";

  return getCachedAvailableFreebetConsultationBookmakers(
    fixturesVersion,
    oddsVersion,
  );
}

export async function getOddsEventByFixtureId(fixtureId: string) {
  const safeFixtureId = cleanString(fixtureId).slice(0, 160);

  if (!safeFixtureId) {
    return null;
  }

  const status = await getOddsFeedStatus();
  const cachedFixture = await getCachedOddsFixtureByFixtureId(
    safeFixtureId,
    getFixturesCacheVersion(status.fixtures_version),
  );
  const fixture =
    cachedFixture ??
    (await getOddsFixtureByFixtureIdUncached(safeFixtureId, "fresh"));

  if (!fixture) {
    return null;
  }

  const snapshotsResult = await getOddsSnapshotsByFixtureIds(
    [fixture.fixture_id],
    status.odds_version ?? status.latest_odd_updated_at ?? "unknown",
  );

  return mergeEventWithSnapshot(fixture, snapshotsResult.snapshots[0]);
}

export async function getOddsFeedStatus() {
  return getCachedOddsFeedStatusFromDatabase();
}
