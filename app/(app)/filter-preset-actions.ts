"use server";

import { requireWorkspaceContext } from "@/lib/auth/workspace-context";
import { normalizeText } from "@/lib/security/input";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { getProceduresRepository } from "@/lib/server";

const FILTER_PRESET_SCREENS = new Set([
  "monitor-odds",
  "monitor-duplo",
  "monitor-converter-freebet",
  "monitor-semanal-bet365",
]);
const MAX_PRESET_SIZE = 4_000;

function parseScreen(screen: string) {
  const normalized = normalizeText(screen, 60);

  if (!FILTER_PRESET_SCREENS.has(normalized)) {
    throw new Error("Tela inválida para filtro padrão.");
  }

  return normalized;
}

export async function getFilterPresetAction(screen: string) {
  const { user } = await requireWorkspaceContext();
  const repository = getProceduresRepository();
  const preset = await repository.getFilterPreset(user.id, parseScreen(screen));

  return preset && typeof preset === "object" ? (preset as Record<string, unknown>) : null;
}

export async function saveFilterPresetAction(
  screen: string,
  filters: Record<string, unknown>,
) {
  const { user } = await requireWorkspaceContext();
  const canWrite = await consumeRateLimit({
    identity: user.id,
    key: "filter-presets:write",
    limit: 40,
    windowMs: 60_000,
  });

  if (!canWrite) {
    throw new Error("Muitas tentativas. Aguarde um pouco.");
  }

  const payload = filters && typeof filters === "object" ? filters : {};

  if (JSON.stringify(payload).length > MAX_PRESET_SIZE) {
    throw new Error("Filtro muito grande para ser salvo.");
  }

  const repository = getProceduresRepository();
  await repository.saveFilterPreset(user.id, parseScreen(screen), payload);
}

export async function deleteFilterPresetAction(screen: string) {
  const { user } = await requireWorkspaceContext();
  const repository = getProceduresRepository();
  await repository.deleteFilterPreset(user.id, parseScreen(screen));
}
