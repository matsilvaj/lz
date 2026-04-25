import "server-only";

import { cookies } from "next/headers";

import { getProceduresRepository } from "@/lib/server";

import { requireUser } from "./session";

export const ACTIVE_BASE_COOKIE = "lz-active-base";
export const DEFAULT_BASE_NAME = "Minha base";

type UserBase = {
  id: number;
  nome: string;
  created_at?: string;
};

export async function setActiveBaseCookie(baseId: number) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BASE_COOKIE, String(baseId), {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });
}

export async function requireBaseContext() {
  const user = await requireUser();
  const repository = getProceduresRepository();
  let bases = (await repository.listBases(user.id)) as UserBase[];

  if (bases.length === 0) {
    const createdBase = await repository.createBase(user.id, DEFAULT_BASE_NAME);
    bases = createdBase ? [createdBase as UserBase] : [];
  }

  if (bases.length === 0) {
    throw new Error("Nao foi possivel preparar a base ativa do usuario.");
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ACTIVE_BASE_COOKIE)?.value ?? "";
  const activeBaseId = Number.parseInt(cookieValue, 10);
  const activeBase =
    bases.find((base) => base.id === activeBaseId) ??
    bases[0];

  return {
    activeBase,
    bases,
    user,
  };
}
