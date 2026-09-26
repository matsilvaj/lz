"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { MonitorTab } from "./monitor-shell";

// Abas do monitor: no celular viram um seletor, para não precisar arrastar de lado;
// a partir do tablet ficam lado a lado.
export function MonitorTabs({
  activeTab,
  tabs,
}: {
  activeTab: MonitorTab["value"];
  tabs: MonitorTab[];
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeLabel = tabs.find((tab) => tab.value === activeTab)?.label ?? "Monitor";

  useEffect(() => {
    if (!open) {
      return;
    }

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
  }, [open]);

  return (
    <>
      <div className="relative sm:hidden" ref={menuRef}>
        <button
          aria-expanded={open}
          aria-haspopup="menu"
          className="flex h-11 w-full items-center justify-between gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 text-sm font-semibold text-white transition hover:border-white/20"
          onClick={() => setOpen((current) => !current)}
          type="button"
        >
          <span className="truncate">{activeLabel}</span>
          <ChevronDown
            aria-hidden="true"
            className={`h-4 w-4 shrink-0 text-[var(--text-secondary)] transition ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        {open ? (
          <div className="lz-floating-panel absolute left-0 right-0 top-full z-[110] mt-2 rounded-[22px] border border-white/10 bg-[rgba(17,8,14,0.98)] p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
            {tabs.map((tab) => {
              const active = activeTab === tab.value;

              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-2xl px-3 py-2.5 text-sm font-semibold transition ${
                    active
                      ? "lz-button-primary"
                      : "text-[var(--text-secondary)] hover:bg-white/[0.055] hover:text-white"
                  }`}
                  href={tab.href}
                  key={tab.value}
                  onClick={() => setOpen(false)}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="hidden sm:block">
        <div className="lz-scrollbar-hidden overflow-x-auto">
          <div className="flex w-max min-w-full rounded-full border border-white/10 bg-white/[0.025] p-1 sm:min-w-0">
            {tabs.map((tab) => {
              const active = activeTab === tab.value;

              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex h-11 flex-1 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-4 text-sm font-semibold transition sm:min-w-[150px] sm:flex-none ${
                    active
                      ? "bg-[linear-gradient(180deg,rgba(211,27,91,0.95),rgba(163,8,63,0.95))] text-white shadow-[0_10px_28px_rgba(211,27,91,0.22)]"
                      : "text-[var(--text-secondary)] hover:bg-white/[0.055] hover:text-white"
                  }`}
                  href={tab.href}
                  key={tab.value}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
