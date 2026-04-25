"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { setActiveBaseCookie } from "@/lib/auth/base-context";
import { requireUser } from "@/lib/auth/session";
import { getProceduresRepository } from "@/lib/server";

function parseText(value: string | FormDataEntryValue | null) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function revalidateApplication() {
  const paths = [
    "/dashboard",
    "/procedimentos",
    "/freebets",
    "/calculadora",
    "/bancas",
    "/historico",
    "/bases",
  ];

  for (const path of paths) {
    revalidatePath(path);
  }
}

export async function createBaseAction(formData: FormData) {
  const user = await requireUser();
  const repository = getProceduresRepository();
  const name = parseText(formData.get("name"));

  if (!name) {
    redirect("/bases");
  }

  const createdBase = await repository.createBase(user.id, name);

  if (createdBase?.id) {
    await setActiveBaseCookie(createdBase.id);
  }

  revalidateApplication();
  redirect("/bases");
}

export async function switchBaseAction(baseId: number, returnTo = "/dashboard") {
  const user = await requireUser();
  const repository = getProceduresRepository();
  const base = await repository.getBaseById(user.id, baseId);

  if (!base) {
    return;
  }

  await setActiveBaseCookie(base.id);
  revalidateApplication();
  redirect(returnTo);
}
