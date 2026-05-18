import "server-only";

import { unstable_cache } from "next/cache";

import { getMonitorSupabaseClient } from "./client";

const ODDS_FEED_COLUMNS = [
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
  "bookmaker_slug",
  "bookmaker_name",
  "bookmaker_event_url",
  "market_code",
  "market_name",
  "selection",
  "price",
  "pa_category",
  "confidence_score",
  "odd_updated_at",
].join(",");

const SEARCH_PAGE_SIZE = 500;
const MAX_SEARCH_PAGES = 3;
const DEFAULT_EVENT_LIMIT = 20;
const DATE_RANGE_PAGE_SIZE = 1000;
const MAX_DATE_RANGE_PAGES = 8;
const DEFAULT_DATE_RANGE_EVENT_LIMIT = 150;
const MAX_DATE_RANGE_DAYS = 3;

export type MonitorOddsFeedItem = {
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

export type MonitorOddsFeedStatus = {
  latest_odd_updated_at: string | null;
  upcoming_fixture_count: number;
  odd_count: number;
};

type RawOddsFeedItem = Partial<Record<keyof MonitorOddsFeedItem, unknown>>;
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

function cleanOddsFeedItem(row: RawOddsFeedItem): MonitorOddsFeedItem | null {
  const fixtureId = cleanString(row.fixture_id);
  const fixtureName = cleanString(row.fixture_name);
  const homeTeam = cleanString(row.home_team);
  const awayTeam = cleanString(row.away_team);
  const startsAt = cleanString(row.starts_at);
  const leagueName = cleanString(row.league_name);
  const leagueSlug = cleanString(row.league_slug);
  const bookmakerSlug = cleanString(row.bookmaker_slug);
  const bookmakerName = cleanString(row.bookmaker_name);
  const marketCode = cleanString(row.market_code);
  const marketName = cleanString(row.market_name);
  const selection = cleanString(row.selection);
  const price = cleanNumber(row.price);
  const paCategory = cleanString(row.pa_category);

  if (
    !fixtureId ||
    !fixtureName ||
    !homeTeam ||
    !awayTeam ||
    !startsAt ||
    !leagueName ||
    !leagueSlug ||
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

function cleanOddsFeedStatus(row: RawOddsFeedStatus | null): MonitorOddsFeedStatus {
  return {
    latest_odd_updated_at: cleanOptionalString(row?.latest_odd_updated_at),
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

function updateEventFromOdd(
  events: Map<
    string,
    MonitorOddsEvent & {
      bookmakerSlugs: Set<string>;
    }
  >,
  odd: MonitorOddsFeedItem,
) {
  const current =
    events.get(odd.fixture_id) ??
    ({
      fixture_id: odd.fixture_id,
      api_football_fixture_id: odd.api_football_fixture_id,
      fixture_name: odd.fixture_name,
      home_team: odd.home_team,
      away_team: odd.away_team,
      starts_at: odd.starts_at,
      status: odd.status,
      round: odd.round,
      league_name: odd.league_name,
      league_slug: odd.league_slug,
      league_country: odd.league_country,
      league_logo_url: odd.league_logo_url,
      league_country_flag_url: odd.league_country_flag_url,
      bookmaker_count: 0,
      odd_count: 0,
      latest_odd_updated_at: null,
      odds: [],
      bookmakerSlugs: new Set<string>(),
    } satisfies MonitorOddsEvent & { bookmakerSlugs: Set<string> });

  current.odd_count += 1;
  current.odds.push(odd);
  current.bookmakerSlugs.add(odd.bookmaker_slug);
  current.bookmaker_count = current.bookmakerSlugs.size;

  if (
    odd.odd_updated_at &&
    (!current.latest_odd_updated_at ||
      new Date(odd.odd_updated_at).getTime() >
        new Date(current.latest_odd_updated_at).getTime())
  ) {
    current.latest_odd_updated_at = odd.odd_updated_at;
  }

  current.league_logo_url = current.league_logo_url ?? odd.league_logo_url;
  current.league_country_flag_url =
    current.league_country_flag_url ?? odd.league_country_flag_url;

  events.set(odd.fixture_id, current);
}

function stripInternalEventState(
  event: MonitorOddsEvent & { bookmakerSlugs: Set<string> },
): MonitorOddsEvent {
  return {
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
    bookmaker_count: event.bookmaker_count,
    odd_count: event.odd_count,
    latest_odd_updated_at: event.latest_odd_updated_at,
    odds: event.odds.sort((left, right) => {
      const marketOrder = left.market_code.localeCompare(right.market_code);
      if (marketOrder !== 0) return marketOrder;

      const categoryOrder = left.pa_category.localeCompare(right.pa_category);
      if (categoryOrder !== 0) return categoryOrder;

      const bookmakerOrder = left.bookmaker_name.localeCompare(right.bookmaker_name);
      if (bookmakerOrder !== 0) return bookmakerOrder;

      return left.selection.localeCompare(right.selection);
    }),
  };
}

async function searchOddsEventsUncached(search: string, limit = DEFAULT_EVENT_LIMIT) {
  const term = sanitizeSearchTerm(search);
  const eventLimit = normalizeLimit(limit);

  if (term.length < 2) {
    return [];
  }

  const supabase = getMonitorSupabaseClient();
  const events = new Map<string, MonitorOddsEvent & { bookmakerSlugs: Set<string> }>();
  const filter = [
    `fixture_name.ilike.%${term}%`,
    `home_team.ilike.%${term}%`,
    `away_team.ilike.%${term}%`,
    `league_name.ilike.%${term}%`,
  ].join(",");

  for (let page = 0; page < MAX_SEARCH_PAGES; page += 1) {
    const offset = page * SEARCH_PAGE_SIZE;
    const { data, error } = await supabase
      .from("public_odds_feed")
      .select(ODDS_FEED_COLUMNS)
      .or(filter)
      .order("starts_at", { ascending: true })
      .order("fixture_name", { ascending: true })
      .order("bookmaker_name", { ascending: true })
      .range(offset, offset + SEARCH_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    for (const row of (data ?? []) as RawOddsFeedItem[]) {
      const odd = cleanOddsFeedItem(row);
      if (odd) {
        updateEventFromOdd(events, odd);
      }
    }

    if (!data || data.length < SEARCH_PAGE_SIZE) {
      break;
    }
  }

  return Array.from(events.values()).map(stripInternalEventState).slice(0, eventLimit);
}

async function listOddsEventsByDateRangeUncached(
  from: string,
  to: string,
  limit = DEFAULT_DATE_RANGE_EVENT_LIMIT,
) {
  const dateRange = normalizeDateRange(from, to);
  const eventLimit = normalizeDateRangeLimit(limit);

  if (!dateRange) {
    return [];
  }

  const supabase = getMonitorSupabaseClient();
  const events = new Map<string, MonitorOddsEvent & { bookmakerSlugs: Set<string> }>();

  for (let page = 0; page < MAX_DATE_RANGE_PAGES; page += 1) {
    const offset = page * DATE_RANGE_PAGE_SIZE;
    const { data, error } = await supabase
      .from("public_odds_feed")
      .select(ODDS_FEED_COLUMNS)
      .gte("starts_at", dateRange.from)
      .lt("starts_at", dateRange.to)
      .order("league_name", { ascending: true })
      .order("starts_at", { ascending: true })
      .order("fixture_name", { ascending: true })
      .order("bookmaker_name", { ascending: true })
      .range(offset, offset + DATE_RANGE_PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    for (const row of (data ?? []) as RawOddsFeedItem[]) {
      const odd = cleanOddsFeedItem(row);
      if (odd) {
        updateEventFromOdd(events, odd);
      }
    }

    if (!data || data.length < DATE_RANGE_PAGE_SIZE) {
      break;
    }
  }

  return Array.from(events.values()).map(stripInternalEventState).slice(0, eventLimit);
}

async function getOddsFeedStatusUncached() {
  const supabase = getMonitorSupabaseClient();
  const { data, error } = await supabase
    .from("public_odds_feed_status")
    .select("latest_odd_updated_at,upcoming_fixture_count,odd_count")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return cleanOddsFeedStatus(data as RawOddsFeedStatus | null);
}

const getCachedOddsEventSearch = unstable_cache(
  searchOddsEventsUncached,
  ["monitor-odds-event-search"],
  {
    tags: ["monitor-odds-event-search"],
    revalidate: 20,
  },
);

const getCachedOddsFeedStatus = unstable_cache(
  getOddsFeedStatusUncached,
  ["monitor-odds-feed-status"],
  {
    tags: ["monitor-odds-feed-status"],
    revalidate: 15,
  },
);

const getCachedOddsEventsByDateRange = unstable_cache(
  listOddsEventsByDateRangeUncached,
  ["monitor-odds-events-by-date-range"],
  {
    tags: ["monitor-odds-events-by-date-range"],
    revalidate: 20,
  },
);

export async function searchOddsEvents(search: string, limit = DEFAULT_EVENT_LIMIT) {
  return getCachedOddsEventSearch(search, limit);
}

export async function listOddsEventsByDateRange(
  from: string,
  to: string,
  limit = DEFAULT_DATE_RANGE_EVENT_LIMIT,
) {
  return getCachedOddsEventsByDateRange(from, to, limit);
}

export async function getOddsFeedStatus() {
  return getCachedOddsFeedStatus();
}
