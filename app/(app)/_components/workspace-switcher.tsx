"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { selectWorkspaceAction } from "../workspaces/actions";
import { setWorkspacePageLoading } from "./workspace-loading-boundary";

type WorkspaceItem = {
  id: number;
  nome: string;
};

type WorkspaceSwitcherProps = {
  activeWorkspace: WorkspaceItem;
  workspaces: WorkspaceItem[];
};

export function WorkspaceSwitcher({ activeWorkspace, workspaces }: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function selectWorkspace(workspaceId: number) {
    setOpen(false);
    setWorkspacePageLoading(true);

    startTransition(async () => {
      try {
        await selectWorkspaceAction(workspaceId);
      } finally {
        setWorkspacePageLoading(false);
      }
    });
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex h-11 max-w-[180px] items-center justify-between gap-2 rounded-full border border-white/10 bg-white/4 px-4 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-white/20 hover:bg-white/8 sm:max-w-[220px]"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="truncate">{activeWorkspace.nome}</span>
        <svg
          aria-hidden="true"
          className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M6.75 9.75L12 15l5.25-5.25"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-20 mt-3 w-72 max-w-[calc(100vw-2rem)] rounded-[26px] border border-white/10 bg-[rgba(17,8,14,0.96)] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.4)] backdrop-blur-2xl"
          role="menu"
        >
          <div className="px-3 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-dim)]">
            Workspaces
          </div>

          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {workspaces.map((workspace) => {
              const active = workspace.id === activeWorkspace.id;

              if (active) {
                return (
                  <div
                    aria-checked="true"
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(216,31,89,0.92),rgba(122,12,48,0.88))] px-3 py-3 text-sm font-semibold text-white shadow-[0_14px_32px_rgba(216,31,89,0.22)]"
                    key={workspace.id}
                    role="menuitemradio"
                  >
                    <span className="truncate">{workspace.nome}</span>
                  </div>
                );
              }

              return (
                <button
                  aria-checked="false"
                  className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-transparent px-3 py-3 text-left text-sm font-medium text-[var(--text-secondary)] transition hover:border-white/10 hover:bg-white/6 hover:text-white disabled:cursor-wait disabled:opacity-70"
                  disabled={isPending}
                  key={workspace.id}
                  onClick={() => selectWorkspace(workspace.id)}
                  role="menuitemradio"
                  type="button"
                >
                  <span className="truncate">{workspace.nome}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-2 border-t border-white/10 pt-2">
            <Link
              className="block rounded-2xl px-3 py-3 text-sm text-[var(--text-secondary)] transition hover:bg-white/6 hover:text-white"
              href="/workspaces"
              onClick={() => setOpen(false)}
            >
              Gerenciar workspaces
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
