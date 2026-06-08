import { authorizeActiveApiUser } from "@/lib/auth/session";
import { getOddsFeedStatus } from "@/lib/monitor-odds/odds-data";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  const authorization = await authorizeActiveApiUser();

  if (authorization.response) {
    return authorization.response;
  }

  const canPoll = await consumeRateLimit({
    distributed: false,
    identity: authorization.user.id,
    key: "monitor-odds:status",
    limit: 30,
    windowMs: 60_000,
  });

  if (!canPoll) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const status = await getOddsFeedStatus();

  return Response.json(status, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
