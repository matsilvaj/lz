import { type NextRequest } from "next/server";

import {
  getOddsFeedStatus,
  listOddsEventsByDateRange,
  searchOddsEvents,
} from "@/lib/monitor-odds/odds-data";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const canSearch = await consumeRateLimit({
    identity: user.id,
    key: "monitor-odds:events",
    limit: 60,
    windowMs: 60_000,
  });

  if (!canSearch) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const query = request.nextUrl.searchParams.get("q") ?? "";
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  const status = await getOddsFeedStatus();
  const fixturesVersion =
    status.fixtures_version ?? status.latest_odd_updated_at ?? "unknown";
  const events =
    from && to
      ? await listOddsEventsByDateRange(from, to, undefined, fixturesVersion)
      : await searchOddsEvents(query, undefined, fixturesVersion);

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
