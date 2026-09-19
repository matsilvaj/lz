"use server";

import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth/session";
import { parsePositiveInteger } from "@/lib/security/input";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { getProceduresRepository } from "@/lib/server";
import { revalidateAppData } from "@/lib/server/revalidate";
import { appendToastParams } from "@/lib/ui/toast";

const PARTNERS_PATH = "/parceiros";

type PartnerWriteResult = { error?: "duplicate" | "invalid" | "not_found"; ok?: boolean };

async function requirePartnerWrite() {
  const user = await requireUser();
  const allowed = await consumeRateLimit({
    identity: user.id,
    key: "partners:write",
    limit: 30,
    windowMs: 60_000,
  });

  if (!allowed) {
    redirect(appendToastParams(PARTNERS_PATH, "error", "Muitas tentativas. Aguarde um pouco."));
  }

  return user;
}

function finish(result: PartnerWriteResult, successMessage: string): never {
  if (result.error === "duplicate") {
    redirect(appendToastParams(PARTNERS_PATH, "error", "Já existe um parceiro com esse nome."));
  }

  if (result.error) {
    redirect(appendToastParams(PARTNERS_PATH, "error", "Informe um nome válido."));
  }

  revalidateAppData([PARTNERS_PATH]);
  redirect(appendToastParams(PARTNERS_PATH, "success", successMessage));
}

export async function createPartnerAction(formData: FormData) {
  const user = await requirePartnerWrite();
  const result = (await getProceduresRepository().createPartner(
    user.id,
    String(formData.get("name") ?? ""),
  )) as PartnerWriteResult;

  finish(result, "Parceiro adicionado.");
}

export async function renamePartnerAction(formData: FormData) {
  const user = await requirePartnerWrite();
  const result = (await getProceduresRepository().renamePartner(
    user.id,
    parsePositiveInteger(formData.get("partnerId")),
    String(formData.get("name") ?? ""),
  )) as PartnerWriteResult;

  finish(result, "Parceiro atualizado.");
}

export async function removePartnerAction(partnerId: number) {
  const user = await requirePartnerWrite();
  const removed = await getProceduresRepository().removePartner(user.id, partnerId);

  finish(removed ? { ok: true } : { error: "not_found" }, "Parceiro removido.");
}

// Opções do seletor de parceiro (modal de procedimento): só os parceiros ativos do usuário.
export async function listPartnerOptionsAction() {
  const user = await requireUser();
  const partners = (await getProceduresRepository().listPartners(user.id)) as Array<{
    id: number;
    name: string;
  }>;

  return partners.map((partner) => ({ id: partner.id, name: partner.name }));
}
