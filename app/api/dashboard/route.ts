import { type NextRequest } from "next/server";

import { requireWorkspaceContext } from "@/lib/auth/workspace-context";
import { getDashboardData } from "@/lib/server/app-data";
import { normalizeText } from "@/lib/security/input";

export const dynamic = "force-dynamic";

function normalizeDashboardPeriod(value: string | null) {
  const period = normalizeText(value, 80);

  if (
    !period ||
    period === "all" ||
    /^days:7$/u.test(period) ||
    /^month:\d{2}\/\d{4}$/u.test(period) ||
    /^year:\d{4}$/u.test(period) ||
    /^day:\d{4}-\d{2}-\d{2}$/u.test(period) ||
    /^range:\d{4}-\d{2}-\d{2}:\d{4}-\d{2}-\d{2}$/u.test(period)
  ) {
    return period;
  }

  return "";
}

function describeDashboardError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message.split("\n")[0] || "Dashboard data error",
    };
  }

  return {
    name: "UnknownError",
    message: String(error),
  };
}

export async function GET(request: NextRequest) {
  const { activeWorkspace, user } = await requireWorkspaceContext();
  const period = normalizeDashboardPeriod(request.nextUrl.searchParams.get("period"));

  let data;

  try {
    data = await getDashboardData(user.id, activeWorkspace.id, period);
  } catch (error) {
    console.error("Dashboard data request failed.", {
      error: describeDashboardError(error),
      period,
    });

    return Response.json(
      {
        error: "dashboard_unavailable",
        message: "Nao foi possivel carregar o dashboard agora.",
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
        status: 503,
      },
    );
  }

  return Response.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
