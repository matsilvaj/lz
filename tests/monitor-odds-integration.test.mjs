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
const oddsUi = readFileSync(
  new URL("../app/(app)/odds/odds-event-search.tsx", import.meta.url),
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

test("monitor odds fixtures cache does not fall back to odds updates", () => {
  assert.match(eventsRoute, /const fixturesVersion = status\.fixtures_version;/);
  assert.doesNotMatch(
    eventsRoute,
    /fixturesVersion\s*=\s*[^;]*latest_odd_updated_at/,
  );
  assert.doesNotMatch(
    eventsRoute,
    /status\.fixtures_version\s*\?\?\s*status\.latest_odd_updated_at/,
  );
  assert.match(oddsRepository, /UNVERSIONED_FIXTURES_VERSION/);
  assert.match(oddsRepository, /EVENTS_UNVERSIONED_SHARED_CACHE_TTL_SECONDS/);
});

test("monitor odds snapshots guard against cache stampedes", () => {
  assert.match(oddsRepository, /getOddsSnapshotLockKey/);
  assert.match(oddsRepository, /ODDS_SNAPSHOT_LOCK_RETRY_ATTEMPTS/);
  assert.match(oddsRepository, /acquireMonitorOddsLock\(/);
  assert.match(oddsRepository, /readCachedOddsSnapshots/);
  assert.match(oddsRepository, /complete: false/);
  assert.match(oddsRepository, /staleByFixtureId/);
});

test("monitor odds snapshot route supports POST bodies", () => {
  assert.match(oddsRoute, /export async function POST/);
  assert.match(oddsRoute, /await request\.json\(\)/);
  assert.match(oddsRoute, /buildOddsResponse\(body\.fixtureIds, body\.oddsVersion\)/);
  assert.match(oddsRoute, /complete: snapshotsResult\.complete/);
  assert.match(oddsRoute, /stale: !snapshotsResult\.complete/);
});

test("monitor odds UI refreshes snapshots without URL-sized fixture queries", () => {
  assert.match(oddsUi, /fetch\("\/api\/monitor-odds\/odds"/);
  assert.match(oddsUi, /method: "POST"/);
  assert.match(oddsUi, /fixtureIds: events\.map/);
  assert.match(oddsUi, /useMonitorOddsStatusFeed/);
  assert.match(oddsUi, /function OddsEventDetails/);
  assert.match(oddsUi, /payload\.complete !== false/);
});

test("monitor odds UI keeps retrying incomplete odds versions", () => {
  assert.match(oddsUi, /oddsVersion: isComplete \? payload\.odds_version \?\? oddsVersion : null/);
  assert.match(oddsUi, /if \(result\.oddsVersion\) \{/);
  assert.doesNotMatch(
    oddsUi,
    /latestOddsVersionRef\.current = result\.oddsVersion \?\? nextOddsVersion/,
  );
  assert.doesNotMatch(
    oddsUi,
    /latestOddUpdatedAtRef\.current =\s*payload\.latest_odd_updated_at \?\? result\.oddsVersion \?\? nextOddsVersion/,
  );
});

test("monitor odds snapshots are versioned by fixture freshness", () => {
  assert.match(oddsRepository, /ODDS_SNAPSHOT_HEAD_COLUMNS/);
  assert.match(oddsRepository, /fetchOddsSnapshotHeadsByFixtureIds/);
  assert.match(oddsRepository, /monitor-odds:odds:v3:latest/);
  assert.doesNotMatch(
    oddsRepository,
    /getOddsSnapshotCacheKey\(fixtureId: string, oddsVersion: string\)/,
  );
});

test("monitor odds snapshot heads use a short shared cache", () => {
  assert.match(oddsRepository, /ODDS_SNAPSHOT_HEAD_SHARED_CACHE_TTL_SECONDS = 3/);
  assert.match(oddsRepository, /getOddsSnapshotHeadCacheKey/);
  assert.match(oddsRepository, /monitor-odds:odds-head:v2/);
  assert.match(oddsRepository, /readCachedOddsSnapshotHeads/);
  assert.match(oddsRepository, /fetchOddsSnapshotHeadsFromDatabase/);
  assert.match(
    oddsRepository,
    /ODDS_SNAPSHOT_HEAD_SHARED_CACHE_TTL_SECONDS/,
  );
});

test("monitor odds snapshot head cache is scoped by odds version", () => {
  assert.match(
    oddsRepository,
    /getOddsSnapshotHeadCacheKey\(\s*fixtureId: string,\s*oddsVersion: string \| null \| undefined,/,
  );
  assert.match(
    oddsRepository,
    /getOddsSnapshotHeadCacheKey\(fixtureId, oddsVersion\)/,
  );
  assert.match(
    oddsRepository,
    /getOddsSnapshotHeadCacheKey\(head\.fixture_id, oddsVersion\)/,
  );
  assert.match(
    oddsRepository,
    /fetchOddsSnapshotHeadsByFixtureIds\(\s*safeFixtureIds,\s*oddsVersion,\s*\)/,
  );
  assert.doesNotMatch(oddsRepository, /void oddsVersion;/);
});
