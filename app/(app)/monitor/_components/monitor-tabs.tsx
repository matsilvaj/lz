"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import type { MonitorTab } from "./monitor-shell";

// Abas do monitor: numa linha só, com rolagem lateral no celular e a ativa sempre visível.
export function MonitorTabs({
  activeTab,
  tabs,
}: {
  activeTab: MonitorTab["value"];
  tabs: MonitorTab[];
}) {
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    stripRef.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [activeTab]);

  return (
    <div className="lz-scrollbar-hidden overflow-x-auto" ref={stripRef}>
      <div className="flex w-max min-w-full rounded-full border border-white/10 bg-white/[0.025] p-1 sm:min-w-0">
        {tabs.map((tab) => {
          const active = activeTab === tab.value;

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`inline-flex h-10 flex-1 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-4 text-sm font-semibold transition sm:h-11 sm:min-w-[150px] sm:flex-none ${
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
  );
}
