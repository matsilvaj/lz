import { type ReactNode } from "react";

import { MonitorTabs } from "./monitor-tabs";

export type MonitorTab = {
  href: string;
  label: string;
  value: "odds" | "duplo" | "converter-freebet" | "semanal-bet365";
};

const monitorTabs: MonitorTab[] = [
  { href: "/monitor/odds", label: "Odds", value: "odds" },
  { href: "/monitor/duplo", label: "Duplo", value: "duplo" },
  {
    href: "/monitor/converter-freebet",
    label: "Converter Freebet",
    value: "converter-freebet",
  },
  { href: "/monitor/semanal-bet365", label: "Semanal Bet365", value: "semanal-bet365" },
];

export function MonitorShell({
  activeTab,
  children,
}: {
  activeTab: MonitorTab["value"];
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <MonitorTabs activeTab={activeTab} tabs={monitorTabs} />

      {children}
    </div>
  );
}

export function MonitorPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="lz-panel rounded-[32px] p-6 md:p-8">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-dim)]">
          Em breve
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
          {description}
        </p>
      </div>
    </section>
  );
}
