"use client";

// Card de sinal das telas do monitor (Duplo, Semanal e Converter).

import Link from "next/link";
import { type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";

import { ExchangeCommissionTag } from "@/app/(app)/_components/exchange-commission-tag";
import { FavoriteStarButton } from "@/app/(app)/_components/favorite-star-button";
import { TrendingBadge } from "@/app/(app)/_components/trending-badge";
import type { DuploEvent, DuploOpportunityLine } from "@/lib/monitor-odds/duplo";
import {
  formatFixtureTeams,
  formatLeagueLine,
  formatSignalDate,
  formatSignalTime,
  getRelativeDateLabel,
} from "@/lib/monitor-odds/signal-helpers";

import { BookmakerEventLink } from "./signal-controls";

export type SignalCardLine = Pick<
  DuploOpportunityLine,
  | "bookmakerName"
  | "bookmakerSlug"
  | "commission"
  | "eventUrl"
  | "odd"
  | "paCategory"
  | "rawOdd"
  | "selectionLabel"
> & {
  role?: "freebet" | "protection";
};

export function SignalCard({
  event,
  favorite,
  href,
  isLineHighlighted,
  lines,
  modeLabel,
  onToggleCalculator,
  onToggleFavorite,
  result,
  selected,
  showRelativeDateLabel,
  trending,
  wideResult = false,
}: {
  event: DuploEvent;
  favorite: boolean;
  href: string;
  // Semanal Bet365: destaca as linhas da casa obrigatória.
  isLineHighlighted?: (line: SignalCardLine) => boolean;
  lines: SignalCardLine[];
  modeLabel: string;
  onToggleCalculator: () => void;
  onToggleFavorite: () => void;
  // Valor da coluna da direita (lucro no Duplo, conversão no Converter).
  result: ReactNode;
  selected: boolean;
  showRelativeDateLabel: boolean;
  trending: boolean;
  wideResult?: boolean;
}) {
  const teams = formatFixtureTeams(event);
  const relativeDateLabel = showRelativeDateLabel
    ? getRelativeDateLabel(event.starts_at)
    : null;

  return (
    <article
      className={`group relative rounded-[24px] border p-4 transition ${
        selected
          ? "border-[rgba(191,219,254,0.58)] bg-[rgba(59,130,246,0.11)] shadow-[0_0_22px_rgba(147,197,253,0.1)]"
          : "border-white/10 bg-white/[0.026] hover:border-[rgba(255,139,187,0.28)] hover:bg-white/[0.04]"
      }`}
    >
      <Link
        aria-label={`Abrir análise de ${teams.label}`}
        className="absolute inset-0 z-0 rounded-[24px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        href={href}
      />

      <div
        className={`pointer-events-none relative z-10 grid gap-4 lg:items-center ${
          wideResult
            ? "lg:grid-cols-[minmax(260px,0.9fr)_minmax(460px,1.35fr)_170px]"
            : "lg:grid-cols-[minmax(260px,0.9fr)_minmax(460px,1.35fr)_150px]"
        }`}
      >
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
            <FavoriteStarButton
              active={favorite}
              label={teams.label}
              onToggle={onToggleFavorite}
              size="sm"
            />
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {formatSignalDate(event.starts_at)}
            </span>
            {relativeDateLabel ? (
              <span className="rounded-full border border-[rgba(45,212,191,0.28)] bg-[rgba(45,212,191,0.09)] px-3 py-1 text-[var(--positive)]">
                {relativeDateLabel}
              </span>
            ) : null}
            <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1">
              {formatSignalTime(event.starts_at)}
            </span>
            {trending ? <TrendingBadge /> : null}
          </div>

          <h3 className="truncate text-base font-semibold text-white md:text-lg">
            {teams.label}
          </h3>
          <p className="mt-1 truncate text-xs font-medium text-[var(--text-muted)]">
            {formatLeagueLine(event)}
          </p>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          {lines.map((line, index) => (
            <SignalLine
              highlighted={isLineHighlighted?.(line) ?? false}
              key={`${line.bookmakerSlug}-${line.selectionLabel}-${line.role ?? ""}-${index}`}
              line={line}
              onToggle={onToggleCalculator}
              selected={selected}
            />
          ))}
        </div>

        <div
          className={`flex flex-wrap items-center gap-2 lg:flex-col lg:items-end ${
            wideResult ? "lg:w-[170px]" : "lg:w-[150px]"
          }`}
        >
          <span className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
            {modeLabel}
          </span>
          {result}
        </div>
      </div>
    </article>
  );
}


function SignalLine({
  highlighted = false,
  line,
  onToggle,
  selected,
}: {
  highlighted?: boolean;
  line: SignalCardLine;
  onToggle: () => void;
  selected: boolean;
}) {
  return (
    <div
      aria-pressed={selected}
      className={`pointer-events-auto min-w-0 cursor-pointer rounded-2xl border px-3 py-2.5 transition ${
        selected
          ? "border-[rgba(191,219,254,0.66)] bg-[rgba(59,130,246,0.14)] shadow-[0_0_18px_rgba(147,197,253,0.12)]"
          : highlighted
            ? "border-[rgba(250,204,21,0.45)] bg-[rgba(250,204,21,0.08)] hover:border-[rgba(250,204,21,0.6)]"
            : "border-white/8 bg-white/[0.035] hover:border-[rgba(255,139,187,0.24)] hover:bg-white/[0.055]"
      }`}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onKeyDown={(keyboardEvent: ReactKeyboardEvent<HTMLDivElement>) => {
        if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") {
          return;
        }

        keyboardEvent.preventDefault();
        keyboardEvent.stopPropagation();
        onToggle();
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <BookmakerEventLink
            bookmakerName={line.bookmakerName}
            className="min-w-0 truncate text-xs font-semibold text-white no-underline transition hover:text-[var(--accent-soft)] focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
            eventUrl={line.eventUrl}
          >
            {line.bookmakerName}
          </BookmakerEventLink>
          {line.paCategory === "COM_PA" ? (
            <span className="shrink-0 rounded-full border border-[rgba(45,212,191,0.32)] bg-[rgba(45,212,191,0.12)] px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
              PA
            </span>
          ) : null}
          <ExchangeCommissionTag commission={line.commission} rawOdd={line.rawOdd} />
          {line.role === "freebet" ? (
            <span className="shrink-0 rounded-full border border-[rgba(255,255,255,0.12)] bg-white/[0.045] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
              Freebet
            </span>
          ) : null}
        </span>
        <span className="text-sm font-semibold text-white">
          {line.odd.toFixed(3)}
        </span>
      </div>
    </div>
  );
}


export function SignalSkeleton({ wideResult = false }: { wideResult?: boolean }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.026] p-4">
      <div
        className={`grid animate-pulse gap-4 lg:items-center ${
          wideResult
            ? "lg:grid-cols-[minmax(260px,0.9fr)_minmax(460px,1.35fr)_170px]"
            : "lg:grid-cols-[minmax(260px,0.9fr)_minmax(460px,1.35fr)_150px]"
        }`}
      >
        <div>
          <div className="mb-3 flex gap-2">
            <span className="h-6 w-20 rounded-full bg-white/8" />
            <span className="h-6 w-14 rounded-full bg-white/8" />
          </div>
          <span className="block h-5 w-64 max-w-full rounded-full bg-white/10" />
          <span className="mt-2 block h-3 w-44 rounded-full bg-white/8" />
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <span className={`${wideResult ? "h-16" : "h-14"} rounded-2xl bg-white/8`} />
          <span className={`${wideResult ? "h-16" : "h-14"} rounded-2xl bg-white/8`} />
          <span className={`${wideResult ? "h-16" : "h-14"} rounded-2xl bg-white/8`} />
        </div>
        <span className={`h-8 rounded-full bg-white/8 ${wideResult ? "w-24" : "w-20"}`} />
      </div>
    </div>
  );
}

