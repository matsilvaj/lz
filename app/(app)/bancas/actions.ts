"use server";

import { revalidatePath } from "next/cache";

import { getProceduresRepository } from "@/lib/server";

function parseText(value: string | FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function parseNumber(value: string | FormDataEntryValue | null) {
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
  const repository = getProceduresRepository();
  const normalizedName = parseText(name);

  if (!normalizedName) {
    return;
  }

  await repository.addBookmaker(normalizedName);

  revalidateBookmakerScreens();
}

export async function updateBookmakerBalanceAction({
  name,
  balance,
}: {
  name: string;
  balance: number;
}) {
  const repository = getProceduresRepository();
  const normalizedName = parseText(name);

  if (!normalizedName) {
    return;
  }

  await repository.updateBookmakerBalance(normalizedName, parseNumber(balance));
  revalidateBookmakerScreens();
}

export async function deleteBookmakerAction(name: string) {
  const repository = getProceduresRepository();
  const normalizedName = parseText(name);

  if (!normalizedName) {
    return;
  }

  await repository.deleteBookmaker(normalizedName);
  revalidateBookmakerScreens();
}
