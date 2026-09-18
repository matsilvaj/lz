"use server";

import { unstable_cache } from "next/cache";

import { requireWorkspaceContext } from "@/lib/auth/workspace-context";
import { getProceduresRepository } from "@/lib/server";

const TRENDING_FIXTURES_LIMIT = 10;

// Ranking igual para todos os usuários; recalculado a cada 5 minutos (10s em desenvolvimento, para testar).
const TRENDING_CACHE_SECONDS = process.env.NODE_ENV === "production" ? 5 * 60 : 10;
const getCachedTrendingFixtures = unstable_cache(
  async () =>
    (await getProceduresRepository().listTrendingMonitorFixtures(
      TRENDING_FIXTURES_LIMIT,
    )) as string[],
  ["monitor-trending-fixtures"],
  { revalidate: TRENDING_CACHE_SECONDS },
);

export async function getTrendingFixturesAction() {
  await requireWorkspaceContext();
  return getCachedTrendingFixtures();
}
