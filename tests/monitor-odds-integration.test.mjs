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
const doubleMonitorUi = readFileSync(
  new URL("../app/(app)/monitor/duplo/double-monitor-workspace.tsx", import.meta.url),
  "utf8",
);
const calculatorSelectionDock = readFileSync(
  new URL("../app/_components/calculator-selection-dock.tsx", import.meta.url),
  "utf8",
);
const oddsDisplayNames = readFileSync(
  new URL("../lib/monitor-odds/display-names.ts", import.meta.url),
  "utf8",
);
const globalsCss = readFileSync(
  new URL("../app/globals.css", import.meta.url),
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
  assert.match(eventsRoute, /distributed: false/);
  assert.match(statusRoute, /consumeRateLimit/);
  assert.match(statusRoute, /monitor-odds:status/);
  assert.match(statusRoute, /distributed: false/);
  assert.match(oddsRoute, /consumeRateLimit/);
  assert.match(oddsRoute, /monitor-odds:odds/);
  assert.match(oddsRoute, /distributed: false/);
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

test("duplo monitor loads all available event days by default", () => {
  assert.match(oddsRepository, /listAvailableOddsEvents/);
  assert.match(eventsRoute, /listAvailableOddsEvents\(undefined, fixturesVersion\)/);
  assert.match(doubleMonitorUi, /kind: "available"/);
  assert.doesNotMatch(doubleMonitorUi, /activeDatePreset/);
});

test("duplo monitor filters and lists only PA signal classes", () => {
  assert.match(doubleMonitorUi, /paModeFilters/);
  assert.match(doubleMonitorUi, /isPaModeFilter/);
  assert.match(doubleMonitorUi, /createPortal\(/);
  assert.doesNotMatch(doubleMonitorUi, /sem_pa/);
  assert.doesNotMatch(doubleMonitorUi, /Sem PA/);
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

test("monitor odds hot path does not depend on Redis", () => {
  assert.doesNotMatch(oddsRepository, /shared-cache/);
  assert.doesNotMatch(oddsRepository, /getMonitorOddsRedisClient/);
  assert.doesNotMatch(oddsRepository, /readMonitorOddsCache/);
  assert.doesNotMatch(oddsRepository, /writeMonitorOddsCache/);
  assert.doesNotMatch(oddsRepository, /acquireMonitorOddsLock/);
  assert.match(oddsRepository, /getCachedOddsSnapshotsByFixtureIds/);
  assert.match(oddsRepository, /ODDS_SNAPSHOT_CACHE_TTL_SECONDS = 3/);
  assert.match(oddsRepository, /complete: true/);
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

test("monitor odds UI localizes international competitions and national teams", () => {
  assert.match(oddsDisplayNames, /"friendlies": "Amistoso Internacional"/);
  assert.match(oddsDisplayNames, /"world-cup": "Copa do Mundo"/);
  assert.match(oddsDisplayNames, /wales: "País de Gales"/);
  assert.match(oddsDisplayNames, /ghana: "Gana"/);
  assert.match(oddsDisplayNames, /"new-zealand": "Nova Zelândia"/);
  assert.match(oddsDisplayNames, /"south-korea": "Coreia do Sul"/);
  assert.match(oddsUi, /formatCompetitionName/);
  assert.match(oddsUi, /formatNationalTeamName/);
  assert.match(doubleMonitorUi, /formatCompetitionName/);
  assert.match(doubleMonitorUi, /formatNationalTeamName/);
});

test("monitor odds UI keeps retrying incomplete odds versions", () => {
  assert.match(oddsUi, /if \(!isComplete\) \{/);
  assert.match(oddsUi, /oddsVersion: null/);
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

test("monitor odds snapshots cache is scoped by odds version", () => {
  assert.match(oddsRepository, /getCachedOddsSnapshotsByFixtureIds/);
  assert.match(
    oddsRepository,
    /const version = cleanCachePart\(oddsVersion \?\? "unknown"\)/,
  );
  assert.match(
    oddsRepository,
    /getCachedOddsSnapshotsByFixtureIds\(\s*safeFixtureIds,\s*version,\s*\)/,
  );
});

test("monitor odds UI renders events before refreshing odds", () => {
  const renderIndex = oddsUi.indexOf(
    "refreshingOdds: Boolean(events.length && nextOddsVersion)",
  );
  const oddsRefreshIndex = oddsUi.indexOf(
    "const result = await fetchOddsForEvents(events, nextOddsVersion",
    renderIndex,
  );

  assert.notEqual(renderIndex, -1);
  assert.notEqual(oddsRefreshIndex, -1);
  assert.ok(renderIndex < oddsRefreshIndex);
});

test("monitor odds UI keeps remembered odds while a refresh is pending", () => {
  assert.match(oddsUi, /hydrateEventsWithRememberedOdds/);
  assert.match(oddsUi, /rememberOddsSnapshots/);
  assert.match(oddsUi, /preserveExistingOddsOnEmptySnapshot: true/);
  assert.doesNotMatch(oddsUi, /Atualizando odds/);
});

test("monitor odds detail shows the event odds update timestamp", () => {
  assert.match(oddsUi, /formatLastOddsUpdate/);
  assert.match(oddsUi, /currentEvent\.latest_odd_updated_at/);
  assert.match(oddsUi, /Odds atualizadas às/);
  assert.doesNotMatch(oddsUi, /Odds atualizadas em/);
});

test("monitor odds UI highlights actual odd price movement", () => {
  assert.match(oddsUi, /OddPricePulse/);
  assert.match(oddsUi, /price > previousPrice/);
  assert.match(oddsUi, /previousPulseIdRef/);
  assert.match(oddsUi, /previousPulseVersionRef/);
  assert.match(oddsUi, /pulseVersion === previousPulseVersion/);
  assert.match(oddsUi, /oddsPulseVersion: current\.oddsPulseVersion \+ 1/);
  assert.match(oddsUi, /pulseId={`table:\$\{row\.key\}:\$\{selection\}`}/);
  assert.match(globalsCss, /odds-price-move-up/);
  assert.match(globalsCss, /odds-price-move-down/);
});

test("monitor odds and duplo can send selected odds to calculator", () => {
  assert.match(calculatorSelectionDock, /encodeCalculatorPayload/);
  assert.match(calculatorSelectionDock, /new URL\("\/calculadora", window\.location\.origin\)/);
  assert.match(calculatorSelectionDock, /window\.open\(\s*calculatorUrl\.toString\(\)/);
  assert.match(calculatorSelectionDock, /calculatorWindow\.location\.href = calculatorUrl\.toString\(\)/);
  assert.match(calculatorSelectionDock, /"lz-calculadora"/);
  assert.match(calculatorSelectionDock, /slice\(-3\)/);
  assert.match(calculatorSelectionDock, /dockVisible/);
  assert.match(oddsUi, /CalculatorSelectionDock/);
  assert.match(oddsUi, /getOddCalculatorSelection/);
  assert.match(oddsUi, /getOpportunityCalculatorSelections/);
  assert.match(oddsUi, /replaceAll: true/);
  assert.match(doubleMonitorUi, /CalculatorSelectionDock/);
  assert.match(doubleMonitorUi, /getOpportunityCalculatorSelections/);
  assert.match(doubleMonitorUi, /replaceAll: true/);
  assert.match(doubleMonitorUi, /BookmakerEventLink/);
});

test("monitor duplo keeps remembered odds while refresh is pending", () => {
  assert.match(doubleMonitorUi, /getRememberedDuploEvents/);
  assert.match(doubleMonitorUi, /hydrateEventsWithRememberedOdds/);
  assert.match(doubleMonitorUi, /rememberDuploEvents/);
  assert.match(doubleMonitorUi, /showSignalSkeleton/);
  assert.match(doubleMonitorUi, /state\.refreshingOdds && !rows\.length/);
});
