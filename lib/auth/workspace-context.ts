import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import { getProceduresRepository } from "@/lib/server";

import { requireUser } from "./session";

export const ACTIVE_WORKSPACE_COOKIE = "lz-active-workspace";
export const DEFAULT_WORKSPACE_NAME = "Meu Workspace";

type UserWorkspace = {
  id: number;
  nome: string;
  created_at?: string;
};

export async function setActiveWorkspaceCookie(workspaceId: number) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, String(workspaceId), {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export const requireWorkspaceContext = cache(async function requireWorkspaceContext() {
  const user = await requireUser();
  const repository = getProceduresRepository();
  let workspaces = (await repository.listWorkspaces(user.id)) as UserWorkspace[];

  if (workspaces.length === 0) {
    const createdWorkspace = await repository.createWorkspace(user.id, DEFAULT_WORKSPACE_NAME);
    workspaces = createdWorkspace ? [createdWorkspace as UserWorkspace] : [];
  }

  if (workspaces.length === 0) {
    throw new Error("Não foi possível preparar a workspace ativa do usuário.");
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value ?? "";
  const activeWorkspaceId = Number.parseInt(cookieValue, 10);
  const activeWorkspace =
    workspaces.find((workspace) => workspace.id === activeWorkspaceId) ??
    workspaces[0];

  return {
    activeWorkspace,
    workspaces,
    user,
  };
});
