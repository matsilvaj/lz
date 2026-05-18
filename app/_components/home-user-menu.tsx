"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { appNavigationItems, comingSoonNavigationItems } from "../(app)/navigation";

type HomeUserMenuProps = {
  firstName: string;
};

export function HomeUserMenu({ firstName }: HomeUserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigationItems = [...comingSoonNavigationItems, ...appNavigationItems];

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
    <div className="relative flex min-w-0 items-center justify-end gap-3" ref={menuRef}>
      <span className="hidden max-w-[180px] truncate text-sm font-semibold text-[var(--text-secondary)] sm:inline">
        Olá, {firstName}!
      </span>

      <button
        aria-expanded={open}
        aria-label="Abrir abas"
        aria-haspopup="menu"
        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/4 text-[var(--text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-[rgba(255,119,163,0.28)] hover:bg-white/8 focus:outline-none focus:ring-2 focus:ring-[rgba(255,119,163,0.34)]"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
          <path
            d="M4 7h16M4 12h16M4 17h16"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.8"
          />
        </svg>
      </button>

      {open ? (
        <div
          className="lz-home-menu-panel absolute right-0 top-full z-[60] mt-3 w-[min(18rem,calc(100vw-2rem))] rounded-[26px] border border-white/12 p-2 shadow-[0_28px_80px_rgba(0,0,0,0.58)]"
          role="menu"
        >
          <div className="grid gap-1">
            {navigationItems.map((item) => (
              <Link
                className="block rounded-2xl px-3 py-3 text-sm font-semibold text-[var(--text-secondary)] transition hover:bg-white/7 hover:text-white"
                href={item.href}
                key={item.href}
                onClick={() => setOpen(false)}
                role="menuitem"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
