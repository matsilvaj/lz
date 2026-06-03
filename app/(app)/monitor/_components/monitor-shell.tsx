import Link from "next/link";
import { type ReactNode } from "react";

type MonitorTab = {
  href: string;
  label: string;
  value: "odds" | "duplo" | "converter-freebet";
};

const monitorTabs: MonitorTab[] = [
  { href: "/monitor/odds", label: "Odds", value: "odds" },
  { href: "/monitor/duplo", label: "Duplo", value: "duplo" },
  {
    href: "/monitor/converter-freebet",
    label: "Converter Freebet",
    value: "converter-freebet",
  },
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
      <div className="lz-scrollbar-hidden overflow-x-auto">
        <div className="inline-flex min-w-full rounded-full border border-white/10 bg-white/[0.025] p-1 sm:min-w-0">
          {monitorTabs.map((tab) => {
            const active = activeTab === tab.value;

            return (
              <Link
                className={`inline-flex h-11 min-w-[150px] flex-1 items-center justify-center rounded-full px-4 text-sm font-semibold transition sm:flex-none ${
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
