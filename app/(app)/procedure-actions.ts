"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  buildProcedureData,
  FREEBET_RESULT_NO,
  FREEBET_RESULT_YES,
} from "@/core";
import { requireUser } from "@/lib/auth/session";
import { getProceduresRepository } from "@/lib/server";

function parseText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function parseNumber(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim().replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
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
    .map((value) => Number.parseInt(String(value), 10))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function parseProtections(formData: FormData) {
  return formData
    .getAll("protections")
    .map((value) => String(value).trim())
    .filter(Boolean)
    .map((value) => parseNumber(value));
}

async function normalizeBookmakerSelection(
  repository: ReturnType<typeof getProceduresRepository>,
  houses: string[],
  freebetHouse: string,
) {
  const availableBookmakers = (await repository.listBookmakers()) as string[];
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
  const returnTo = parseText(formData.get("returnTo"));
  return returnTo || fallback;
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
}

export async function saveProcedureAction(formData: FormData) {
  const user = await requireUser();
  const repository = getProceduresRepository();
  const returnTo = getReturnTo(formData, "/procedimentos");
  const procedureType = parseText(formData.get("procedureType")) || "SureBet";
  const parsedHouses = parseHouses(parseText(formData.get("houses")));
  const parsedFreebetHouse = parseText(formData.get("freebetHouse"));
  const originIds = parseOriginIds(formData);
  const { houses, freebetHouse } = await normalizeBookmakerSelection(
    repository,
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
    note: parseText(formData.get("note")),
    freebetHouse,
    hitDouble: parseBoolean(formData.get("hitDouble")),
    equalProfit: parseBoolean(formData.get("equalProfit")),
    protections: parseProtections(formData) as number[],
    operationDate: formatOperationDateInput(parseText(formData.get("operationDate"))),
  });

  if (procedureType === "Converter Freebet" && originIds.length > 0) {
    await repository.saveFreebetConversion(payload, originIds, user.id);
  } else {
    await repository.saveProcedure(payload, user.id);
  }

  revalidateApplication();
  redirect(returnTo);
}

export async function updateProcedureAction(formData: FormData) {
  const user = await requireUser();
  const repository = getProceduresRepository();
  const returnTo = getReturnTo(formData, "/procedimentos");
  const procedureId = Number.parseInt(parseText(formData.get("procedureId")), 10);

  if (!Number.isInteger(procedureId) || procedureId <= 0) {
    redirect(returnTo);
  }

  const current = await repository.getProcedureById(procedureId, user.id);
  if (!current) {
    redirect(returnTo);
  }

  const procedureType = parseText(formData.get("procedureType")) || parseText(current.tipo_procedimento);
  const parsedHouses = parseHouses(parseText(formData.get("houses")));
  const parsedFreebetHouse = parseText(formData.get("freebetHouse"));
  const { houses, freebetHouse } = await normalizeBookmakerSelection(
    repository,
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
    note: parseText(formData.get("note")),
    freebetHouse,
    hitDouble: parseBoolean(current.bateu_duplo),
    equalProfit: parseBoolean(formData.get("equalProfit")),
    protections: parseProtections(formData) as number[],
    operationDate: formatOperationDateInput(parseText(formData.get("operationDate"))),
    freebetStatus: parseText(current.status_freebet),
    freebetResult: parseText(current.ganhou_freebet),
    freebetOriginId: current.id_freebet_origem,
  });

  await repository.updateProcedure(procedureId, payload, user.id);

  revalidateApplication();
  redirect(returnTo);
}

export async function updateProcedureDoubleStatusAction(procedureId: number, hitDouble: boolean) {
  const user = await requireUser();
  const repository = getProceduresRepository();

  if (Number.isInteger(procedureId) && procedureId > 0) {
    await repository.updateDoubleStatus(procedureId, hitDouble, user.id);
  }

  revalidateApplication();
}

export async function deleteProcedureAction(procedureId: number) {
  const user = await requireUser();
  const repository = getProceduresRepository();

  if (Number.isInteger(procedureId) && procedureId > 0) {
    await repository.deleteProcedure(procedureId, user.id);
  }

  revalidateApplication();
}

export async function updateFreebetResultAction(formData: FormData) {
  const user = await requireUser();
  const repository = getProceduresRepository();
  const procedureId = Number.parseInt(parseText(formData.get("procedureId")), 10);
  const rawResult = parseText(formData.get("result"));
  const result =
    rawResult.toLowerCase() === "nao" ? FREEBET_RESULT_NO : rawResult;
  const returnTo = getReturnTo(formData, "/freebets");

  if (Number.isInteger(procedureId) && [FREEBET_RESULT_YES, FREEBET_RESULT_NO].includes(result)) {
    await repository.updateFreebetResult(procedureId, result, user.id);
  }

  revalidateApplication();
  redirect(returnTo);
}
