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

export function formatFreebetCount(value: number) {
  const count = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;

  return `${formatNumber(count)} ${count === 1 ? "freebet" : "freebets"}`;
}

export function CloseIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 6L18 18M18 6L6 18"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function ChevronDownIcon({
  className = "h-4 w-4",
}: {
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function CopyIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 8.5A2.5 2.5 0 0 1 10.5 6h7A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-7A2.5 2.5 0 0 1 8 17.5v-9Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M5 15.5v-9A2.5 2.5 0 0 1 7.5 4h7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
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
