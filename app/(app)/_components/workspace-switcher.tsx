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
        className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:border-neutral-950 hover:bg-neutral-50"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        {activeWorkspace.nome}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-20 mt-2 min-w-56 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm">
          <div className="px-3 pb-2 pt-1 text-xs font-medium uppercase tracking-[0.12em] text-neutral-500">
            Workspaces
          </div>

          <div className="space-y-1">
            {workspaces.map((workspace) => {
              const active = workspace.id === activeWorkspace.id;

              if (active) {
                return (
                  <div
                    className="rounded-xl bg-neutral-950 px-3 py-2 text-sm font-medium text-white"
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
                    className="block w-full rounded-xl px-3 py-2 text-left text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-950"
                    onClick={() => setOpen(false)}
                    type="submit"
                  >
                    {workspace.nome}
                  </button>
                </form>
              );
            })}
          </div>

          <div className="mt-2 border-t border-neutral-200 pt-2">
            <Link
              className="block rounded-xl px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-950"
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
