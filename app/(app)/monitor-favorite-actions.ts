"use server";

import { requireWorkspaceContext } from "@/lib/auth/workspace-context";
import { normalizeText } from "@/lib/security/input";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { getProceduresRepository } from "@/lib/server";

export type MonitorFavoriteType = "jogo" | "campeonato";

export async function getMonitorFavoritesAction() {
  const { user } = await requireWorkspaceContext();
  const repository = getProceduresRepository();
  const favorites = (await repository.listMonitorFavorites(user.id)) as Array<{
    key: string;
    type: MonitorFavoriteType;
  }>;

  return {
    games: favorites.filter((item) => item.type === "jogo").map((item) => item.key),
    leagues: favorites
      .filter((item) => item.type === "campeonato")
      .map((item) => item.key),
  };
}

export async function setMonitorFavoriteAction(
  type: MonitorFavoriteType,
  key: string,
  favorite: boolean,
) {
  const { user } = await requireWorkspaceContext();
  const canWrite = await consumeRateLimit({
    identity: user.id,
    key: "monitor-favorites:write",
    limit: 120,
    windowMs: 60_000,
  });

  if (!canWrite) {
    throw new Error("Muitas tentativas. Aguarde um pouco.");
  }

  const normalizedKey = normalizeText(key, 200);

  if (!normalizedKey || (type !== "jogo" && type !== "campeonato")) {
    throw new Error("Favorito inválido.");
  }

  const repository = getProceduresRepository();
  await repository.setMonitorFavorite(user.id, type, normalizedKey, Boolean(favorite));
}
