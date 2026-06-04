import { type NextRequest } from "next/server";

import { requireWorkspaceContext } from "@/lib/auth/workspace-context";
import { getDashboardData } from "@/lib/server/app-data";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { activeWorkspace, user } = await requireWorkspaceContext();
  const period = request.nextUrl.searchParams.get("period") ?? "";
  const data = await getDashboardData(user.id, activeWorkspace.id, period);

  return Response.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
