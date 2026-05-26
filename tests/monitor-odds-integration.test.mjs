import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const oddsRepository = readFileSync(
  new URL("../lib/monitor-odds/odds-data.ts", import.meta.url),
  "utf8",
);
const monitorClient = readFileSync(
  new URL("../lib/monitor-odds/client.ts", import.meta.url),
  "utf8",
);
const eventsRoute = readFileSync(
  new URL("../app/api/monitor-odds/events/route.ts", import.meta.url),
  "utf8",
);
const statusRoute = readFileSync(
  new URL("../app/api/monitor-odds/status/route.ts", import.meta.url),
  "utf8",
);
const oddsRoute = readFileSync(
  new URL("../app/api/monitor-odds/odds/route.ts", import.meta.url),
  "utf8",
);

test("monitor odds repository reads only public monitor views", () => {
  const forbiddenTables = [
    "collection_logs",
    "bookmaker_payload_cache",
    "bookmaker_event_snapshots",
    "bookmaker_collection_state",
    "bookmaker_event_links",
    "bookmaker_league_links",
  ];

  assert.match(oddsRepository, /\.from\("public_odds_fixtures"\)/);
  assert.match(oddsRepository, /\.from\("public_odds_snapshot"\)/);
  assert.doesNotMatch(oddsRepository, /\.from\("public_odds_feed"\)/);
  assert.doesNotMatch(oddsRepository, /public_odds_feed_compact/);
  assert.match(oddsRepository, /\.from\("public_odds_feed_status"\)/);

  for (const table of forbiddenTables) {
    assert.equal(oddsRepository.includes(table), false, `${table} must not be queried`);
  }
});

test("monitor odds client uses server-only env names", () => {
  assert.match(monitorClient, /MONITOR_SUPABASE_URL/);
  assert.match(monitorClient, /MONITOR_SUPABASE_PUBLISHABLE_KEY/);
  assert.equal(monitorClient.includes("NEXT_PUBLIC"), false);
  assert.equal(monitorClient.includes("SERVICE_ROLE"), false);
});

test("monitor odds routes are rate limited", () => {
  assert.match(eventsRoute, /consumeRateLimit/);
  assert.match(eventsRoute, /monitor-odds:events/);
  assert.match(statusRoute, /consumeRateLimit/);
  assert.match(statusRoute, /monitor-odds:status/);
  assert.match(oddsRoute, /consumeRateLimit/);
  assert.match(oddsRoute, /monitor-odds:odds/);
});

test("monitor odds search has bounded pagination", () => {
  assert.match(oddsRepository, /const MAX_SEARCH_PAGES = \d+;/);
  assert.match(oddsRepository, /page < MAX_SEARCH_PAGES/);
  assert.match(oddsRepository, /events\.length >= eventLimit/);
});

test("monitor odds repository expands grouped snapshot odds safely", () => {
  assert.match(oddsRepository, /ODDS_SNAPSHOT_COLUMNS/);
  assert.match(oddsRepository, /Array\.isArray\(row\.odds\)/);
  assert.match(oddsRepository, /expandOddsSnapshotRow/);
});

test("monitor odds feed exposes safe bookmaker event urls", () => {
  assert.match(oddsRepository, /bookmaker_event_url/);
  assert.match(oddsRepository, /cleanExternalUrl\(row\.bookmaker_event_url\)/);
  assert.match(oddsRepository, /url\.protocol === "https:"/);
});

test("monitor odds date range listing is bounded and filtered by start time", () => {
  assert.match(oddsRepository, /const MAX_DATE_RANGE_PAGES = \d+;/);
  assert.match(oddsRepository, /page < MAX_DATE_RANGE_PAGES/);
  assert.match(oddsRepository, /\.gte\("starts_at", dateRange\.from\)/);
  assert.match(oddsRepository, /\.lt\("starts_at", dateRange\.to\)/);
  assert.match(eventsRoute, /listOddsEventsByDateRange\(from, to, undefined, fixturesVersion\)/);
});
