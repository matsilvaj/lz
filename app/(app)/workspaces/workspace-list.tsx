"use client";

import { useEffect, useState } from "react";

import {
  deleteWorkspaceAction,
  switchWorkspaceAction,
  updateWorkspaceAction,
} from "./actions";

type WorkspaceItem = {
  id: number;
  nome: string;
};

type WorkspaceListProps = {
  activeWorkspaceId: number;
  workspaces: WorkspaceItem[];
};

export function WorkspaceList({
  activeWorkspaceId,
  workspaces,
}: WorkspaceListProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const canRemoveWorkspace = workspaces.length > 1;

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;

      if (!target?.closest("[data-workspace-menu-root]")) {
        setOpenMenuId(null);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuId(null);
        setEditingId(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function startEditing(workspace: WorkspaceItem) {
    setEditingId(workspace.id);
    setDraftName(workspace.nome);
    setOpenMenuId(null);
  }

  function stopEditing() {
    setEditingId(null);
    setDraftName("");
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {workspaces.map((workspace) => {
        const isActive = workspace.id === activeWorkspaceId;
        const isEditing = workspace.id === editingId;

        return (
          <div
            className={`relative rounded-2xl border p-4 ${
              isActive
                ? "border-neutral-950 bg-neutral-950 text-white"
                : "border-neutral-200 bg-white text-neutral-950"
            }`}
            key={workspace.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-base font-semibold">{workspace.nome}</p>
                  <span
                    className={`text-xs font-medium ${
                      isActive ? "text-neutral-300" : "text-neutral-500"
                    }`}
                  >
                    {isActive ? "Ativo" : "Disponível"}
                  </span>
                </div>
              </div>

              <div className="relative shrink-0" data-workspace-menu-root>
                <button
                  aria-expanded={openMenuId === workspace.id}
                  aria-label={`Abrir acoes de ${workspace.nome}`}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition ${
                    isActive
                      ? "text-neutral-300 hover:bg-white/10 hover:text-white"
                      : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
                  }`}
                  onClick={() =>
                    setOpenMenuId((current) => (current === workspace.id ? null : workspace.id))
                  }
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle cx="12" cy="5" r="1.8" />
                    <circle cx="12" cy="12" r="1.8" />
                    <circle cx="12" cy="19" r="1.8" />
                  </svg>
                </button>

                {openMenuId === workspace.id ? (
                  <div
                    className={`absolute right-0 top-10 z-20 min-w-40 rounded-2xl border p-2 shadow-lg ${
                      isActive
                        ? "border-white/10 bg-neutral-900 text-white"
                        : "border-neutral-200 bg-white text-neutral-950"
                    }`}
                  >
                    <button
                      className={`block w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                        isActive
                          ? "text-neutral-200 hover:bg-white/10 hover:text-white"
                          : "text-neutral-700 hover:bg-neutral-100 hover:text-neutral-950"
                      }`}
                      onClick={() => startEditing(workspace)}
                      type="button"
                    >
                      Editar nome
                    </button>

                    {canRemoveWorkspace ? (
                      <form action={deleteWorkspaceAction.bind(null, workspace.id)}>
                        <button
                          className={`block w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                            isActive
                              ? "text-red-200 hover:bg-white/10 hover:text-red-100"
                              : "text-red-600 hover:bg-red-50"
                          }`}
                          type="submit"
                        >
                          Remover
                        </button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            {isEditing ? (
              <form action={updateWorkspaceAction} className="mt-4 space-y-3">
                <input name="workspaceId" type="hidden" value={workspace.id} />
                <input
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none transition ${
                    isActive
                      ? "border-white/15 bg-white/10 text-white placeholder:text-neutral-400"
                      : "border-neutral-300 bg-white text-neutral-950"
                  }`}
                  name="name"
                  onChange={(event) => setDraftName(event.target.value)}
                  placeholder="Nome do workspace"
                  type="text"
                  value={draftName}
                />
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? "border border-white/20 bg-white/10 text-white hover:bg-white/15"
                        : "border border-neutral-300 text-neutral-700 hover:border-neutral-950 hover:text-neutral-950"
                    }`}
                    onClick={stopEditing}
                    type="button"
                  >
                    Cancelar
                  </button>
                  <button
                    className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? "bg-white text-neutral-950 hover:bg-neutral-100"
                        : "bg-neutral-950 text-white hover:bg-neutral-800"
                    }`}
                    type="submit"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            ) : !isActive ? (
              <form action={switchWorkspaceAction.bind(null, workspace.id, "/workspaces")} className="mt-4">
                <button
                  className="rounded-xl bg-neutral-950 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-neutral-800"
                  type="submit"
                >
                  Utilizar workspace
                </button>
              </form>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
