"use client";

import {
  Check,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  CalculatorSelectionDock,
  createCalculatorSelectionId,
  mergeCalculatorSelections,
  type CalculatorSelectionLine,
} from "@/app/_components/calculator-selection-dock";
import { FavoriteStarButton } from "@/app/(app)/_components/favorite-star-button";
import { TrendingBadge } from "@/app/(app)/_components/trending-badge";
import { useMonitorFavorites } from "@/app/(app)/_components/use-monitor-favorites";
import { useTrendingFixtures } from "@/app/(app)/_components/use-trending-fixtures";
import { useScreenFilters } from "@/app/(app)/_components/use-screen-filters";
import { ExchangeCommissionTag } from "@/app/(app)/_components/exchange-commission-tag";
import { redirectToLoginOnUnauthorized } from "@/lib/auth/client-redirect";
import { getFavoriteLeagueKey, sortByFavorites, sortByTrending } from "@/lib/monitor-odds/favorites";
import {
  formatDuploPercent,
  BET365_BOOKMAKER_KEY,
  BET365_BOOKMAKER_LABEL,
  REQUIRED_BOOKMAKER_PARAM,
  getBestDuploOpportunities,
  getBestDuploOpportunitiesWithBookmaker,
  isRequiredBookmaker,
  getDuploModeLabel,
  type DuploEvent,
  type DuploOddItem,
  type DuploOpportunity,
} from "@/lib/monitor-odds/duplo";
import { fetchOddsSnapshots } from "@/lib/monitor-odds/odds-fetch";
import {
  useMonitorOddsStatusFeed,
  type MonitorOddsStatus,
} from "@/lib/monitor-odds/use-status-feed";
import {
  getPageSlice,
  SignalPagination,
} from "../_components/signal-pagination";
import {
  BookmakerEventLink,
  BookmakerToggleButton,
  DateFilterButton,
  ModeButton,
  SortMenu,
} from "@/app/(app)/monitor/_components/signal-controls";
import {
  areCalculatorSelectionsActive,
  formatFixtureTeams,
  formatLeagueLine,
  formatSignalDate,
  formatSignalTime,
  getAvailableBookmakers,
  getAvailableLeagues,
  getEventTimeValue,
  getLeagueKey,
  getModeCounts,
  getRelativeDateLabel,
  getSignalProfitClass,
  isEventInDateFilter,
  type FilterOption,
  type SignalDateFilter,
} from "@/lib/monitor-odds/signal-helpers";

type DateFilter = SignalDateFilter;
type ModeFilter = "all" | "sem_pa" | "pa_um_lado" | "pa_dois_lados";
type SortMode =
  | "profit_desc"
  | "profit_asc"
  | "nearest"
  | "farthest"
  | "favorites"
  | "trending";

type EventsRequest =
  | {
      kind: "available";
    }
  | {
      kind: "search";
      search: string;
    };

type EventsResponse = {
  events?: DuploEvent[];
  fixtures_version?: string | null;
  latest_odd_updated_at?: string | null;
  odds_version?: string | null;
};

type OddsSnapshot = {
  fixture_id: string;
  latest_odd_updated_at: string | null;
  odds: DuploOddItem[];
};

type SignalRow = {
  event: DuploEvent;
  opportunity: DuploOpportunity;
};

// Um jogo ja analisado. A analise e o custo dominante da tela, entao ela roda
// uma vez por jogo e alimenta tanto as linhas visiveis quanto os contadores.
type AnalyzedEvent = {
  event: DuploEvent;
  opportunities: DuploOpportunity[];
};

type BookmakerFilterOption = FilterOption;

type LeagueFilterOption = FilterOption;

type SearchState = {
  error: string | null;
  events: DuploEvent[];
  loading: boolean;
  refreshingOdds: boolean;
};

const modeFilters: ModeFilter[] = ["all", "pa_dois_lados", "pa_um_lado", "sem_pa"];
const dateFilters: DateFilter[] = ["today", "tomorrow", "all"];
const dateFilterLabels: Record<DateFilter, string> = {
  all: "Todos",
  today: "Hoje",
  tomorrow: "Amanhã",
};

const sortLabels: Record<SortMode, string> = {
  farthest: "Mais distante",
  nearest: "Mais próximo",
  profit_asc: "Menor lucro",
  profit_desc: "Maior lucro",
  favorites: "Favoritos primeiro",
  trending: "Mais acessados",
};

const sortOptions: SortMode[] = [
  "profit_desc",
  "profit_asc",
  "favorites",
  "trending",
  "nearest",
  "farthest",
];
// A consulta de status roda a cada 4s (barata), mas rebaixar as odds de todos
// os jogos custa ~200 KB, entao a lista se atualiza no maximo a cada 20s.
const oddsRefreshIntervalMs = 20_000;
const duploEventsMemoryLimit = 20;
const duploOddsSnapshotMemoryLimit = 300;
const duploEventsByRequestKey = new Map<string, DuploEvent[]>();
const duploOddsSnapshotsByFixtureId = new Map<string, OddsSnapshot>();

function getEventsRequestParams(request: EventsRequest) {
  const params = new URLSearchParams();

  if (request.kind === "search") {
    params.set("q", request.search);
  }

  return params;
}

function getEventsRequestKey(request: EventsRequest) {
  const params = getEventsRequestParams(request).toString();
  return params || "available";
}

function isSameEventsRequest(
  left: EventsRequest | null,
  right: EventsRequest,
) {
  return Boolean(left && getEventsRequestKey(left) === getEventsRequestKey(right));
}

function cloneDuploOdd(odd: DuploOddItem): DuploOddItem {
  return { ...odd };
}

function cloneDuploEvent(event: DuploEvent): DuploEvent {
  return {
    ...event,
    odds: event.odds.map(cloneDuploOdd),
  };
}

function getSnapshotFromEvent(event: DuploEvent): OddsSnapshot | null {
  if (!event.odds.length) {
    return null;
  }

  return {
    fixture_id: event.fixture_id,
    latest_odd_updated_at: null,
    odds: event.odds.map(cloneDuploOdd),
  };
}

function rememberOddsSnapshots(snapshots: OddsSnapshot[]) {
  for (const snapshot of snapshots) {
    if (!snapshot.fixture_id || !snapshot.odds.length) {
      continue;
    }

    duploOddsSnapshotsByFixtureId.delete(snapshot.fixture_id);
    duploOddsSnapshotsByFixtureId.set(snapshot.fixture_id, {
      ...snapshot,
      odds: snapshot.odds.map(cloneDuploOdd),
    });
  }

  while (duploOddsSnapshotsByFixtureId.size > duploOddsSnapshotMemoryLimit) {
    const oldestFixtureId = duploOddsSnapshotsByFixtureId.keys().next().value;

    if (!oldestFixtureId) {
      return;
    }

    duploOddsSnapshotsByFixtureId.delete(oldestFixtureId);
  }
}

function rememberEventOdds(events: DuploEvent[]) {
  const snapshots = events
    .map(getSnapshotFromEvent)
    .filter((snapshot): snapshot is OddsSnapshot => Boolean(snapshot));

  rememberOddsSnapshots(snapshots);
}

function hydrateEventsWithRememberedOdds(events: DuploEvent[]) {
  const snapshots = events
    .map((event) => duploOddsSnapshotsByFixtureId.get(event.fixture_id))
    .filter((snapshot): snapshot is OddsSnapshot => Boolean(snapshot));

  if (!snapshots.length) {
    return events;
  }

  return mergeOddsSnapshots(events, snapshots);
}

function rememberDuploEvents(request: EventsRequest, events: DuploEvent[]) {
  const key = getEventsRequestKey(request);

  if (!events.length) {
    duploEventsByRequestKey.delete(key);
    return;
  }

  duploEventsByRequestKey.delete(key);
  duploEventsByRequestKey.set(key, events.map(cloneDuploEvent));
  rememberEventOdds(events);

  while (duploEventsByRequestKey.size > duploEventsMemoryLimit) {
    const oldestKey = duploEventsByRequestKey.keys().next().value;

    if (!oldestKey) {
      return;
    }

    duploEventsByRequestKey.delete(oldestKey);
  }
}

function getRememberedDuploEvents(request: EventsRequest) {
  return (
    duploEventsByRequestKey
      .get(getEventsRequestKey(request))
      ?.map(cloneDuploEvent) ?? []
  );
}

function mergeOddsSnapshots(events: DuploEvent[], snapshots: OddsSnapshot[]) {
  const snapshotsByFixtureId = new Map(
    snapshots.map((snapshot) => [snapshot.fixture_id, snapshot]),
  );

  return events.map((event) => {
    const snapshot = snapshotsByFixtureId.get(event.fixture_id);

    if (!snapshot?.odds?.length) {
      return event;
    }

    const odds = snapshot.odds.map((odd) => ({
      ...odd,
      fixture_id: event.fixture_id,
      fixture_name: event.fixture_name,
      home_team: event.home_team,
      away_team: event.away_team,
      starts_at: event.starts_at,
      league_name: event.league_name,
      league_country: event.league_country,
    }));

    return {
      ...event,
      latest_odd_updated_at: snapshot.latest_odd_updated_at,
      odds,
    };
  });
}

function getBookmakerKey(slug: string | null | undefined, name: string) {
  return (slug?.trim() || name.trim() || "casa").toLocaleLowerCase("pt-BR");
}

function getCalculatorMeta(marketLabel: string) {
  return marketLabel.trim().toUpperCase() === "1X2"
    ? undefined
    : marketLabel;
}

function getOpportunityCalculatorSelections(
  fixtureId: string,
  opportunity: DuploOpportunity,
  eventName?: string,
): CalculatorSelectionLine[] {
  return opportunity.lines.map((line) => ({
    eventName,
    house: line.bookmakerName,
    id: createCalculatorSelectionId([
      fixtureId,
      line.bookmakerSlug || line.bookmakerName,
      line.marketLabel,
      line.selectionLabel,
      line.paCategory,
    ]),
    meta: getCalculatorMeta(line.marketLabel),
    commission: line.commission,
    odd: line.rawOdd,
    pa: line.paCategory === "COM_PA",
    selectionKey: line.selectionLabel,
    selectionLabel: line.selectionLabel,
  }));
}

function filterEventBookmakers(
  event: DuploEvent,
  hiddenBookmakers: ReadonlySet<string>,
) {
  if (!hiddenBookmakers.size) {
    return event;
  }

  return {
    ...event,
    odds: event.odds.filter((odd) => {
      return !hiddenBookmakers.has(
        getBookmakerKey(odd.bookmaker_slug, odd.bookmaker_name),
      );
    }),
  };
}

function sortSignalRows(rows: SignalRow[], mode: SortMode) {
  const now = Date.now();

  return [...rows].sort((left, right) => {
    if (mode === "profit_asc") {
      return left.opportunity.profitPercent - right.opportunity.profitPercent;
    }


    if (mode === "nearest") {
      return Math.abs(getEventTimeValue(left.event) - now) - Math.abs(getEventTimeValue(right.event) - now);
    }

    if (mode === "farthest") {
      return Math.abs(getEventTimeValue(right.event) - now) - Math.abs(getEventTimeValue(left.event) - now);
    }

    const profitOrder =
      right.opportunity.profitPercent - left.opportunity.profitPercent;

    if (profitOrder !== 0) return profitOrder;
    return getEventTimeValue(left.event) - getEventTimeValue(right.event);
  });
}

function getAnalyzedEvents(
  events: DuploEvent[],
  dateFilter: DateFilter,
  hiddenBookmakers: ReadonlySet<string>,
  hiddenLeagueKeys: ReadonlySet<string>,
  requiredBookmaker: string | null,
): AnalyzedEvent[] {
  const analyzed: AnalyzedEvent[] = [];

  for (const event of events) {
    if (!isEventInDateFilter(event, dateFilter)) {
      continue;
    }

    if (hiddenLeagueKeys.has(getLeagueKey(event))) {
      continue;
    }

    const filteredEvent = filterEventBookmakers(event, hiddenBookmakers);

    analyzed.push({
      event: filteredEvent,
      opportunities: requiredBookmaker
        ? getBestDuploOpportunitiesWithBookmaker(filteredEvent, requiredBookmaker)
        : getBestDuploOpportunities(filteredEvent),
    });
  }

  return analyzed;
}

function getSignalRows(
  analyzedEvents: AnalyzedEvent[],
  mode: ModeFilter,
  sortMode: SortMode = "profit_desc",
): SignalRow[] {
  const rows: SignalRow[] = [];

  for (const { event, opportunities } of analyzedEvents) {
    const opportunity =
      mode === "all"
        ? opportunities[0]
        : opportunities.find((candidate) => candidate.mode === mode);

    if (opportunity) {
      rows.push({ event, opportunity });
    }
  }

  return sortSignalRows(rows, sortMode);
}

// Quantos jogos tem ao menos uma oportunidade de cada modo. Antes isso refazia
// a analise inteira uma vez por modo, so para exibir um numero no badge.
function FiltersDialog({
  activeMode,
  activeDateFilter,
  availableBookmakers,
  availableLeagues,
  counts,
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
}: {
  activeMode: ModeFilter;
  activeDateFilter: DateFilter;
  availableBookmakers: BookmakerFilterOption[];
  availableLeagues: LeagueFilterOption[];
  counts: Record<ModeFilter, number>;
  hiddenBookmakers: ReadonlySet<string>;
  hiddenLeagueKeys: ReadonlySet<string>;
  onClose: () => void;
  onShowAllLeagues: () => void;
  onHideAllLeagues: () => void;
  onShowAllBookmakers: () => void;
  onHideAllBookmakers: () => void;
  onDateFilterChange: (filter: DateFilter) => void;
  onModeChange: (mode: ModeFilter) => void;
  onClearPreset: () => void;
  onlyFavorites: boolean;
  onToggleOnlyFavorites: () => void;
  onReset: () => void;
  onSavePreset: () => void;
  hasPreset: boolean;
  savingPreset: boolean;
  onToggleLeague: (leagueKey: string) => void;
  onToggleBookmaker: (key: string) => void;
}) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[170] flex items-center justify-center overflow-hidden bg-black/65 p-3 backdrop-blur-md sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        aria-modal="true"
        className="lz-floating-panel max-h-[calc(100dvh-24px)] w-full min-w-0 max-w-3xl overflow-y-auto rounded-[24px] border border-white/10 bg-[rgba(18,5,13,0.96)] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.48)] sm:max-h-[calc(100dvh-48px)] sm:rounded-[28px] sm:p-5"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-dim)]">
              Filtros
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white sm:text-xl">
              Monitor de duplo
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              aria-label="Limpar filtros"
              className="inline-flex h-11 w-11 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] text-xs font-semibold text-[var(--text-secondary)] transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white sm:w-auto sm:px-4"
              onClick={onReset}
              type="button"
            >
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Limpar filtros</span>
            </button>
            <button
              aria-label="Fechar filtros"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-[var(--text-secondary)] transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
              onClick={onClose}
              type="button"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-5 space-y-5">
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
              {dateFilters.map((filter) => (
                <DateFilterButton
                  active={activeDateFilter === filter}
                  key={filter}
                  label={dateFilterLabels[filter]}
                  onClick={() => onDateFilterChange(filter)}
                />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-white">Tipo de sinal</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {modeFilters.map((mode) => (
                <ModeButton
                  active={activeMode === mode}
                  count={counts[mode]}
                  key={mode}
                  label={getDuploModeLabel(mode)}
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
                {availableBookmakers.map((bookmaker) => (
                  <BookmakerToggleButton
                    active={!hiddenBookmakers.has(bookmaker.key)}
                    key={bookmaker.key}
                    name={bookmaker.name}
                    onClick={() => onToggleBookmaker(bookmaker.key)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-sm text-[var(--text-muted)]">
                Nenhuma casa encontrada.
              </div>
            )}
          </section>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
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
          </div>
          <button
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[rgba(211,27,91,0.7)] bg-[linear-gradient(180deg,rgba(211,27,91,0.95),rgba(163,8,63,0.95))] px-6 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(211,27,91,0.2)] transition hover:brightness-110"
            onClick={onClose}
            type="button"
          >
            <Check aria-hidden="true" className="h-4 w-4" />
            <span>Aplicar</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function OpportunityLineMini({
  highlighted = false,
  line,
  onToggle,
  selected,
}: {
  highlighted?: boolean;
  line: DuploOpportunity["lines"][number];
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
        </span>
        <span className="text-sm font-semibold text-white">
          {line.odd.toFixed(3)}
        </span>
      </div>
    </div>
  );
}

function SignalCard({
  highlightBookmaker,
  onToggleCalculator,
  row,
  selectedIds,
  showRelativeDateLabel,
  favorite,
  trending,
  onToggleFavorite,
}: {
  highlightBookmaker: string | null;
  onToggleCalculator: (row: SignalRow) => void;
  row: SignalRow;
  selectedIds: ReadonlySet<string>;
  showRelativeDateLabel: boolean;
  favorite: boolean;
  trending: boolean;
  onToggleFavorite: () => void;
}) {
  const { event, opportunity } = row;
  const teams = formatFixtureTeams(event);
  const relativeDateLabel = showRelativeDateLabel
    ? getRelativeDateLabel(event.starts_at)
    : null;
  const opportunitySelections = getOpportunityCalculatorSelections(
    event.fixture_id,
    opportunity,
  );
  const selected = areCalculatorSelectionsActive(
    selectedIds,
    opportunitySelections,
  );

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
        href={`/monitor/odds/${encodeURIComponent(event.fixture_id)}${
          highlightBookmaker
            ? `?${REQUIRED_BOOKMAKER_PARAM}=${encodeURIComponent(highlightBookmaker)}`
            : ""
        }`}
      />

      <div className="pointer-events-none relative z-10 grid gap-4 lg:grid-cols-[minmax(260px,0.9fr)_minmax(460px,1.35fr)_150px] lg:items-center">
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
          {opportunity.lines.map((line, index) => (
            <OpportunityLineMini
              highlighted={Boolean(
                highlightBookmaker &&
                  isRequiredBookmaker(
                    { bookmaker_name: line.bookmakerName, bookmaker_slug: line.bookmakerSlug },
                    highlightBookmaker,
                  ),
              )}
              key={`${line.bookmakerSlug}-${line.selectionLabel}-${index}`}
              line={line}
              onToggle={() => onToggleCalculator(row)}
              selected={selected}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:w-[150px] lg:flex-col lg:items-end">
          <span className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
            {opportunity.modeLabel}
          </span>
          <strong className={`text-lg font-semibold tabular-nums ${getSignalProfitClass(opportunity.profitPercent)}`}>
            {formatDuploPercent(opportunity.profitPercent)}
          </strong>
        </div>
      </div>
    </article>
  );
}

function SignalSkeleton() {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.026] p-4">
      <div className="grid animate-pulse gap-4 lg:grid-cols-[minmax(260px,0.9fr)_minmax(460px,1.35fr)_150px] lg:items-center">
        <div>
          <div className="mb-3 flex gap-2">
            <span className="h-6 w-20 rounded-full bg-white/8" />
            <span className="h-6 w-14 rounded-full bg-white/8" />
          </div>
          <span className="block h-5 w-64 max-w-full rounded-full bg-white/10" />
          <span className="mt-2 block h-3 w-44 rounded-full bg-white/8" />
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <span className="h-14 rounded-2xl bg-white/8" />
          <span className="h-14 rounded-2xl bg-white/8" />
          <span className="h-14 rounded-2xl bg-white/8" />
        </div>
        <span className="h-8 w-20 rounded-full bg-white/8" />
      </div>
    </div>
  );
}

export type DoubleMonitorVariant = "duplo" | "semanal-bet365";

export function DoubleMonitorWorkspace({
  variant = "duplo",
}: {
  variant?: DoubleMonitorVariant;
}) {
  const requiredBookmaker = variant === "semanal-bet365" ? BET365_BOOKMAKER_KEY : null;
  const [query, setQuery] = useState("");
  const [activeDateFilter, setActiveDateFilter] = useState<DateFilter>("all");
  const [activeMode, setActiveMode] = useState<ModeFilter>("all");
  const [hiddenLeagueKeys, setHiddenLeagueKeys] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hiddenBookmakers, setHiddenBookmakers] = useState<string[]>([]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const { favoriteGames, favoriteLeagues, toggleGame } = useMonitorFavorites();
  const { trendingRank } = useTrendingFixtures();
  const [sortMode, setSortMode] = useState<SortMode>("profit_desc");
  const [page, setPage] = useState(1);
  const eventsRef = useRef<DuploEvent[]>([]);
  const oddsVersionRef = useRef<string | null>(null);
  const lastOddsRefreshAtRef = useRef(0);
  const [calculatorSelections, setCalculatorSelections] = useState<
    CalculatorSelectionLine[]
  >([]);
  const [state, setState] = useState<SearchState>({
    error: null,
    events: [],
    loading: true,
    refreshingOdds: false,
  });
  const activeRequestRef = useRef<EventsRequest | null>(null);

  const loadEvents = useCallback(
    async (
      request: EventsRequest,
      options: { signal?: AbortSignal; showLoading?: boolean } = {},
    ) => {
      activeRequestRef.current = request;

      if (options.showLoading !== false) {
        const rememberedEvents = getRememberedDuploEvents(request);

        setState({
          error: null,
          events: rememberedEvents,
          loading: !rememberedEvents.length,
          refreshingOdds: Boolean(rememberedEvents.length),
        });
      }

      try {
        const params = getEventsRequestParams(request);
        const response = await fetch(`/api/monitor-odds/events?${params.toString()}`, {
          cache: "no-store",
          signal: options.signal,
        });

        if (redirectToLoginOnUnauthorized(response)) {
          return;
        }

        if (!response.ok) {
          throw new Error("Não foi possível carregar os jogos.");
        }

        const payload = (await response.json()) as EventsResponse;
        if (
          options.signal?.aborted ||
          !isSameEventsRequest(activeRequestRef.current, request)
        ) {
          return;
        }

        const events = hydrateEventsWithRememberedOdds(payload.events ?? []);
        const oddsVersion =
          payload.odds_version ?? payload.latest_odd_updated_at ?? null;
        rememberDuploEvents(request, events);

        setState({
          error: null,
          events,
          loading: false,
          refreshingOdds: Boolean(events.length && oddsVersion),
        });

        if (!events.length || !oddsVersion) {
          return;
        }

        const oddsResult = await fetchOddsSnapshots<OddsSnapshot>(
          events.map((event) => event.fixture_id),
          oddsVersion,
          { signal: options.signal },
        );

        if (!oddsResult) {
          return;
        }

        if (
          options.signal?.aborted ||
          !isSameEventsRequest(activeRequestRef.current, request)
        ) {
          return;
        }

        if (oddsResult.complete) {
          rememberOddsSnapshots(oddsResult.snapshots);
        }

        const hydratedEvents = oddsResult.complete
          ? mergeOddsSnapshots(events, oddsResult.snapshots)
          : hydrateEventsWithRememberedOdds(events);
        rememberDuploEvents(request, hydratedEvents);

        setState({
          error: null,
          events: hydratedEvents,
          loading: false,
          refreshingOdds: false,
        });
      } catch (error) {
        if (
          (error instanceof DOMException && error.name === "AbortError") ||
          options.signal?.aborted ||
          !isSameEventsRequest(activeRequestRef.current, request)
        ) {
          return;
        }

        setState((current) => ({
          ...current,
          error:
            error instanceof Error
              ? error.message
              : "Não foi possível carregar o monitor de duplo.",
          loading: false,
          refreshingOdds: false,
        }));
      }
    },
    [],
  );

  useEffect(() => {
    const controller = new AbortController();

    void loadEvents(
      {
        kind: "available",
      },
      { signal: controller.signal },
    );

    return () => {
      controller.abort();
    };
  }, [loadEvents]);

  const dateFilteredEvents = useMemo(
    () => state.events.filter((event) => isEventInDateFilter(event, activeDateFilter)),
    [activeDateFilter, state.events],
  );
  const availableBookmakers = useMemo(
    () =>
      getAvailableBookmakers(dateFilteredEvents, getBookmakerKey).filter(
        (bookmaker) =>
          !requiredBookmaker ||
          !isRequiredBookmaker(
            { bookmaker_name: bookmaker.name, bookmaker_slug: bookmaker.key },
            requiredBookmaker,
          ),
      ),
    [dateFilteredEvents, requiredBookmaker],
  );
  const hasRequiredBookmakerOdds = useMemo(
    () =>
      !requiredBookmaker ||
      state.events.some((event) =>
        event.odds.some((odd) => isRequiredBookmaker(odd, requiredBookmaker)),
      ),
    [requiredBookmaker, state.events],
  );
  const availableLeagues = useMemo(
    () => getAvailableLeagues(dateFilteredEvents),
    [dateFilteredEvents],
  );
  const activeHiddenBookmakers = useMemo(() => {
    const availableKeys = new Set(availableBookmakers.map((bookmaker) => bookmaker.key));
    return new Set(hiddenBookmakers.filter((key) => availableKeys.has(key)));
  }, [availableBookmakers, hiddenBookmakers]);
  const activeHiddenLeagueKeys = useMemo(() => {
    const availableKeys = new Set(availableLeagues.map((league) => league.key));
    return new Set(hiddenLeagueKeys.filter((key) => availableKeys.has(key)));
  }, [availableLeagues, hiddenLeagueKeys]);
  const analyzedEvents = useMemo(
    () =>
      getAnalyzedEvents(
        state.events,
        activeDateFilter,
        activeHiddenBookmakers,
        activeHiddenLeagueKeys,
        requiredBookmaker,
      ),
    [
      activeDateFilter,
      activeHiddenBookmakers,
      activeHiddenLeagueKeys,
      requiredBookmaker,
      state.events,
    ],
  );
  // Trocar o modo ou a ordenacao nao refaz analise nenhuma: so filtra e ordena
  // o que ja foi calculado.
  const rows = useMemo(
    () => getSignalRows(analyzedEvents, activeMode, sortMode),
    [activeMode, analyzedEvents, sortMode],
  );
  const displayRows = useMemo(() => {
    const visible = onlyFavorites
      ? rows.filter(
          (row) =>
            favoriteGames.has(row.event.fixture_id) ||
            favoriteLeagues.has(getFavoriteLeagueKey(row.event)),
        )
      : rows;

    if (sortMode === "favorites") {
      return sortByFavorites(visible, (row) => row.event, favoriteGames, favoriteLeagues);
    }

    return sortMode === "trending"
      ? sortByTrending(visible, (row) => row.event.fixture_id, trendingRank)
      : visible;
  }, [favoriteGames, favoriteLeagues, onlyFavorites, rows, sortMode, trendingRank]);
  const showSignalSkeleton =
    state.loading || (state.refreshingOdds && !rows.length && state.events.length > 0);
  const selectedCalculatorIds = useMemo(
    () => new Set(calculatorSelections.map((selection) => selection.id)),
    [calculatorSelections],
  );
  const counts = useMemo(() => getModeCounts(analyzedEvents), [analyzedEvents]);
  const visibleRows = useMemo(() => getPageSlice(displayRows, page), [displayRows, page]);

  useEffect(() => {
    eventsRef.current = state.events;
  }, [state.events]);

  // Odds novas chegam sozinhas e a lista reordena junto: o intervalo de 20s e
  // longo o bastante para isso nao atrapalhar o clique, e o melhor sinal
  // aparecendo no topo e o que importa.
  const handleStatusUpdate = useCallback(async (status: MonitorOddsStatus) => {
    const nextOddsVersion =
      status.odds_version ?? status.latest_odd_updated_at ?? null;

    if (!nextOddsVersion || nextOddsVersion === oddsVersionRef.current) {
      return;
    }

    if (Date.now() - lastOddsRefreshAtRef.current < oddsRefreshIntervalMs) {
      return;
    }

    const currentEvents = eventsRef.current;

    if (!currentEvents.length) {
      return;
    }

    lastOddsRefreshAtRef.current = Date.now();

    try {
      const result = await fetchOddsSnapshots<OddsSnapshot>(
        currentEvents.map((event) => event.fixture_id),
        nextOddsVersion,
      );

      if (!result?.complete) {
        return;
      }

      oddsVersionRef.current = result.oddsVersion;
      rememberOddsSnapshots(result.snapshots);

      const updatedEvents = mergeOddsSnapshots(currentEvents, result.snapshots);

      setState((previous) => ({ ...previous, events: updatedEvents }));
    } catch {
      // Atualizacao automatica e best-effort: o que esta na tela continua valido.
    }
  }, []);

  const canPollStatus = useCallback(() => eventsRef.current.length > 0, []);

  useMonitorOddsStatusFeed(canPollStatus, handleStatusUpdate);

  // Volta para a primeira pagina quando os filtros mudam. Nao reage a
  // atualizacao de odds: quem esta lendo a pagina 3 continua nela.
  useEffect(() => {
    setPage(1);
  }, [
    activeDateFilter,
    activeHiddenBookmakers,
    activeMode,
    activeHiddenLeagueKeys,
    onlyFavorites,
    sortMode,
  ]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const search = query.trim();

    if (!search) {
      void loadEvents({
        kind: "available",
      });
      return;
    }

    void loadEvents({
      kind: "search",
      search,
    });
  }

  const screenFilterState = useMemo(
    () => ({
      activeDateFilter,
      activeMode,
      hiddenBookmakers,
      hiddenLeagueKeys,
      onlyFavorites,
      sortMode,
    }),
    [
      activeDateFilter,
      activeMode,
      hiddenBookmakers,
      hiddenLeagueKeys,
      onlyFavorites,
      sortMode,
    ],
  );
  const applyScreenFilters = useCallback(
    (filters: Partial<{
    activeDateFilter: DateFilter;
    activeMode: ModeFilter;
    hiddenBookmakers: string[];
    hiddenLeagueKeys: string[];
    onlyFavorites: boolean;
    sortMode: SortMode;
  }>) => {
      if (typeof filters.onlyFavorites === "boolean") setOnlyFavorites(filters.onlyFavorites);
      if (filters.activeDateFilter) setActiveDateFilter(filters.activeDateFilter);
      if (filters.activeMode) setActiveMode(filters.activeMode);
      if (Array.isArray(filters.hiddenBookmakers)) setHiddenBookmakers(filters.hiddenBookmakers);
      if (Array.isArray(filters.hiddenLeagueKeys)) setHiddenLeagueKeys(filters.hiddenLeagueKeys);
      if (filters.sortMode && sortOptions.includes(filters.sortMode)) {
        setSortMode(filters.sortMode);
      }
    },
    [],
  );
  const { clearPreset, hasPreset, savePreset, savingPreset } = useScreenFilters({
    apply: applyScreenFilters,
    screen: variant === "semanal-bet365" ? "monitor-semanal-bet365" : "monitor-duplo",
    state: screenFilterState,
  });

  function handleToggleBookmaker(key: string) {
    setHiddenBookmakers((current) =>
      current.includes(key)
        ? current.filter((bookmakerKey) => bookmakerKey !== key)
        : [...current, key],
    );
  }

  function handleToggleLeague(key: string) {
    setHiddenLeagueKeys((current) =>
      current.includes(key)
        ? current.filter((leagueKey) => leagueKey !== key)
        : [...current, key],
    );
  }

  function handleDateFilterChange(filter: DateFilter) {
    setActiveDateFilter(filter);
  }

  function handleResetFilters() {
    setActiveDateFilter("all");
    setActiveMode("all");
    setHiddenBookmakers([]);
    setHiddenLeagueKeys([]);
  }

  function handleToggleCalculatorRow(row: SignalRow) {
    const selections = getOpportunityCalculatorSelections(
      row.event.fixture_id,
      row.opportunity,
      formatFixtureTeams(row.event).label,
    );

    setCalculatorSelections((current) => {
      const currentIds = new Set(current.map((selection) => selection.id));
      const selected = areCalculatorSelectionsActive(currentIds, selections);

      return selected
        ? current.filter(
            (selection) => !selections.some((item) => item.id === selection.id),
          )
        : mergeCalculatorSelections(current, selections, { replaceAll: true });
    });
  }

  function handleRemoveCalculatorSelection(id: string) {
    setCalculatorSelections((current) =>
      current.filter((selection) => selection.id !== id),
    );
  }

  return (
    <div className="space-y-5">
      <section className="lz-panel rounded-[32px] p-5 md:p-6">
        <form
          className="relative z-10 flex flex-col gap-4"
          onSubmit={handleSearchSubmit}
        >
          <label
            className="text-sm font-semibold text-white"
            htmlFor="double-monitor-search"
          >
            Buscar eventos
          </label>
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
            <input
              className="min-h-13 flex-1 rounded-full border border-white/10 bg-[rgba(22,10,18,0.72)] px-5 text-base font-medium text-white outline-none transition placeholder:text-[var(--text-dim)] focus:border-[rgba(255,139,187,0.45)] focus:ring-2 focus:ring-[rgba(255,139,187,0.08)]"
              id="double-monitor-search"
              maxLength={80}
              onChange={(event) => setQuery(event.target.value.slice(0, 80))}
              placeholder="Digite um time, evento ou liga"
              type="search"
              value={query}
            />
            <div className="grid gap-3 sm:grid-cols-[130px_190px_120px]">
              <button
                aria-expanded={filtersOpen}
                className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${
                  filtersOpen ||
                  activeDateFilter !== "all" ||
                  activeMode !== "all" ||
                  activeHiddenBookmakers.size > 0 ||
                  activeHiddenLeagueKeys.size > 0
                    ? "border-[rgba(255,139,187,0.42)] bg-[rgba(255,139,187,0.16)] text-white"
                    : "border-white/10 bg-white/[0.035] text-[var(--text-secondary)] hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                }`}
                onClick={() => setFiltersOpen((current) => !current)}
                type="button"
              >
                <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
                Filtros
              </button>
              <SortMenu
              labels={sortLabels}
              options={sortOptions} onChange={setSortMode} value={sortMode} />
              <button
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[rgba(211,27,91,0.7)] bg-[linear-gradient(180deg,rgba(211,27,91,0.95),rgba(163,8,63,0.95))] px-5 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(211,27,91,0.2)] transition hover:brightness-110"
                type="submit"
              >
                <Search aria-hidden="true" className="h-4 w-4" />
                <span>Buscar</span>
              </button>
            </div>
          </div>
        </form>
      </section>

      {filtersOpen ? (
        <FiltersDialog
          activeMode={activeMode}
          activeDateFilter={activeDateFilter}
          availableBookmakers={availableBookmakers}
          availableLeagues={availableLeagues}
          counts={counts}
          hiddenBookmakers={activeHiddenBookmakers}
          hiddenLeagueKeys={activeHiddenLeagueKeys}
          onShowAllLeagues={() => setHiddenLeagueKeys([])}
          onHideAllLeagues={() =>
            setHiddenLeagueKeys(availableLeagues.map((league) => league.key))
          }
          onShowAllBookmakers={() => setHiddenBookmakers([])}
          onHideAllBookmakers={() =>
            setHiddenBookmakers(availableBookmakers.map((bookmaker) => bookmaker.key))
          }
          onClose={() => setFiltersOpen(false)}
          onDateFilterChange={handleDateFilterChange}
          onModeChange={setActiveMode}
          hasPreset={hasPreset}
          onClearPreset={() => void clearPreset()}
          onlyFavorites={onlyFavorites}
          onToggleOnlyFavorites={() => setOnlyFavorites((current) => !current)}
          onReset={handleResetFilters}
          onSavePreset={() => void savePreset()}
          savingPreset={savingPreset}
          onToggleLeague={handleToggleLeague}
          onToggleBookmaker={handleToggleBookmaker}
        />
      ) : null}

      <section className="lz-panel rounded-[32px] p-5 md:p-6">
        <div className="relative z-10 space-y-4">
          {state.error ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-500/8 p-4 text-sm font-medium text-rose-200">
              {state.error}
            </div>
          ) : null}

          <div className="space-y-3">
            {showSignalSkeleton ? (
              <>
                <SignalSkeleton />
                <SignalSkeleton />
                <SignalSkeleton />
              </>
            ) : displayRows.length ? (
              visibleRows.map((row) => (
                <SignalCard
                  favorite={favoriteGames.has(row.event.fixture_id)}
                  trending={trendingRank.has(row.event.fixture_id)}
                  onToggleFavorite={() => toggleGame(row.event.fixture_id)}
                  key={row.event.fixture_id}
                  onToggleCalculator={handleToggleCalculatorRow}
                  highlightBookmaker={requiredBookmaker}
                  row={row}
                  selectedIds={selectedCalculatorIds}
                  showRelativeDateLabel={activeDateFilter === "all"}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 text-sm text-[var(--text-muted)]">
                {hasRequiredBookmakerOdds
                  ? "Nenhum sinal encontrado para este filtro."
                  : "Sem odds da Bet365 no momento. Os duplos aparecem aqui assim que a Bet365 tiver odds no monitor."}
              </div>
            )}
          </div>

          {showSignalSkeleton ? null : (
            <SignalPagination
              onPageChange={setPage}
              page={page}
              total={displayRows.length}
            />
          )}

          {state.refreshingOdds ? (
            <p className="text-xs font-medium text-[var(--text-dim)]">
              Atualizando odds dos jogos...
            </p>
          ) : null}
        </div>
      </section>

      <CalculatorSelectionDock
        onClear={() => setCalculatorSelections([])}
        requiredHouse={requiredBookmaker ? BET365_BOOKMAKER_LABEL : null}
        onRemove={handleRemoveCalculatorSelection}
        selections={calculatorSelections}
      />
    </div>
  );
}
