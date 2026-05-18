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

test("monitor odds repository reads only public monitor views", () => {
  const forbiddenTables = [
    "collection_logs",
    "bookmaker_payload_cache",
    "bookmaker_event_snapshots",
    "bookmaker_collection_state",
    "bookmaker_event_links",
    "bookmaker_league_links",
  ];

  assert.match(oddsRepository, /\.from\("public_odds_feed"\)/);
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
});

test("monitor odds search has bounded pagination", () => {
  assert.match(oddsRepository, /const MAX_SEARCH_PAGES = \d+;/);
  assert.match(oddsRepository, /page < MAX_SEARCH_PAGES/);
});

test("monitor odds date range listing is bounded and filtered by start time", () => {
  assert.match(oddsRepository, /const MAX_DATE_RANGE_PAGES = \d+;/);
  assert.match(oddsRepository, /page < MAX_DATE_RANGE_PAGES/);
  assert.match(oddsRepository, /\.gte\("starts_at", dateRange\.from\)/);
  assert.match(oddsRepository, /\.lt\("starts_at", dateRange\.to\)/);
  assert.match(eventsRoute, /listOddsEventsByDateRange\(from, to\)/);
});
