"use server";

import { revalidatePath, updateTag } from "next/cache";

import { requireWorkspaceContext } from "@/lib/auth/workspace-context";
import { normalizeLongText, normalizeText, parseLimitedNumber } from "@/lib/security/input";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { getProceduresRepository } from "@/lib/server";

function parseText(value: string | FormDataEntryValue | null) {
  return normalizeText(value, 120);
}

function parseNumber(value: string | number | FormDataEntryValue | null) {
  return parseLimitedNumber(value);
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
  const paths = ["/bancas", "/calculadora", "/procedimentos", "/freebets"];
  for (const path of paths) {
    revalidatePath(path);
  }

  updateTag("bookmakers-page-data");
  updateTag("freebets-page-data");
}

export async function saveBookmakerAction({
  name,
}: {
  name: string;
}) {
  const { activeWorkspace, user } = await requireWorkspaceContext();
  const repository = getProceduresRepository();
  const normalizedName = parseText(name);

  if (!normalizedName || !(await canWriteBookmakers(user.id))) {
    return;
  }

  await repository.addBookmaker(normalizedName, user.id, activeWorkspace.id);

  revalidateBookmakerScreens();
}

export async function updateBookmakerBalanceAction({
  name,
  balance,
}: {
  name: string;
  balance: number;
}) {
  const { activeWorkspace, user } = await requireWorkspaceContext();
  const repository = getProceduresRepository();
  const normalizedName = parseText(name);

  if (!normalizedName || !(await canWriteBookmakers(user.id))) {
    return;
  }

  await repository.updateBookmakerBalance(
    normalizedName,
    parseNumber(balance),
    user.id,
    activeWorkspace.id,
  );
  revalidateBookmakerScreens();
}

export async function deleteBookmakerAction(name: string) {
  const { activeWorkspace, user } = await requireWorkspaceContext();
  const repository = getProceduresRepository();
  const normalizedName = parseText(name);

  if (!normalizedName || !(await canWriteBookmakers(user.id))) {
    return;
  }

  await repository.deleteBookmaker(normalizedName, user.id, activeWorkspace.id);
  revalidateBookmakerScreens();
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
