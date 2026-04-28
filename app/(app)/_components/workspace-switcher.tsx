"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { switchWorkspaceAction } from "../workspaces/actions";

type WorkspaceItem = {
  id: number;
  nome: string;
};

type WorkspaceSwitcherProps = {
  activeWorkspace: WorkspaceItem;
  workspaces: WorkspaceItem[];
};

export function WorkspaceSwitcher({ activeWorkspace, workspaces }: WorkspaceSwitcherProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
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
        <div className="absolute right-0 top-full z-20 mt-3 min-w-64 rounded-[26px] border border-white/10 bg-[rgba(17,8,14,0.96)] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
          <div className="px-3 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-dim)]">
            Workspaces
          </div>

          <div className="space-y-1">
            {workspaces.map((workspace) => {
              const active = workspace.id === activeWorkspace.id;

              if (active) {
                return (
                  <div
                    className="rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(216,31,89,0.92),rgba(122,12,48,0.88))] px-3 py-3 text-sm font-medium text-white shadow-[0_14px_32px_rgba(216,31,89,0.22)]"
                    key={workspace.id}
                  >
                    {workspace.nome}
                  </div>
                );
              }

              return (
                <form
                  action={switchWorkspaceAction.bind(null, workspace.id, pathname)}
                  key={workspace.id}
                >
                  <button
                    className="block w-full rounded-2xl px-3 py-3 text-left text-sm text-[var(--text-secondary)] transition hover:bg-white/6 hover:text-white"
                    onClick={() => setOpen(false)}
                    type="submit"
                  >
                    {workspace.nome}
                  </button>
                </form>
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
