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
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white p-6 md:flex-row md:items-start md:justify-between">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">{title}</h1>
        <p className="max-w-2xl text-sm leading-6 text-neutral-600">{description}</p>
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
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
    <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-neutral-950">{title}</h2>
        {description ? (
          <p className="text-sm leading-6 text-neutral-600">{description}</p>
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
    <div className="rounded-2xl border border-neutral-200 bg-white p-5">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950">{value}</p>
      {helper ? <p className="mt-2 text-sm leading-6 text-neutral-600">{helper}</p> : null}
    </div>
  );
}

export function StatusTag({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "warning";
}) {
  const toneClass =
    tone === "positive"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-neutral-200 bg-neutral-100 text-neutral-700";

  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${toneClass}`}>
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50 px-4 py-6 text-center">
      <p className="text-sm font-medium text-neutral-800">{title}</p>
      <p className="mt-2 text-sm leading-6 text-neutral-500">{description}</p>
    </div>
  );
}
