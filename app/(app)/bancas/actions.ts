"use server";

import { revalidatePath } from "next/cache";

import { requireBaseContext } from "@/lib/auth/base-context";
import { getProceduresRepository } from "@/lib/server";

function parseText(value: string | FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function parseNumber(value: string | number | FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim().replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function revalidateBookmakerScreens() {
  const paths = ["/bancas", "/calculadora", "/procedimentos", "/freebets"];
  for (const path of paths) {
    revalidatePath(path);
  }
}

export async function saveBookmakerAction({
  name,
}: {
  name: string;
}) {
  const { activeBase, user } = await requireBaseContext();
  const repository = getProceduresRepository();
  const normalizedName = parseText(name);

  if (!normalizedName) {
    return;
  }

  await repository.addBookmaker(normalizedName, user.id, activeBase.id);

  revalidateBookmakerScreens();
}

export async function updateBookmakerBalanceAction({
  name,
  balance,
}: {
  name: string;
  balance: number;
}) {
  const { activeBase, user } = await requireBaseContext();
  const repository = getProceduresRepository();
  const normalizedName = parseText(name);

  if (!normalizedName) {
    return;
  }

  await repository.updateBookmakerBalance(
    normalizedName,
    parseNumber(balance),
    user.id,
    activeBase.id,
  );
  revalidateBookmakerScreens();
}

export async function deleteBookmakerAction(name: string) {
  const { activeBase, user } = await requireBaseContext();
  const repository = getProceduresRepository();
  const normalizedName = parseText(name);

  if (!normalizedName) {
    return;
  }

  await repository.deleteBookmaker(normalizedName, user.id, activeBase.id);
  revalidateBookmakerScreens();
}

export async function updateBookmakersNotesAction(notes: string) {
  const { activeBase, user } = await requireBaseContext();
  const repository = getProceduresRepository();

  await repository.updateBookmakersNotes(user.id, activeBase.id, parseText(notes));
  revalidateBookmakerScreens();
}
