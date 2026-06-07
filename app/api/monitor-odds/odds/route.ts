import { type NextRequest } from "next/server";

import {
  getOddsFeedStatus,
  getOddsSnapshotsByFixtureIds,
} from "@/lib/monitor-odds/odds-data";
import { normalizeText } from "@/lib/security/input";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type OddsRequestBody = {
  fixtureIds?: unknown;
  oddsVersion?: unknown;
};

function parseFixtureIds(value: unknown) {
  if (!value) {
    return [];
  }

  const values = Array.isArray(value) ? value : String(value).split(",");

  return values
    .map((fixtureId) => normalizeText(String(fixtureId), 160))
    .filter((fixtureId) => /^[\w:-]{1,160}$/u.test(fixtureId))
    .filter(Boolean)
    .slice(0, 100);
}

function parseOddsVersion(value: unknown) {
  const normalized =
    typeof value === "string" ? normalizeText(value, 160) : "";
  return normalized ? normalized : null;
}

async function authorizeOddsRequest() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      response: Response.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  const canPoll = await consumeRateLimit({
    distributed: false,
    identity: user.id,
    key: "monitor-odds:odds",
    limit: 90,
    windowMs: 60_000,
  });

  if (!canPoll) {
    return {
      response: Response.json({ error: "rate_limited" }, { status: 429 }),
    };
  }

  return {
    response: null,
  };
}

async function buildOddsResponse(
  fixtureIdsInput: unknown,
  requestedOddsVersionInput: unknown,
) {
  const fixtureIds = parseFixtureIds(fixtureIdsInput);
  const requestedOddsVersion = parseOddsVersion(requestedOddsVersionInput);
  const status = requestedOddsVersion ? null : await getOddsFeedStatus();
  const oddsVersion =
    requestedOddsVersion ??
    status?.odds_version ??
    status?.latest_odd_updated_at ??
    "unknown";
  const snapshotsResult = await getOddsSnapshotsByFixtureIds(fixtureIds, oddsVersion);

  return Response.json(
    {
      complete: snapshotsResult.complete,
      odds_version:
        oddsVersion === "unknown" || !snapshotsResult.complete ? null : oddsVersion,
      snapshots: snapshotsResult.snapshots,
      stale: !snapshotsResult.complete,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function GET(request: NextRequest) {
  const authorization = await authorizeOddsRequest();

  if (authorization.response) {
    return authorization.response;
  }

  return buildOddsResponse(
    request.nextUrl.searchParams.get("fixtureIds"),
    request.nextUrl.searchParams.get("oddsVersion"),
  );
}

export async function POST(request: NextRequest) {
  const authorization = await authorizeOddsRequest();

  if (authorization.response) {
    return authorization.response;
  }

  let body: OddsRequestBody;

  try {
    body = (await request.json()) as OddsRequestBody;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  return buildOddsResponse(body.fixtureIds, body.oddsVersion);
}
