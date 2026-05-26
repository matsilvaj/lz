import { type NextRequest } from "next/server";

import {
  getOddsFeedStatus,
  getOddsSnapshotsByFixtureIds,
} from "@/lib/monitor-odds/odds-data";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function parseFixtureIds(value: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((fixtureId) => fixtureId.trim())
    .filter(Boolean)
    .slice(0, 200);
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const canPoll = await consumeRateLimit({
    identity: user.id,
    key: "monitor-odds:odds",
    limit: 90,
    windowMs: 60_000,
  });

  if (!canPoll) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const fixtureIds = parseFixtureIds(request.nextUrl.searchParams.get("fixtureIds"));
  const requestedOddsVersion = request.nextUrl.searchParams.get("oddsVersion");
  const status = requestedOddsVersion ? null : await getOddsFeedStatus();
  const oddsVersion =
    requestedOddsVersion ??
    status?.odds_version ??
    status?.latest_odd_updated_at ??
    "unknown";
  const snapshots = await getOddsSnapshotsByFixtureIds(fixtureIds, oddsVersion);

  return Response.json(
    {
      odds_version: oddsVersion === "unknown" ? null : oddsVersion,
      snapshots,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
