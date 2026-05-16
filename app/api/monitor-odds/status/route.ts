import { getOddsFeedStatus } from "@/lib/monitor-odds/odds-data";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const canPoll = await consumeRateLimit({
    identity: user.id,
    key: "monitor-odds:status",
    limit: 12,
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
