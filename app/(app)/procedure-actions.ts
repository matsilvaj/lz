"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import {
  FREEBET_CONDITION_CONVERSION_ONLY,
  FREEBET_CONDITION_LOSS_ONLY,
  FREEBET_RESULT_NO,
  FREEBET_RESULT_YES,
  FREEBET_STATUS_FINISHED,
  FREEBET_STATUS_PENDING,
  FREEBET_STATUS_USED,
  PROCEDURE_STATUS_DONE,
  PROCEDURE_STATUS_PENDING,
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

function parseProcedureType(value: FormDataEntryValue | null, fallback = "SureBet") {
  const procedureType = parseText(value) || fallback;
  return procedureType === "Freebet" ? "Coletar Freebet" : procedureType;
}

function isFreebetProcedureType(procedureType: string) {
  return procedureType === "Coletar Freebet" || procedureType === "Converter Freebet";
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

type ProcedureDetailScope = "sports" | "freebet_collection" | "freebet_conversion";
type ProcedureDetailRole = "principal" | "protecao";
type ProcedureDetailSide = "back" | "lay";

type ProcedureEntryInput = {
  scope: ProcedureDetailScope;
  role: ProcedureDetailRole;
  order: number;
  resultKey: string;
  house: string;
  value: number;
  odd: number;
  side: ProcedureDetailSide;
  layOdd: number;
  commission: number;
  increase: number;
  cashback: number;
  freebet: boolean;
  operationDate: string;
};

type ProcedureResultInput = {
  scope: ProcedureDetailScope;
  resultKey: string;
};

type ProcedureDetailsInput = {
  entries: ProcedureEntryInput[];
  results: ProcedureResultInput[];
};

type BookmakerBalanceImpact = {
  house: string;
  balance: number;
};

const PROCEDURE_DETAIL_SCOPES = new Set([
  "sports",
  "freebet_collection",
  "freebet_conversion",
]);
const PROCEDURE_DETAIL_ROLES = new Set(["principal", "protecao"]);

function parseDetailNumber(value: unknown) {
  return parseLimitedNumber(
    typeof value === "number" || typeof value === "string" ? value : null,
  );
}

function parseDetailBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  return ["1", "true", "on", "yes", "sim"].includes(
    String(value ?? "").trim().toLowerCase(),
  );
}

function normalizeProcedureDetailScope(value: unknown): ProcedureDetailScope {
  const scope = normalizeText(typeof value === "string" ? value : null, 40);
  return PROCEDURE_DETAIL_SCOPES.has(scope)
    ? (scope as ProcedureDetailScope)
    : "sports";
}

function normalizeProcedureDetailRole(value: unknown): ProcedureDetailRole {
  const role = normalizeText(typeof value === "string" ? value : null, 40);
  return PROCEDURE_DETAIL_ROLES.has(role)
    ? (role as ProcedureDetailRole)
    : "principal";
}

function normalizeProcedureDetailSide(value: unknown): ProcedureDetailSide {
  return value === "lay" ? "lay" : "back";
}

function normalizeProcedureResultKey(value: unknown, fallback = "principal") {
  const key = normalizeText(typeof value === "string" ? value : null, 40);

  if (key === "principal" || key === "defeat" || /^protection-\d+$/u.test(key)) {
    return key;
  }

  return fallback;
}

function normalizeSelectedProcedureResultKey(value: unknown) {
  return normalizeProcedureResultKey(value, "");
}

function parseProcedureDetails(
  value: FormDataEntryValue | null,
  availableBookmakers: string[],
): ProcedureDetailsInput {
  if (typeof value !== "string" || !value.trim()) {
    return { entries: [], results: [] };
  }

  const bookmakerMap = new Map(
    availableBookmakers.map((bookmaker) => [bookmaker.toLowerCase(), bookmaker]),
  );

  try {
    const parsed = JSON.parse(value) as {
      entries?: unknown[];
      results?: unknown[];
    };
    const entries = (Array.isArray(parsed.entries) ? parsed.entries : [])
      .slice(0, 80)
      .map((rawEntry, index) => {
        const entry = rawEntry && typeof rawEntry === "object"
          ? (rawEntry as Record<string, unknown>)
          : {};
        const rawHouse = normalizeText(
          typeof entry.house === "string" ? entry.house : null,
          180,
        );
        const house = rawHouse
          ? (bookmakerMap.get(rawHouse.toLowerCase()) ?? "")
          : "";
        const rawOperationDate =
          typeof entry.operationDate === "string"
            ? entry.operationDate
            : typeof entry.data_operacao === "string"
              ? entry.data_operacao
              : null;

        return {
          scope: normalizeProcedureDetailScope(entry.scope),
          role: normalizeProcedureDetailRole(entry.role),
          order: Math.min(Math.max(Math.trunc(parseDetailNumber(entry.order)), 0), 50),
          resultKey: normalizeProcedureResultKey(
            entry.resultKey,
            `protection-${index}`,
          ),
          house,
          value: parseDetailNumber(entry.value),
          odd: parseDetailNumber(entry.odd),
          side: normalizeProcedureDetailSide(entry.side),
          layOdd: parseDetailNumber(entry.layOdd),
          commission: parseDetailNumber(entry.commission),
          increase: parseDetailNumber(entry.increase ?? entry.aumento_percentual),
          cashback: parseDetailNumber(entry.cashback ?? entry.cashback_percentual),
          freebet: parseDetailBoolean(entry.freebet ?? entry.freebet_somente_lucro),
          operationDate: formatOperationDateInput(
            parseText(rawOperationDate),
          ) ?? "",
        };
      })
      .filter((entry) => entry.resultKey !== "defeat");
    const results = (Array.isArray(parsed.results) ? parsed.results : [])
      .slice(0, 80)
      .map((rawResult) => {
        const result = rawResult && typeof rawResult === "object"
          ? (rawResult as Record<string, unknown>)
          : {};
        const resultKey = normalizeSelectedProcedureResultKey(result.resultKey);

        if (!resultKey) {
          return null;
        }

        return {
          scope: normalizeProcedureDetailScope(result.scope),
          resultKey,
        };
      })
      .filter((result): result is ProcedureResultInput => result !== null);

    return { entries, results };
  } catch {
    return { entries: [], results: [] };
  }
}

function normalizeCurrencyAmount(value: number) {
  return Math.abs(value) < 0.005 ? 0 : value;
}

function calculateAdjustedOdd(odd: number, increase: number) {
  if (odd <= 1) {
    return odd;
  }

  return 1 + (odd - 1) * (1 + increase / 100);
}

function calculateEntryBalance(
  entry: ProcedureEntryInput,
  selectedResultKeys: Set<string>,
  defeatSelected: boolean,
) {
  if (defeatSelected) {
    return 0;
  }

  if (selectedResultKeys.size === 0) {
    return entry.freebet ? 0 : entry.value;
  }

  if (entry.side === "lay" && !selectedResultKeys.has(entry.resultKey)) {
    const baseOdd = entry.layOdd > 1 ? entry.layOdd : entry.odd;
    const effectiveOdd = calculateAdjustedOdd(baseOdd, entry.increase);

    if (effectiveOdd <= 1) {
      return 0;
    }

    const layStake = entry.value / (effectiveOdd - 1);
    const commissionMultiplier = 1 - entry.commission / 100;
    const cashbackRate = entry.cashback / 100;

    return layStake *
      (effectiveOdd - 1 + commissionMultiplier - (effectiveOdd - 1) * cashbackRate);
  }

  if (entry.side !== "lay" && selectedResultKeys.has(entry.resultKey)) {
    const effectiveOdd = calculateAdjustedOdd(entry.odd, entry.increase);
    const commissionMultiplier = 1 - entry.commission / 100;
    const cashbackRate = entry.cashback / 100;

    if (entry.freebet) {
      return entry.value * ((effectiveOdd - 1) * commissionMultiplier);
    }

    return (
      entry.value *
      (1 + (effectiveOdd - 1) * commissionMultiplier - cashbackRate)
    );
  }

  return 0;
}

function calculateBookmakerBalanceImpacts(
  details: ProcedureDetailsInput,
): BookmakerBalanceImpact[] {
  const resultsByScope = new Map<
    ProcedureDetailScope,
    { defeatSelected: boolean; selectedResultKeys: Set<string> }
  >();

  for (const result of details.results) {
    const scopeResults = resultsByScope.get(result.scope) ?? {
      defeatSelected: false,
      selectedResultKeys: new Set<string>(),
    };

    if (result.resultKey === "defeat") {
      scopeResults.defeatSelected = true;
      scopeResults.selectedResultKeys.clear();
    } else if (!scopeResults.defeatSelected) {
      scopeResults.selectedResultKeys.add(result.resultKey);
    }

    resultsByScope.set(result.scope, scopeResults);
  }

  const impactsByHouse = new Map<
    string,
    { house: string; balance: number; firstOrder: number }
  >();

  details.entries.forEach((entry, index) => {
    if (!entry.house.trim()) {
      return;
    }

    const scopeResults = resultsByScope.get(entry.scope) ?? {
      defeatSelected: false,
      selectedResultKeys: new Set<string>(),
    };
    const balance = calculateEntryBalance(
      entry,
      scopeResults.selectedResultKeys,
      scopeResults.defeatSelected,
    );

    if (normalizeCurrencyAmount(balance) <= 0) {
      return;
    }

    const key = entry.house.toLowerCase();
    const current = impactsByHouse.get(key);

    if (current) {
      current.balance += balance;
      return;
    }

    impactsByHouse.set(key, {
      house: entry.house,
      balance,
      firstOrder: index,
    });
  });

  return [...impactsByHouse.values()]
    .map((impact) => ({
      house: impact.house,
      balance: normalizeCurrencyAmount(impact.balance),
      firstOrder: impact.firstOrder,
    }))
    .filter((impact) => impact.balance > 0)
    .sort((first, second) => first.firstOrder - second.firstOrder)
    .map(({ house, balance }) => ({ house, balance }));
}

function buildBookmakerBalanceToastDescription(
  impacts: BookmakerBalanceImpact[],
) {
  if (impacts.length === 0) {
    return undefined;
  }

  return "Saldos das bancas atualizados";
}

function getDetailResultKeysByScope(
  details: ProcedureDetailsInput,
  scope: ProcedureDetailScope,
) {
  return details.results
    .filter((result) => result.scope === scope)
    .map((result) => result.resultKey);
}

function hasConversionDetails(details: ProcedureDetailsInput) {
  return details.entries
    .filter((entry) => entry.scope === "freebet_conversion")
    .some(
      (entry) =>
        entry.house.trim() ||
        entry.odd > 0 ||
        entry.layOdd > 0 ||
        entry.commission > 0 ||
        entry.increase > 0 ||
        entry.cashback > 0 ||
        entry.freebet,
    );
}

function applyFreebetLifecycle(
  payload: ReturnType<typeof buildProcedureData>,
  procedureType: string,
  freebetCondition: string,
  details: ProcedureDetailsInput,
) {
  if (procedureType !== "Coletar Freebet") {
    return payload;
  }

  const collectionResults = getDetailResultKeysByScope(
    details,
    "freebet_collection",
  );
  const conversionResults = getDetailResultKeysByScope(
    details,
    "freebet_conversion",
  );

  if (freebetCondition === FREEBET_CONDITION_CONVERSION_ONLY) {
    if (conversionResults.length > 0) {
      return {
        ...payload,
        status_freebet: FREEBET_STATUS_FINISHED,
        status_procedimento: PROCEDURE_STATUS_DONE,
        ganhou_freebet: FREEBET_RESULT_YES,
      };
    }

    return {
      ...payload,
      status_freebet: FREEBET_STATUS_PENDING,
      status_procedimento: PROCEDURE_STATUS_PENDING,
      ganhou_freebet: "",
    };
  }

  if (collectionResults.length === 0) {
    return {
      ...payload,
      status_freebet: FREEBET_STATUS_PENDING,
      status_procedimento: PROCEDURE_STATUS_PENDING,
      ganhou_freebet: "",
    };
  }

  if (
    freebetCondition === FREEBET_CONDITION_LOSS_ONLY &&
    collectionResults.includes("principal")
  ) {
    return {
      ...payload,
      status_freebet: FREEBET_STATUS_FINISHED,
      status_procedimento: PROCEDURE_STATUS_DONE,
      ganhou_freebet: FREEBET_RESULT_NO,
    };
  }

  if (conversionResults.length > 0) {
    return {
      ...payload,
      status_freebet: FREEBET_STATUS_FINISHED,
      status_procedimento: PROCEDURE_STATUS_DONE,
      ganhou_freebet: FREEBET_RESULT_YES,
    };
  }

  return {
    ...payload,
    status_freebet: hasConversionDetails(details)
      ? FREEBET_STATUS_USED
      : FREEBET_STATUS_PENDING,
    status_procedimento: PROCEDURE_STATUS_PENDING,
    ganhou_freebet: FREEBET_RESULT_YES,
  };
}

async function normalizeBookmakerSelection(
  houses: string[],
  freebetHouse: string,
  availableBookmakers?: string[],
) {
  const catalog = availableBookmakers ?? ((await getBookmakersCatalog()) as string[]);
  const bookmakerMap = new Map(
    catalog.map((bookmaker) => [bookmaker.toLowerCase(), bookmaker]),
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

  const procedureType = parseProcedureType(formData.get("procedureType"));
  const parsedHouses = parseHouses(parseText(formData.get("houses")));
  const parsedFreebetHouse = parseText(formData.get("freebetHouse"));
  const availableBookmakers = (await getBookmakersCatalog()) as string[];
  const procedureDetails = parseProcedureDetails(
    formData.get("procedureDetails"),
    availableBookmakers,
  );
  const originIds = parseOriginIds(formData);
  const { houses, freebetHouse } = await normalizeBookmakerSelection(
    parsedHouses,
    parsedFreebetHouse,
    availableBookmakers,
  );

  if (isFreebetProcedureType(procedureType) && !freebetHouse) {
    redirect(appendToastParams(returnTo, "error", "Informe a casa da freebet."));
  }

  const freebetCondition = parseText(formData.get("freebetCondition"));
  const payload = applyFreebetLifecycle(
    buildProcedureData({
      procedureType,
      entryValue: parseNumber(formData.get("entryValue")),
      game: parseText(formData.get("game")),
      freebetCollectionGame: parseText(formData.get("collectionGame")),
      freebetConversionGame: parseText(formData.get("conversionGame")),
      freebetConversionBatchId: parseText(formData.get("conversionBatchId")),
      houses: houses.join(", "),
      freebetCollectedValue: parseNumber(formData.get("doubleValue")),
      freebetValue: parseNumber(formData.get("freebetValue")),
      freebetCondition,
      note: normalizeLongText(formData.get("note"), 2_000),
      freebetHouse,
      procedureStatus: parseText(formData.get("procedureStatus")),
      hitDouble: parseBoolean(formData.get("hitDouble")),
      equalProfit: parseBoolean(formData.get("equalProfit")),
      protections: parseProtections(formData) as number[],
      operationDate: formatOperationDateInput(parseText(formData.get("operationDate"))),
    }),
    procedureType,
    freebetCondition,
    procedureDetails,
  );

  if (
    isFreebetProcedureType(procedureType) &&
    originIds.length > 0 &&
    hasConversionDetails(procedureDetails)
  ) {
    await repository.saveFreebetConversion(
      payload,
      originIds,
      user.id,
      activeWorkspace.id,
      procedureDetails,
    );
  } else {
    await repository.saveProcedureWithDetails(
      payload,
      procedureDetails,
      user.id,
      activeWorkspace.id,
    );
  }

  const bookmakerBalanceImpacts = calculateBookmakerBalanceImpacts(procedureDetails);

  revalidateApplication();
  redirect(
    appendToastParams(
      returnTo,
      "success",
      "Procedimento salvo.",
      buildBookmakerBalanceToastDescription(bookmakerBalanceImpacts),
    ),
  );
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

  const procedureType = parseProcedureType(
    formData.get("procedureType"),
    parseText(current.tipo_procedimento),
  );
  const parsedHouses = parseHouses(parseText(formData.get("houses")));
  const parsedFreebetHouse = parseText(formData.get("freebetHouse"));
  const availableBookmakers = (await getBookmakersCatalog()) as string[];
  const procedureDetails = parseProcedureDetails(
    formData.get("procedureDetails"),
    availableBookmakers,
  );
  const originIds = parseOriginIds(formData);
  const { houses, freebetHouse } = await normalizeBookmakerSelection(
    parsedHouses,
    parsedFreebetHouse,
    availableBookmakers,
  );

  if (isFreebetProcedureType(procedureType) && !freebetHouse) {
    redirect(appendToastParams(returnTo, "error", "Informe a casa da freebet."));
  }

  const freebetCondition = parseText(formData.get("freebetCondition"));
  const payload = applyFreebetLifecycle(
    buildProcedureData({
      procedureType,
      entryValue: parseNumber(formData.get("entryValue")),
      game: parseText(formData.get("game")),
      freebetCollectionGame: parseText(formData.get("collectionGame")),
      freebetConversionGame: parseText(formData.get("conversionGame")),
      freebetConversionBatchId:
        parseText(formData.get("conversionBatchId")) ||
        parseText(current.lote_conversao_freebet),
      houses: houses.join(", "),
      freebetCollectedValue: parseNumber(formData.get("doubleValue")),
      freebetValue: parseNumber(formData.get("freebetValue")),
      freebetCondition,
      note: normalizeLongText(formData.get("note"), 2_000),
      freebetHouse,
      procedureStatus: parseText(formData.get("procedureStatus")),
      hitDouble: parseBoolean(current.bateu_duplo),
      equalProfit: parseBoolean(formData.get("equalProfit")),
      protections: parseProtections(formData) as number[],
      operationDate: formatOperationDateInput(parseText(formData.get("operationDate"))),
      freebetStatus: parseText(current.status_freebet),
      freebetResult: parseText(current.ganhou_freebet),
      freebetOriginId: current.id_freebet_origem,
    }),
    procedureType,
    freebetCondition,
    procedureDetails,
  );

  if (
    isFreebetProcedureType(procedureType) &&
    originIds.length > 0 &&
    hasConversionDetails(procedureDetails)
  ) {
    await repository.saveFreebetConversion(
      payload,
      originIds,
      user.id,
      activeWorkspace.id,
      procedureDetails,
    );
  } else {
    await repository.updateProcedureWithDetails(
      procedureId,
      payload,
      procedureDetails,
      user.id,
      activeWorkspace.id,
    );
  }

  const bookmakerBalanceImpacts = calculateBookmakerBalanceImpacts(procedureDetails);

  revalidateApplication();
  redirect(
    appendToastParams(
      returnTo,
      "success",
      "Procedimento editado.",
      buildBookmakerBalanceToastDescription(bookmakerBalanceImpacts),
    ),
  );
}

export async function updateProcedureDoubleStatusAction(
  procedureId: number | string,
  hitDouble: boolean,
) {
  const { activeWorkspace, user } = await requireWorkspaceContext();
  const repository = getProceduresRepository();
  const parsedProcedureId = parsePositiveInteger(procedureId);
  const canWrite = await consumeRateLimit({
    identity: user.id,
    key: "procedures:write",
    limit: 80,
    windowMs: 60_000,
  });

  if (!canWrite) {
    throw new Error("Rate limit exceeded.");
  }

  if (parsedProcedureId > 0) {
    await repository.updateDoubleStatus(parsedProcedureId, hitDouble, user.id, activeWorkspace.id);
  }

  revalidateApplication();
}
export async function deleteProcedureAction(procedureId: number | string) {
  const { activeWorkspace, user } = await requireWorkspaceContext();
  const repository = getProceduresRepository();
  const parsedProcedureId = parsePositiveInteger(procedureId);
  const canWrite = await consumeRateLimit({
    identity: user.id,
    key: "procedures:delete",
    limit: 30,
    windowMs: 60_000,
  });

  if (!canWrite) {
    throw new Error("Rate limit exceeded.");
  }

  if (parsedProcedureId > 0) {
    await repository.deleteProcedure(parsedProcedureId, user.id, activeWorkspace.id);
  }

  revalidateApplication();
}
