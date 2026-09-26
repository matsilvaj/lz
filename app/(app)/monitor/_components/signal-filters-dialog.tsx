"use client";

// Diálogo de filtros das telas de sinais (Duplo, Semanal e Converter).

import { Check, Star } from "lucide-react";

import {
  signalDateFilterLabels,
  signalDateFilters,
  signalModeFilters,
  type FilterOption,
  type SignalDateFilter,
  type SignalModeFilter,
} from "@/lib/monitor-odds/signal-helpers";

import { FiltersDialog } from "@/app/(app)/_components/filters-dialog";

import {
  BookmakerToggleButton,
  DateFilterButton,
  ModeButton,
} from "./signal-controls";

export function SignalFiltersDialog({
  activeMode,
  activeDateFilter,
  availableBookmakers,
  availableLeagues,
  counts,
  lockedBookmakerKey = null,
  modeLabels,
  modeTitle,
  hiddenBookmakers,
  hiddenLeagueKeys,
  onClose,
  onShowAllLeagues,
  onHideAllLeagues,
  onShowAllBookmakers,
  onHideAllBookmakers,
  onDateFilterChange,
  onModeChange,
  onClearPreset,
  onlyFavorites,
  onToggleOnlyFavorites,
  onReset,
  onSavePreset,
  hasPreset,
  savingPreset,
  onToggleLeague,
  onToggleBookmaker,
  title,
}: {
  activeMode: SignalModeFilter;
  activeDateFilter: SignalDateFilter;
  availableBookmakers: FilterOption[];
  availableLeagues: FilterOption[];
  counts: Record<SignalModeFilter, number>;
  // Casa que não pode ser escondida (Converter: casa da freebet).
  lockedBookmakerKey?: string | null;
  modeLabels: Record<SignalModeFilter, string>;
  modeTitle: string;
  hiddenBookmakers: ReadonlySet<string>;
  hiddenLeagueKeys: ReadonlySet<string>;
  onClose: () => void;
  onShowAllLeagues: () => void;
  onHideAllLeagues: () => void;
  onShowAllBookmakers: () => void;
  onHideAllBookmakers: () => void;
  onDateFilterChange: (filter: SignalDateFilter) => void;
  onModeChange: (mode: SignalModeFilter) => void;
  onClearPreset: () => void;
  onlyFavorites: boolean;
  onToggleOnlyFavorites: () => void;
  onReset: () => void;
  onSavePreset: () => void;
  hasPreset: boolean;
  savingPreset: boolean;
  onToggleLeague: (leagueKey: string) => void;
  onToggleBookmaker: (key: string) => void;
  title: string;
}) {
  return (
    <FiltersDialog
      footerExtra={
        <>
          <button
            className="text-[var(--text-secondary)] transition hover:text-white disabled:opacity-60"
            disabled={savingPreset}
            onClick={onSavePreset}
            type="button"
          >
            Salvar como padrão
          </button>
          {hasPreset ? (
            <button
              className="text-[var(--text-dim)] transition hover:text-white disabled:opacity-60"
              disabled={savingPreset}
              onClick={onClearPreset}
              type="button"
            >
              Remover padrão
            </button>
          ) : null}
        </>
      }
      onClose={onClose}
      onReset={onReset}
      title={title}
    >
      <button
        aria-pressed={onlyFavorites}
        className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
          onlyFavorites
            ? "border-[rgba(251,191,36,0.4)] bg-[rgba(251,191,36,0.12)] text-white"
            : "border-white/10 bg-white/[0.035] text-[var(--text-secondary)] hover:border-white/20 hover:text-white"
        }`}
        onClick={onToggleOnlyFavorites}
        type="button"
      >
        <span className="inline-flex items-center gap-2">
          <Star
            aria-hidden="true"
            className="h-4 w-4 text-amber-300"
            fill={onlyFavorites ? "currentColor" : "none"}
          />
          Só favoritos
        </span>
        <span className="text-xs font-medium text-[var(--text-dim)]">
          Jogos favoritos e campeonatos fixados
        </span>
      </button>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-white">Período</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {signalDateFilters.map((filter) => (
            <DateFilterButton
              active={activeDateFilter === filter}
              key={filter}
              label={signalDateFilterLabels[filter]}
              onClick={() => onDateFilterChange(filter)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-white">{modeTitle}</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {signalModeFilters.map((mode) => (
            <ModeButton
              active={activeMode === mode}
              count={counts[mode]}
              key={mode}
              label={modeLabels[mode]}
              onClick={() => onModeChange(mode)}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">Campeonatos</h3>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <button
              className="text-[var(--text-secondary)] transition hover:text-white"
              onClick={onShowAllLeagues}
              type="button"
            >
              Marcar todos
            </button>
            <button
              className="text-[var(--text-dim)] transition hover:text-white"
              onClick={onHideAllLeagues}
              type="button"
            >
              Desmarcar todos
            </button>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {availableLeagues.map((league) => {
            const visible = !hiddenLeagueKeys.has(league.key);

            return (
              <button
                aria-pressed={visible}
                className={`inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${
                  visible
                    ? "border-[rgba(211,27,91,0.78)] bg-[rgba(211,27,91,0.2)] text-white shadow-[0_12px_28px_rgba(211,27,91,0.12)]"
                    : "border-white/10 bg-white/[0.035] text-[var(--text-dim)] hover:border-white/18 hover:bg-white/[0.06] hover:text-white"
                }`}
                key={league.key}
                onClick={() => onToggleLeague(league.key)}
                type="button"
              >
                {visible ? <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> : null}
                <span className="truncate">{league.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">Casas</h3>
          <div className="flex items-center gap-3 text-xs font-semibold">
            <button
              className="text-[var(--text-secondary)] transition hover:text-white"
              onClick={onShowAllBookmakers}
              type="button"
            >
              Marcar todos
            </button>
            <button
              className="text-[var(--text-dim)] transition hover:text-white"
              onClick={onHideAllBookmakers}
              type="button"
            >
              Desmarcar todos
            </button>
          </div>
        </div>

        {availableBookmakers.length ? (
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {availableBookmakers.map((bookmaker) => {
              const disabled = Boolean(lockedBookmakerKey) && bookmaker.key === lockedBookmakerKey;

              return (
                <BookmakerToggleButton
                  active={!hiddenBookmakers.has(bookmaker.key)}
                  disabled={disabled}
                  key={bookmaker.key}
                  name={bookmaker.name}
                  onClick={() => onToggleBookmaker(bookmaker.key)}
                />
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-sm text-[var(--text-muted)]">
            Nenhuma casa encontrada.
          </div>
        )}
      </section>
    </FiltersDialog>
  );
}
