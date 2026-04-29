"use server";

import { refresh, revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";

import { getSafeAppPath } from "@/lib/auth/redirects";
import {
  requireWorkspaceContext,
  setActiveWorkspaceCookie,
} from "@/lib/auth/workspace-context";
import { requireUser } from "@/lib/auth/session";
import { normalizeText, parsePositiveInteger } from "@/lib/security/input";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { getProceduresRepository } from "@/lib/server";
import { appendToastParams } from "@/lib/ui/toast";

function parseText(value: string | FormDataEntryValue | null) {
  return normalizeText(value, 80);
}

async function canWriteWorkspaces(userId: string) {
  return consumeRateLimit({
    identity: userId,
    key: "workspaces:write",
    limit: 30,
    windowMs: 60_000,
  });
}

function revalidateApplication() {
  const paths = [
    "/dashboard",
    "/procedimentos",
    "/freebets",
    "/calculadora",
    "/bancas",
    "/historico",
    "/workspaces",
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

export async function createWorkspaceAction(formData: FormData) {
  const user = await requireUser();
  const repository = getProceduresRepository();
  const name = parseText(formData.get("name"));

  if (!(await canWriteWorkspaces(user.id))) {
    redirect(appendToastParams("/workspaces", "error", "Muitas tentativas. Aguarde um pouco."));
  }

  if (!name) {
    redirect("/workspaces");
  }

  const createdWorkspace = await repository.createWorkspace(user.id, name);

  if (createdWorkspace?.id) {
    await setActiveWorkspaceCookie(createdWorkspace.id);
  }

  revalidateApplication();
  redirect(appendToastParams("/workspaces", "success", "Workspace criado."));
}

export async function switchWorkspaceAction(workspaceId: number, returnTo = "/dashboard") {
  const user = await requireUser();
  const repository = getProceduresRepository();
  const workspace = await repository.getWorkspaceById(user.id, workspaceId);
  const safeReturnTo = getSafeAppPath(returnTo, "/dashboard");

  if (!workspace) {
    return;
  }

  await setActiveWorkspaceCookie(workspace.id);
  revalidateApplication();
  redirect(safeReturnTo);
}

export async function selectWorkspaceAction(workspaceId: number) {
  const user = await requireUser();
  const repository = getProceduresRepository();
  const workspace = await repository.getWorkspaceById(user.id, workspaceId);

  if (!workspace) {
    return;
  }

  await setActiveWorkspaceCookie(workspace.id);
  revalidateApplication();
  refresh();
}

export async function updateWorkspaceAction(formData: FormData) {
  const user = await requireUser();
  const repository = getProceduresRepository();
  const workspaceId = parsePositiveInteger(formData.get("workspaceId"));
  const name = parseText(formData.get("name"));

  if (!(await canWriteWorkspaces(user.id))) {
    redirect(appendToastParams("/workspaces", "error", "Muitas tentativas. Aguarde um pouco."));
  }

  if (workspaceId <= 0 || !name) {
    redirect("/workspaces");
  }

  await repository.updateWorkspace(user.id, workspaceId, name);

  revalidateApplication();
  redirect(appendToastParams("/workspaces", "success", "Workspace atualizado."));
}

export async function deleteWorkspaceAction(workspaceId: number) {
  const { activeWorkspace, user, workspaces } = await requireWorkspaceContext();
  const repository = getProceduresRepository();

  if (!(await canWriteWorkspaces(user.id))) {
    redirect(appendToastParams("/workspaces", "error", "Muitas tentativas. Aguarde um pouco."));
  }

  if (!Number.isInteger(workspaceId) || workspaceId <= 0 || workspaces.length <= 1) {
    redirect("/workspaces");
  }

  const target = workspaces.find((workspace) => workspace.id === workspaceId);

  if (!target) {
    redirect("/workspaces");
  }

  const fallbackWorkspace = workspaces.find((workspace) => workspace.id !== workspaceId);

  await repository.deleteWorkspace(user.id, workspaceId);

  if (activeWorkspace.id === workspaceId && fallbackWorkspace) {
    await setActiveWorkspaceCookie(fallbackWorkspace.id);
  }

  revalidateApplication();
  redirect(appendToastParams("/workspaces", "success", "Workspace removido."));
}
