import { type ReactNode } from "react";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number) {
  return currencyFormatter.format(value);
}

export function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export function PageHeader({
  title,
  description,
  action,
  eyebrow = "LZ Control Center",
}: {
  title: string;
  description: string;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="lz-panel rounded-[30px] px-5 py-6 md:px-7 md:py-7">
      <div className="lz-hero-orb absolute -right-20 top-[-3.5rem] h-44 w-44 rounded-full" />
      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-3">
          <span className="inline-flex rounded-full border border-white/10 bg-white/4 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-dim)]">
            {eyebrow}
          </span>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-white md:text-[2.6rem]">
              {title}
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-[var(--text-muted)] md:text-base">
              {description}
            </p>
          </div>
        </div>

        {action ? <div className="relative shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="lz-panel space-y-4 rounded-[28px] p-5 md:p-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-white md:text-lg">{title}</h2>
        {description ? (
          <p className="text-sm leading-6 text-[var(--text-muted)]">{description}</p>
        ) : null}
      </div>

      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  return (
    <div className="lz-panel-subtle rounded-[24px] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-dim)]">
        {label}
      </p>
      <p className="mt-3 text-xl font-semibold tracking-tight text-white md:text-2xl">{value}</p>
      {helper ? (
        <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{helper}</p>
      ) : null}
    </div>
  );
}

export function StatusTag({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "warning" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "border-[rgba(73,212,166,0.2)] bg-[rgba(73,212,166,0.12)] text-[var(--positive)]"
      : tone === "negative"
        ? "border-[rgba(255,107,133,0.2)] bg-[rgba(255,107,133,0.12)] text-[var(--negative)]"
      : tone === "warning"
        ? "border-[rgba(255,190,115,0.2)] bg-[rgba(255,190,115,0.12)] text-[var(--warning)]"
        : "border-white/10 bg-white/5 text-[var(--text-secondary)]";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${toneClass}`}>
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  eyebrow = "Sem registros",
}: {
  title: string;
  description: string;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-dashed border-white/12 bg-[rgba(255,255,255,0.025)] px-5 py-8 text-center">
      <div className="absolute left-1/2 top-0 h-32 w-32 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,119,163,0.14),transparent_72%)]" />
      <div className="relative mx-auto max-w-xl">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[var(--accent-gold)] shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
          <svg
            aria-hidden="true"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M6.75 6.75h10.5M6.75 12h10.5M6.75 17.25h6.5"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.8"
            />
          </svg>
        </div>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-dim)]">
          {eyebrow}
        </p>
        <p className="mt-3 text-base font-semibold text-white md:text-lg">{title}</p>
        <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">{description}</p>
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}
