"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import {
  FREEBET_RESULT_NO,
  FREEBET_RESULT_YES,
} from "@/core/domain/shared/constants.js";
import { buildProcedureData } from "@/core/domain/procedimentos/procedimentos.service.js";
import { getSafeAppPath } from "@/lib/auth/redirects";
import { requireWorkspaceContext } from "@/lib/auth/workspace-context";
import { getBookmakersCatalog } from "@/lib/server/app-data";
import {
  normalizeLongText,
  normalizeText,
  parseLimitedNumber,
  parsePositiveInteger,
} from "@/lib/security/input";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { appendToastParams } from "@/lib/ui/toast";
import { getProceduresRepository } from "@/lib/server";

function parseText(value: FormDataEntryValue | null) {
  return normalizeText(value, 180);
}

function parseNumber(value: FormDataEntryValue | null) {
  return parseLimitedNumber(value);
}

function parseBoolean(value: FormDataEntryValue | null) {
  return ["1", "true", "on", "yes", "sim"].includes(
    String(value ?? "").trim().toLowerCase(),
  );
}

function formatOperationDateInput(value: string) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function parseHouses(value: string) {
  return value
    .split(/[,|\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOriginIds(formData: FormData) {
  return formData
    .getAll("originIds")
    .map((value) => parsePositiveInteger(value))
    .filter((value) => value > 0)
    .slice(0, 20);
}

function parseProtections(formData: FormData) {
  return formData
    .getAll("protections")
    .map((value) => String(value).trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((value) => parseNumber(value));
}

async function normalizeBookmakerSelection(
  houses: string[],
  freebetHouse: string,
) {
  const availableBookmakers = (await getBookmakersCatalog()) as string[];
  const bookmakerMap = new Map(
    availableBookmakers.map((bookmaker) => [bookmaker.toLowerCase(), bookmaker]),
  );

  return {
    houses: houses
      .map((house) => bookmakerMap.get(house.toLowerCase()) ?? "")
      .filter(Boolean),
    freebetHouse: bookmakerMap.get(freebetHouse.toLowerCase()) ?? "",
  };
}

function getReturnTo(formData: FormData, fallback: string) {
  return getSafeAppPath(formData.get("returnTo"), fallback);
}

function revalidateApplication() {
  const paths = [
    "/dashboard",
    "/procedimentos",
    "/freebets",
    "/calculadora",
    "/bancas",
    "/historico",
  ];

  for (const path of paths) {
    revalidatePath(path);
  }

  for (const tag of [
    "dashboard-data",
    "freebets-page-data",
    "bookmakers-page-data",
    "history-page-data",
  ]) {
    updateTag(tag);
  }
}

export async function saveProcedureAction(formData: FormData) {
  const { activeWorkspace, user } = await requireWorkspaceContext();
  const repository = getProceduresRepository();
  const returnTo = getReturnTo(formData, "/procedimentos");
  const canWrite = await consumeRateLimit({
    identity: user.id,
    key: "procedures:write",
    limit: 80,
    windowMs: 60_000,
  });

  if (!canWrite) {
    redirect(appendToastParams(returnTo, "error", "Muitas tentativas. Aguarde um pouco."));
  }

  const procedureType = parseText(formData.get("procedureType")) || "SureBet";
  const parsedHouses = parseHouses(parseText(formData.get("houses")));
  const parsedFreebetHouse = parseText(formData.get("freebetHouse"));
  const originIds = parseOriginIds(formData);
  const { houses, freebetHouse } = await normalizeBookmakerSelection(
    parsedHouses,
    parsedFreebetHouse,
  );

  const payload = buildProcedureData({
    procedureType,
    entryValue: parseNumber(formData.get("entryValue")),
    game: parseText(formData.get("game")),
    houses: houses.join(", "),
    freebetCollectedValue: parseNumber(formData.get("doubleValue")),
    freebetValue: parseNumber(formData.get("freebetValue")),
    freebetCondition: parseText(formData.get("freebetCondition")),
    note: normalizeLongText(formData.get("note"), 2_000),
    freebetHouse,
    hitDouble: parseBoolean(formData.get("hitDouble")),
    equalProfit: parseBoolean(formData.get("equalProfit")),
    protections: parseProtections(formData) as number[],
    operationDate: formatOperationDateInput(parseText(formData.get("operationDate"))),
  });

  if (procedureType === "Converter Freebet" && originIds.length > 0) {
    await repository.saveFreebetConversion(payload, originIds, user.id, activeWorkspace.id);
  } else {
    await repository.saveProcedure(payload, user.id, activeWorkspace.id);
  }

  revalidateApplication();
  redirect(appendToastParams(returnTo, "success", "Procedimento salvo com sucesso."));
}

export async function updateProcedureAction(formData: FormData) {
  const { activeWorkspace, user } = await requireWorkspaceContext();
  const repository = getProceduresRepository();
  const returnTo = getReturnTo(formData, "/procedimentos");
  const canWrite = await consumeRateLimit({
    identity: user.id,
    key: "procedures:write",
    limit: 80,
    windowMs: 60_000,
  });
  const procedureId = parsePositiveInteger(formData.get("procedureId"));

  if (!canWrite) {
    redirect(appendToastParams(returnTo, "error", "Muitas tentativas. Aguarde um pouco."));
  }

  if (procedureId <= 0) {
    redirect(returnTo);
  }

  const current = await repository.getProcedureById(procedureId, user.id, activeWorkspace.id);
  if (!current) {
    redirect(returnTo);
  }

  const procedureType = parseText(formData.get("procedureType")) || parseText(current.tipo_procedimento);
  const parsedHouses = parseHouses(parseText(formData.get("houses")));
  const parsedFreebetHouse = parseText(formData.get("freebetHouse"));
  const { houses, freebetHouse } = await normalizeBookmakerSelection(
    parsedHouses,
    parsedFreebetHouse,
  );

  const payload = buildProcedureData({
    procedureType,
    entryValue: parseNumber(formData.get("entryValue")),
    game: parseText(formData.get("game")),
    houses: houses.join(", "),
    freebetCollectedValue: parseNumber(formData.get("doubleValue")),
    freebetValue: parseNumber(formData.get("freebetValue")),
    freebetCondition: parseText(formData.get("freebetCondition")),
    note: normalizeLongText(formData.get("note"), 2_000),
    freebetHouse,
    hitDouble: parseBoolean(current.bateu_duplo),
    equalProfit: parseBoolean(formData.get("equalProfit")),
    protections: parseProtections(formData) as number[],
    operationDate: formatOperationDateInput(parseText(formData.get("operationDate"))),
    freebetStatus: parseText(current.status_freebet),
    freebetResult: parseText(current.ganhou_freebet),
    freebetOriginId: current.id_freebet_origem,
  });

  await repository.updateProcedure(procedureId, payload, user.id, activeWorkspace.id);

  revalidateApplication();
  redirect(appendToastParams(returnTo, "success", "Procedimento atualizado."));
}

export async function updateProcedureDoubleStatusAction(procedureId: number, hitDouble: boolean) {
  const { activeWorkspace, user } = await requireWorkspaceContext();
  const repository = getProceduresRepository();
  const canWrite = await consumeRateLimit({
    identity: user.id,
    key: "procedures:write",
    limit: 80,
    windowMs: 60_000,
  });

  if (!canWrite) {
    throw new Error("Rate limit exceeded.");
  }

  if (Number.isInteger(procedureId) && procedureId > 0) {
    await repository.updateDoubleStatus(procedureId, hitDouble, user.id, activeWorkspace.id);
  }

  revalidateApplication();
}

export async function deleteProcedureAction(procedureId: number) {
  const { activeWorkspace, user } = await requireWorkspaceContext();
  const repository = getProceduresRepository();
  const canWrite = await consumeRateLimit({
    identity: user.id,
    key: "procedures:delete",
    limit: 30,
    windowMs: 60_000,
  });

  if (!canWrite) {
    throw new Error("Rate limit exceeded.");
  }

  if (Number.isInteger(procedureId) && procedureId > 0) {
    await repository.deleteProcedure(procedureId, user.id, activeWorkspace.id);
  }

  revalidateApplication();
}

export async function updateFreebetResultAction(formData: FormData) {
  const { activeWorkspace, user } = await requireWorkspaceContext();
  const repository = getProceduresRepository();
  const procedureId = parsePositiveInteger(formData.get("procedureId"));
  const rawResult = parseText(formData.get("result"));
  const result =
    rawResult.toLowerCase() === "não" ? FREEBET_RESULT_NO : rawResult;
  const returnTo = getReturnTo(formData, "/freebets");
  const canWrite = await consumeRateLimit({
    identity: user.id,
    key: "procedures:write",
    limit: 80,
    windowMs: 60_000,
  });

  if (!canWrite) {
    redirect(appendToastParams(returnTo, "error", "Muitas tentativas. Aguarde um pouco."));
  }

  if (Number.isInteger(procedureId) && [FREEBET_RESULT_YES, FREEBET_RESULT_NO].includes(result)) {
    await repository.updateFreebetResult(procedureId, result, user.id, activeWorkspace.id);
  }

  revalidateApplication();
  redirect(appendToastParams(returnTo, "success", "Resultado da freebet registrado."));
}
