"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  requireWorkspaceContext,
  setActiveWorkspaceCookie,
} from "@/lib/auth/workspace-context";
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
    "/workspaces",
  ];

  for (const path of paths) {
    revalidatePath(path);
  }
}

export async function createWorkspaceAction(formData: FormData) {
  const user = await requireUser();
  const repository = getProceduresRepository();
  const name = parseText(formData.get("name"));

  if (!name) {
    redirect("/workspaces");
  }

  const createdWorkspace = await repository.createWorkspace(user.id, name);

  if (createdWorkspace?.id) {
    await setActiveWorkspaceCookie(createdWorkspace.id);
  }

  revalidateApplication();
  redirect("/workspaces");
}

export async function switchWorkspaceAction(workspaceId: number, returnTo = "/dashboard") {
  const user = await requireUser();
  const repository = getProceduresRepository();
  const workspace = await repository.getWorkspaceById(user.id, workspaceId);

  if (!workspace) {
    return;
  }

  await setActiveWorkspaceCookie(workspace.id);
  revalidateApplication();
  redirect(returnTo);
}

export async function updateWorkspaceAction(formData: FormData) {
  const user = await requireUser();
  const repository = getProceduresRepository();
  const workspaceId = Number.parseInt(parseText(formData.get("workspaceId")), 10);
  const name = parseText(formData.get("name"));

  if (!Number.isInteger(workspaceId) || workspaceId <= 0 || !name) {
    redirect("/workspaces");
  }

  await repository.updateWorkspace(user.id, workspaceId, name);

  revalidateApplication();
  redirect("/workspaces");
}

export async function deleteWorkspaceAction(workspaceId: number) {
  const { activeWorkspace, user, workspaces } = await requireWorkspaceContext();
  const repository = getProceduresRepository();

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
  redirect("/workspaces");
}
