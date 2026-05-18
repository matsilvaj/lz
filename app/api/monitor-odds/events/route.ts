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
  const eventsPromise =
    from && to ? listOddsEventsByDateRange(from, to) : searchOddsEvents(query);
  const [events, status] = await Promise.all([
    eventsPromise,
    getOddsFeedStatus(),
  ]);

  return Response.json(
    {
      events,
      latest_odd_updated_at: status.latest_odd_updated_at,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
