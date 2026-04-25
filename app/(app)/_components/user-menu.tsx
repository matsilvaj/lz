"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { logout } from "@/app/auth/actions";

export function UserMenu() {
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
        aria-label="Abrir menu"
        aria-haspopup="menu"
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-300 text-neutral-900 transition hover:border-neutral-950 hover:bg-neutral-50"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <svg
          aria-hidden="true"
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-20 mt-2 min-w-40 rounded-2xl border border-neutral-200 bg-white p-2 shadow-sm">
          <Link
            className="block rounded-xl px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-950"
            href="/perfil"
            onClick={() => setOpen(false)}
          >
            Perfil
          </Link>

          <form action={logout}>
            <button
              className="block w-full rounded-xl px-3 py-2 text-left text-sm text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-950"
              type="submit"
            >
              Sair
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
