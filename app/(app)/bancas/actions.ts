"use server";

import { revalidatePath, updateTag } from "next/cache";

import { requireWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  normalizeLongText,
  normalizeText,
  parseLimitedNumber,
  parsePositiveInteger,
} from "@/lib/security/input";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { getProceduresRepository } from "@/lib/server";

function parseText(value: string | FormDataEntryValue | null) {
  return normalizeText(value, 120);
}

// Sem parceiro (null) a casa é do usuário.
function parsePartnerId(value: number | null | undefined) {
  const partnerId = parsePositiveInteger(value == null ? "" : String(value));
  return partnerId > 0 ? partnerId : null;
}

function parseBalance(value: string | number | FormDataEntryValue | null) {
  return parseLimitedNumber(value, { min: 0, max: 9_999_999 });
}

async function canWriteBookmakers(userId: string) {
  return consumeRateLimit({
    identity: userId,
    key: "bookmakers:write",
    limit: 80,
    windowMs: 60_000,
  });
}

function revalidateBookmakerScreens() {
  const paths = ["/bancas", "/calculadora", "/procedimentos", "/freebets", "/parceiros"];
  for (const path of paths) {
    revalidatePath(path);
  }

  updateTag("bookmakers-page-data");
  updateTag("freebets-page-data");
}

export async function saveBookmakerAction({
  name,
  balance = 0,
  partnerId = null,
}: {
  name: string;
  balance?: number;
  partnerId?: number | null;
}) {
  const { activeWorkspace, user } = await requireWorkspaceContext();
  const repository = getProceduresRepository();
  const normalizedName = parseText(name);
  const normalizedPartnerId = parsePartnerId(partnerId);

  if (!normalizedName || !(await canWriteBookmakers(user.id))) {
    return;
  }

  if (normalizedPartnerId) {
    await repository.savePartnerBookmaker(
      user.id,
      activeWorkspace.id,
      normalizedPartnerId,
      normalizedName,
      parseBalance(balance),
    );
    revalidateBookmakerScreens();
    return;
  }

  await repository.addBookmaker(
    normalizedName,
    user.id,
    activeWorkspace.id,
    parseBalance(balance),
  );

  revalidateBookmakerScreens();
}

export async function updateBookmakerBalanceAction({
  name,
  balance,
  partnerId = null,
}: {
  name: string;
  balance: number;
  partnerId?: number | null;
}) {
  const { activeWorkspace, user } = await requireWorkspaceContext();
  const repository = getProceduresRepository();
  const normalizedName = parseText(name);
  const normalizedPartnerId = parsePartnerId(partnerId);

  if (!normalizedName || !(await canWriteBookmakers(user.id))) {
    return;
  }

  if (normalizedPartnerId) {
    await repository.savePartnerBookmaker(
      user.id,
      activeWorkspace.id,
      normalizedPartnerId,
      normalizedName,
      parseBalance(balance),
    );
    revalidateBookmakerScreens();
    return;
  }

  await repository.updateBookmakerBalance(
    normalizedName,
    parseBalance(balance),
    user.id,
    activeWorkspace.id,
  );
  revalidateBookmakerScreens();
}

export async function deleteBookmakerAction(name: string, partnerId: number | null = null) {
  const { activeWorkspace, user } = await requireWorkspaceContext();
  const repository = getProceduresRepository();
  const normalizedName = parseText(name);
  const normalizedPartnerId = parsePartnerId(partnerId);

  if (!normalizedName || !(await canWriteBookmakers(user.id))) {
    return { deleted: false, blockedByPending: false };
  }

  if (normalizedPartnerId) {
    const deleted = Boolean(
      await repository.deletePartnerBookmaker(
        user.id,
        activeWorkspace.id,
        normalizedPartnerId,
        normalizedName,
      ),
    );

    if (deleted) {
      revalidateBookmakerScreens();
    }

    return { deleted, blockedByPending: false };
  }

  const result = await repository.deleteBookmaker(
    normalizedName,
    user.id,
    activeWorkspace.id,
  );

  if (result?.deleted) {
    revalidateBookmakerScreens();
  }

  return result;
}

export async function updateBookmakersNotesAction(notes: string) {
  const { activeWorkspace, user } = await requireWorkspaceContext();
  const repository = getProceduresRepository();

  if (!(await canWriteBookmakers(user.id))) {
    return;
  }

  await repository.updateBookmakersNotes(
    user.id,
    activeWorkspace.id,
    normalizeLongText(notes, 4_000),
  );
  revalidateBookmakerScreens();
}
