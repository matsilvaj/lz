import "server-only";

import { cache } from "react";

import { getProceduresRepository } from "@/lib/server";

import { requireUser } from "./session";

export const DEFAULT_WORKSPACE_NAME = "Meu Workspace";

type UserWorkspace = {
  id: number;
  nome: string;
  created_at?: string;
};

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

  // Sem troca de workspace: o usuário usa sempre o primeiro. Os demais continuam no
  // banco até a conversão definitiva em parceiros.
  const activeWorkspace = workspaces[0];

  return {
    activeWorkspace,
    workspaces,
    user,
  };
});
