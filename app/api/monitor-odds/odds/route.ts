import { type NextRequest } from "next/server";

import {
  getOddsFeedStatus,
  getOddsSnapshotsByFixtureIds,
} from "@/lib/monitor-odds/odds-data";
import { authorizeActiveApiUser } from "@/lib/auth/session";
import { normalizeText } from "@/lib/security/input";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { readLimitedJson } from "@/lib/security/request";

export const dynamic = "force-dynamic";
const ODDS_REQUEST_MAX_BYTES = 32 * 1024;

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
  const authorization = await authorizeActiveApiUser();

  if (authorization.response) {
    return {
      response: authorization.response,
    };
  }

  const canPoll = await consumeRateLimit({
    distributed: false,
    identity: authorization.user.id,
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

  const bodyResult = await readLimitedJson<OddsRequestBody>(request, {
    maxBytes: ODDS_REQUEST_MAX_BYTES,
  });

  if (bodyResult.response) {
    return bodyResult.response;
  }

  return buildOddsResponse(bodyResult.data.fixtureIds, bodyResult.data.oddsVersion);
}
