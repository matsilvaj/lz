"use client";

import { useEffect, useState } from "react";

import { ConfirmationDialog } from "../_components/confirmation-dialog";
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
  const [deleteWorkspaceId, setDeleteWorkspaceId] = useState<number | null>(null);
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
        setDeleteWorkspaceId(null);
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
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {workspaces.map((workspace) => {
        const isActive = workspace.id === activeWorkspaceId;
        const isEditing = workspace.id === editingId;

        return (
          <div
            className={`relative rounded-[28px] border p-4 ${
              isActive
                ? "border-[rgba(255,119,163,0.24)] bg-[linear-gradient(180deg,rgba(35,12,22,0.95),rgba(21,8,15,0.95))] text-white shadow-[0_22px_48px_rgba(216,31,89,0.16)]"
                : "border-white/10 bg-white/5 text-white"
            }`}
            key={workspace.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-base font-semibold">{workspace.nome}</p>
                  <span
                    className={`text-xs font-medium ${
                      isActive ? "text-[var(--text-secondary)]" : "text-[var(--text-dim)]"
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
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full border transition ${
                    isActive
                      ? "border-white/10 text-[var(--text-secondary)] hover:bg-white/10 hover:text-white"
                      : "border-white/10 text-[var(--text-dim)] hover:bg-white/8 hover:text-white"
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
                    className={`absolute right-0 top-10 z-20 min-w-44 rounded-[24px] border p-2 shadow-[0_24px_60px_rgba(0,0,0,0.36)] backdrop-blur-2xl ${
                      isActive
                        ? "border-white/10 bg-[rgba(12,6,10,0.98)] text-white"
                        : "border-white/10 bg-[rgba(17,8,14,0.98)] text-white"
                    }`}
                  >
                    <button
                      className="block w-full rounded-2xl px-3 py-3 text-left text-sm text-[var(--text-secondary)] transition hover:bg-white/8 hover:text-white"
                      onClick={() => startEditing(workspace)}
                      type="button"
                    >
                      Editar nome
                    </button>

                    {canRemoveWorkspace ? (
                      <button
                        className="block w-full rounded-2xl px-3 py-3 text-left text-sm text-[var(--negative)] transition hover:bg-[rgba(255,107,133,0.12)] hover:text-[#ffb6c4]"
                        onClick={() => {
                          setOpenMenuId(null);
                          setDeleteWorkspaceId(workspace.id);
                        }}
                        type="button"
                      >
                        Remover
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <ConfirmationDialog
              description="Os dados vinculados a este workspace deixam de aparecer na sua operacao atual."
              onOpenChange={(open) => setDeleteWorkspaceId(open ? workspace.id : null)}
              open={deleteWorkspaceId === workspace.id}
              title="Remover workspace?"
            >
              <form
                action={deleteWorkspaceAction.bind(null, workspace.id)}
                className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
              >
                <button
                  className="lz-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold"
                  onClick={() => setDeleteWorkspaceId(null)}
                  type="button"
                >
                  Cancelar
                </button>
                <button
                  className="rounded-full border border-[rgba(255,107,133,0.26)] bg-[rgba(255,107,133,0.12)] px-4 py-2.5 text-sm font-semibold text-[var(--negative)] transition hover:bg-[rgba(255,107,133,0.18)]"
                  type="submit"
                >
                  Confirmar remocao
                </button>
              </form>
            </ConfirmationDialog>

            {isEditing ? (
              <form action={updateWorkspaceAction} className="mt-4 space-y-3">
                <input name="workspaceId" type="hidden" value={workspace.id} />
                <input
                  className={`w-full rounded-2xl border px-3 py-3 text-sm outline-none transition ${
                    isActive
                      ? "border-white/15 bg-white/10 text-white placeholder:text-[var(--text-dim)]"
                      : "border-white/10 bg-white/5 text-white placeholder:text-[var(--text-dim)]"
                  }`}
                  name="name"
                  onChange={(event) => setDraftName(event.target.value)}
                  placeholder="Nome do workspace"
                  type="text"
                  value={draftName}
                />
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? "border border-white/20 bg-white/10 text-white hover:bg-white/15"
                        : "border border-white/10 bg-white/5 text-[var(--text-secondary)] hover:border-white/20 hover:text-white"
                    }`}
                    onClick={stopEditing}
                    type="button"
                  >
                    Cancelar
                  </button>
                  <button
                    className={`rounded-full px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? "bg-white text-[#190911] hover:bg-[#fff5f8]"
                        : "lz-button-primary"
                    }`}
                    type="submit"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            ) : !isActive ? (
              <form
                action={switchWorkspaceAction.bind(null, workspace.id, "/workspaces")}
                className="mt-4"
              >
                <button
                  className="lz-button-secondary rounded-full px-3 py-2 text-xs font-medium"
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
