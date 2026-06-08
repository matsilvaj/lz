import { type NextRequest } from "next/server";

import {
  getOddsFeedStatus,
  listAvailableOddsEvents,
  listOddsEventsByDateRange,
  searchOddsEvents,
} from "@/lib/monitor-odds/odds-data";
import { authorizeActiveApiUser } from "@/lib/auth/session";
import { normalizeText } from "@/lib/security/input";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

function normalizeDateParam(value: string | null) {
  const normalized = normalizeText(value, 16);
  return /^\d{4}-\d{2}-\d{2}$/u.test(normalized) ? normalized : null;
}

export async function GET(request: NextRequest) {
  const authorization = await authorizeActiveApiUser();

  if (authorization.response) {
    return authorization.response;
  }

  const canSearch = await consumeRateLimit({
    distributed: false,
    identity: authorization.user.id,
    key: "monitor-odds:events",
    limit: 60,
    windowMs: 60_000,
  });

  if (!canSearch) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const query = normalizeText(request.nextUrl.searchParams.get("q"), 80);
  const from = normalizeDateParam(request.nextUrl.searchParams.get("from"));
  const to = normalizeDateParam(request.nextUrl.searchParams.get("to"));
  const status = await getOddsFeedStatus();
  const fixturesVersion = status.fixtures_version;
  const normalizedQuery = query.trim();
  const events =
    from && to
      ? await listOddsEventsByDateRange(from, to, undefined, fixturesVersion)
      : normalizedQuery.length >= 2
        ? await searchOddsEvents(normalizedQuery, undefined, fixturesVersion)
        : await listAvailableOddsEvents(undefined, fixturesVersion);

  return Response.json(
    {
      events,
      fixtures_version: status.fixtures_version,
      latest_odd_updated_at: status.latest_odd_updated_at,
      odds_version: status.odds_version,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
