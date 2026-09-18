"use client";

import {
  ArrowLeft,
  Check,
  RotateCcw,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import Link from "next/link";
import {
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
  appendConversionContextParams,
  createCalculatorSelectionId,
  mergeCalculatorSelections,
  type CalculatorConversionContext,
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
import { LzSelect } from "../../_components/lz-select";
import { formatFreebetCount } from "../../_components/ui";
import {
  buildFreebetConversionAnalysis,
  formatFreebetConversionPercent,
  getFreebetConversionBookmakerKey,
  type FreebetConversionMode,
  type FreebetConversionOpportunity,
} from "@/lib/monitor-odds/freebet-conversion";
import {
  CONVERTER_SELECTED_STORAGE_KEY,
  CONVERTER_VIEW_STATE_STORAGE_KEY,
} from "@/lib/monitor-odds/converter-view-state";
import {
  formatDuploBookmakerName,
  type DuploEvent,
  type DuploOddItem,
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
import { formatCurrency } from "@/lib/format";
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

type FreebetQueueItem = {
  casa: string;
  condicao?: string;
  data: string;
  data_coleta: string;
  id: number;
  lucro_real: number;
  resultado_coleta?: string;
  valor_fb: number;
};

type ConvertibleFreebetGroup = {
  casa: string;
  data: string;
  ids: number[];
  itens?: FreebetQueueItem[];
  lucro_total: number;
  quantidade: number;
  valor_total: number;
};

type FreebetConverterMonitorWorkspaceProps = {
  consultationBookmakers: string[];
  convertibleGroups: ConvertibleFreebetGroup[];
};

type DateFilter = SignalDateFilter;
type SelectionMode = "registered" | "consultation";
type ConversionSource = "registered" | "consultation";
type ModeFilter = FreebetConversionMode | "all";
type SortMode =
  | "conversion_desc"
  | "conversion_asc"
  | "nearest"
  | "farthest"
  | "favorites"
  | "trending";

type OddsSnapshot = {
  fixture_id: string;
  latest_odd_updated_at: string | null;
  odds: DuploOddItem[];
};

type EventsResponse = {
  events?: DuploEvent[];
  latest_odd_updated_at?: string | null;
  odds_version?: string | null;
};

type SignalRow = {
  event: DuploEvent;
  opportunity: FreebetConversionOpportunity;
};

// Um jogo ja analisado. A analise e o custo dominante da tela, entao ela roda
// uma vez por jogo e alimenta tanto as linhas visiveis quanto os contadores.
type AnalyzedEvent = {
  event: DuploEvent;
  opportunities: FreebetConversionOpportunity[];
};

type BookmakerFilterOption = FilterOption;

type LeagueFilterOption = FilterOption;

type SearchState = {
  error: string | null;
  events: DuploEvent[];
  loading: boolean;
  refreshingOdds: boolean;
};

const modeLabels: Record<ModeFilter, string> = {
  all: "Todos",
  pa_dois_lados: "PA para os Dois lados",
  pa_um_lado: "PA para 1 dos lados",
  sem_pa: "Sem PA",
};
const dateFilters: DateFilter[] = ["today", "tomorrow", "all"];
const dateFilterLabels: Record<DateFilter, string> = {
  all: "Todos",
  today: "Hoje",
  tomorrow: "Amanhã",
};
// A consulta de status roda a cada 4s (barata), mas rebaixar as odds de todos
// os jogos custa ~200 KB, entao a lista se atualiza no maximo a cada 20s.
const oddsRefreshIntervalMs = 20_000;
const modeFilters: ModeFilter[] = [
  "all",
  "pa_dois_lados",
  "pa_um_lado",
  "sem_pa",
];
const sortLabels: Record<SortMode, string> = {
  conversion_asc: "Menor conversão",
  conversion_desc: "Maior conversão",
  farthest: "Mais distante",
  nearest: "Mais próximo",
  favorites: "Favoritos primeiro",
  trending: "Mais acessados",
};
const sortOptions: SortMode[] = [
  "conversion_desc",
  "conversion_asc",
  "favorites",
  "trending",
  "nearest",
  "farthest",
];
const converterOddsSnapshotMemoryLimit = 300;
const converterOddsSnapshotsByFixtureId = new Map<string, OddsSnapshot>();
const selectedConversionStorageKey = CONVERTER_SELECTED_STORAGE_KEY;
const converterViewStateStorageKey = CONVERTER_VIEW_STATE_STORAGE_KEY;

type StoredConverterViewState = {
  activeDateFilter: DateFilter;
  activeMode: ModeFilter;
  consultationFreebetValue: string;
  consultationHouse: string;
  conversion: ConvertibleFreebetGroup | null;
  conversionSource: ConversionSource;
  hiddenBookmakers: string[];
  maxOddValue: string;
  minOddValue: string;
  scrollY: number;
  hiddenLeagueKeys: string[];
  selectionMode: SelectionMode;
  sortMode: SortMode;
};

function readConverterViewState(): Partial<StoredConverterViewState> | null {
  try {
    const raw = window.sessionStorage.getItem(converterViewStateStorageKey);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeConverterViewState(state: StoredConverterViewState) {
  try {
    window.sessionStorage.setItem(converterViewStateStorageKey, JSON.stringify(state));
  } catch {
    // Sem armazenamento da sessão, a tela apenas não é restaurada ao voltar.
  }
}
const consultationFreebetCondition = "Converter freebet apenas";
let converterRememberedEvents: DuploEvent[] = [];

function cloneOdd(odd: DuploOddItem): DuploOddItem {
  return { ...odd };
}

function cloneEvent(event: DuploEvent): DuploEvent {
  return {
    ...event,
    odds: event.odds.map(cloneOdd),
  };
}

function getSnapshotFromEvent(event: DuploEvent): OddsSnapshot | null {
  if (!event.odds.length) {
    return null;
  }

  return {
    fixture_id: event.fixture_id,
    latest_odd_updated_at: null,
    odds: event.odds.map(cloneOdd),
  };
}

function rememberOddsSnapshots(snapshots: OddsSnapshot[]) {
  for (const snapshot of snapshots) {
    if (!snapshot.fixture_id || !snapshot.odds.length) {
      continue;
    }

    converterOddsSnapshotsByFixtureId.delete(snapshot.fixture_id);
    converterOddsSnapshotsByFixtureId.set(snapshot.fixture_id, {
      ...snapshot,
      odds: snapshot.odds.map(cloneOdd),
    });
  }

  while (converterOddsSnapshotsByFixtureId.size > converterOddsSnapshotMemoryLimit) {
    const oldestFixtureId = converterOddsSnapshotsByFixtureId.keys().next().value;

    if (!oldestFixtureId) {
      return;
    }

    converterOddsSnapshotsByFixtureId.delete(oldestFixtureId);
  }
}

function rememberEventOdds(events: DuploEvent[]) {
  const snapshots = events
    .map(getSnapshotFromEvent)
    .filter((snapshot): snapshot is OddsSnapshot => Boolean(snapshot));

  rememberOddsSnapshots(snapshots);
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
      away_team: event.away_team,
      fixture_id: event.fixture_id,
      fixture_name: event.fixture_name,
      home_team: event.home_team,
      league_country: event.league_country,
      league_name: event.league_name,
      starts_at: event.starts_at,
    }));

    return {
      ...event,
      latest_odd_updated_at: snapshot.latest_odd_updated_at,
      odds,
    };
  });
}

function hydrateEventsWithRememberedOdds(events: DuploEvent[]) {
  const snapshots = events
    .map((event) => converterOddsSnapshotsByFixtureId.get(event.fixture_id))
    .filter((snapshot): snapshot is OddsSnapshot => Boolean(snapshot));

  if (!snapshots.length) {
    return events;
  }

  return mergeOddsSnapshots(events, snapshots);
}

function rememberConverterEvents(events: DuploEvent[]) {
  converterRememberedEvents = events.map(cloneEvent);
  rememberEventOdds(events);
}

function getRememberedConverterEvents() {
  return converterRememberedEvents.map(cloneEvent);
}

function getConvertibleGroupKey(group: ConvertibleFreebetGroup, index: number) {
  const idKey = group.ids.length ? group.ids.join("-") : String(index);
  return `${group.casa}:${group.data}:${idKey}`;
}

function getGroupItems(group: ConvertibleFreebetGroup) {
  if (group.itens?.length) {
    return group.itens;
  }

  return group.ids.map((id) => ({
    casa: group.casa,
    condicao: "",
    data: group.data,
    data_coleta: group.data,
    id,
    lucro_real: group.lucro_total / Math.max(group.ids.length, 1),
    resultado_coleta: "-",
    valor_fb: group.valor_total / Math.max(group.ids.length, 1),
  }));
}

function buildSelectedGroup(
  group: ConvertibleFreebetGroup,
  selectedIds: number[],
): ConvertibleFreebetGroup | null {
  const items = getGroupItems(group).filter((item) => selectedIds.includes(item.id));

  if (!items.length) {
    return null;
  }

  return {
    ...group,
    ids: items.map((item) => item.id),
    itens: items,
    lucro_total: items.reduce((sum, item) => sum + item.lucro_real, 0),
    quantidade: items.length,
    valor_total: items.reduce((sum, item) => sum + item.valor_fb, 0),
  };
}

function readStoredSelectedConversionIds() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.sessionStorage.getItem(selectedConversionStorageKey);

    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
  } catch {
    return [];
  }
}

function rememberSelectedConversion(group: ConvertibleFreebetGroup) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      selectedConversionStorageKey,
      JSON.stringify(group.ids),
    );
  } catch {
    // Session storage is an enhancement for browser back/forward state only.
  }
}

function clearRememberedSelectedConversion() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(selectedConversionStorageKey);
  } catch {
    // Ignore storage failures and keep the in-memory flow working.
  }
}

function findStoredSelectedConversion(
  groups: ConvertibleFreebetGroup[],
  ids: number[],
) {
  if (!ids.length) {
    return null;
  }

  const requestedIds = new Set(ids);
  const group = groups.find((candidate) =>
    ids.every((id) => candidate.ids.includes(id)),
  );

  if (!group) {
    return null;
  }

  return buildSelectedGroup(
    group,
    group.ids.filter((id) => requestedIds.has(id)),
  );
}

function getConversionBatchIdForIds(ids: number[]) {
  const normalizedIds = ids
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0)
    .sort((first, second) => first - second);

  return normalizedIds.length > 0
    ? `freebet-conversion-${normalizedIds.join("-")}`
    : "";
}

function getConversionContext(
  group: ConvertibleFreebetGroup | null,
  source: ConversionSource,
): CalculatorConversionContext | null {
  if (!group) {
    return null;
  }

  return {
    conversionBatchId: getConversionBatchIdForIds(group.ids),
    entryValue: group.lucro_total,
    freebetCondition:
      source === "consultation" ? consultationFreebetCondition : undefined,
    freebetValue: group.valor_total,
    house: group.casa,
    originIds: group.ids,
  };
}

function toNumberInput(value: string, fallback: number) {
  const parsed = Number(String(value).trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampDecimalInput(value: string, maxLength = 12) {
  return value
    .replace(/[^\d,.]/g, "")
    .replace(/([,.].*)[,.]/g, "$1")
    .slice(0, maxLength);
}

function getOddLimits(minOddValue: string, maxOddValue: string) {
  const minOdd = Math.max(1.5, toNumberInput(minOddValue, 1.5));
  const maxOdd = Math.min(
    999999,
    Math.max(minOdd, toNumberInput(maxOddValue, 999999)),
  );

  return {
    maxOdd,
    minOdd,
  };
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function getBookmakerKey(slug: string | null | undefined, name: string) {
  return getFreebetConversionBookmakerKey(name, slug);
}

function isFreebetHouse(
  odd: Pick<DuploOddItem, "bookmaker_name" | "bookmaker_slug">,
  freebetHouseKey: string,
) {
  if (!freebetHouseKey) {
    return false;
  }

  return (
    getBookmakerKey(odd.bookmaker_slug, odd.bookmaker_name) === freebetHouseKey ||
    getFreebetConversionBookmakerKey(odd.bookmaker_name) === freebetHouseKey
  );
}

function filterEventBookmakers(
  event: DuploEvent,
  hiddenBookmakers: ReadonlySet<string>,
  freebetHouseKey: string,
) {
  if (!hiddenBookmakers.size) {
    return event;
  }

  return {
    ...event,
    odds: event.odds.filter((odd) => {
      if (isFreebetHouse(odd, freebetHouseKey)) {
        return true;
      }

      return !hiddenBookmakers.has(
        getBookmakerKey(odd.bookmaker_slug, odd.bookmaker_name),
      );
    }),
  };
}

function sortSignalRows(rows: SignalRow[], sortMode: SortMode) {
  const now = Date.now();

  return [...rows].sort((left, right) => {
    if (sortMode === "conversion_asc") {
      return left.opportunity.profitAmount - right.opportunity.profitAmount;
    }

    if (sortMode === "nearest") {
      return Math.abs(getEventTimeValue(left.event) - now) - Math.abs(getEventTimeValue(right.event) - now);
    }

    if (sortMode === "farthest") {
      return Math.abs(getEventTimeValue(right.event) - now) - Math.abs(getEventTimeValue(left.event) - now);
    }


    const conversionOrder =
      right.opportunity.profitAmount - left.opportunity.profitAmount;

    if (conversionOrder !== 0) return conversionOrder;
    return getEventTimeValue(left.event) - getEventTimeValue(right.event);
  });
}

function getAnalyzedEvents(
  events: DuploEvent[],
  group: ConvertibleFreebetGroup | null,
  dateFilter: DateFilter,
  hiddenBookmakers: ReadonlySet<string>,
  minOdd: number,
  maxOdd: number,
  hiddenLeagueKeys: ReadonlySet<string>,
): AnalyzedEvent[] {
  if (!group) {
    return [];
  }

  const freebetHouseKey = getFreebetConversionBookmakerKey(group.casa);
  const analyzed: AnalyzedEvent[] = [];

  for (const event of events) {
    if (!isEventInDateFilter(event, dateFilter)) {
      continue;
    }

    if (hiddenLeagueKeys.has(getLeagueKey(event))) {
      continue;
    }

    const filteredEvent = filterEventBookmakers(
      event,
      hiddenBookmakers,
      freebetHouseKey,
    );
    const analysis = buildFreebetConversionAnalysis(filteredEvent, {
      freebetHouse: group.casa,
      freebetValue: group.valor_total,
      maxOdd,
      minOdd,
    });

    analyzed.push({ event: filteredEvent, opportunities: analysis.all });
  }

  return analyzed;
}

function getSignalRows(
  analyzedEvents: AnalyzedEvent[],
  activeMode: ModeFilter,
  sortMode: SortMode,
): SignalRow[] {
  const rows: SignalRow[] = [];

  for (const { event, opportunities } of analyzedEvents) {
    const opportunity =
      activeMode === "all"
        ? opportunities[0]
        : opportunities.find((candidate) => candidate.mode === activeMode);

    if (opportunity) {
      rows.push({ event, opportunity });
    }
  }

  return sortSignalRows(rows, sortMode);
}

// Quantos jogos tem ao menos uma conversao de cada modo. Antes isso refazia a
// analise inteira uma vez por modo, so para exibir um numero no badge.
function getOpportunityCalculatorSelections(
  fixtureId: string,
  opportunity: FreebetConversionOpportunity,
  eventName?: string,
): CalculatorSelectionLine[] {
  const calculatorLines = [
    ...opportunity.lines.filter((line) => line.role === "freebet"),
    ...opportunity.lines.filter((line) => line.role !== "freebet"),
  ];

  return calculatorLines.map((line) => ({
    eventName,
    freebet: line.role === "freebet",
    house: line.bookmakerName,
    id: createCalculatorSelectionId([
      fixtureId,
      line.bookmakerSlug || line.bookmakerName,
      line.selectionLabel,
      line.paCategory,
      line.role,
    ]),
    commission: line.commission,
    odd: line.rawOdd,
    pa: line.paCategory === "COM_PA",
    selectionKey: line.selectionLabel,
    selectionLabel: line.selectionLabel,
    stake: line.role === "freebet" ? opportunity.freebetValue : undefined,
  }));
}

function getEventDetailHref(
  fixtureId: string,
  conversionContext: CalculatorConversionContext | null,
) {
  const href = `/monitor/odds/${encodeURIComponent(fixtureId)}`;

  if (!conversionContext) {
    return href;
  }

  const params = new URLSearchParams();
  appendConversionContextParams(params, conversionContext);

  return `${href}?${params.toString()}`;
}

function FiltersDialog({
  activeMode,
  activeDateFilter,
  availableBookmakers,
  availableLeagues,
  counts,
  freebetHouseKey,
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
  freebetHouseKey: string;
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
              Converter freebet
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
            <h3 className="text-sm font-semibold text-white">Tipo de conversão</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {modeFilters.map((mode) => (
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
                  const disabled = bookmaker.key === freebetHouseKey;

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

function FreebetSelectionDialog({
  group,
  onClose,
  onConfirm,
}: {
  group: ConvertibleFreebetGroup;
  onClose: () => void;
  onConfirm: (selectedGroup: ConvertibleFreebetGroup) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>(() => group.ids);
  const items = useMemo(() => getGroupItems(group), [group]);
  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds],
  );
  const selectedValue = selectedItems.reduce((sum, item) => sum + item.valor_fb, 0);
  const selectedCollectionResult = selectedItems.reduce(
    (sum, item) => sum + item.lucro_real,
    0,
  );

  function toggleSelectedFreebet(id: number) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((currentId) => currentId !== id)
        : [...current, id],
    );
  }

  function handleConfirm() {
    const selectedGroup = buildSelectedGroup(group, selectedIds);

    if (!selectedGroup) {
      return;
    }

    onConfirm(selectedGroup);
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[170] overflow-y-auto bg-black/72 px-4 py-6 backdrop-blur-sm sm:py-8"
      onClick={onClose}
    >
      <div className="flex min-h-full items-start justify-center">
        <section
          aria-modal="true"
          className="lz-floating-panel w-full max-w-5xl rounded-[30px] border border-white/10 bg-[var(--panel)] p-4 shadow-2xl sm:p-5"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                Selecionar freebets
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">{group.casa}</h2>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {formatFreebetCount(group.quantidade)} de{" "}
                {formatCurrency(group.valor_total)}
              </p>
            </div>
            <button
              aria-label="Fechar detalhes"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[var(--text-secondary)] transition hover:border-[rgba(216,31,89,0.55)] hover:text-white"
              onClick={onClose}
              type="button"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 grid gap-3 rounded-[24px] border border-white/10 bg-white/4 p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-dim)]">
                Selecionadas
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {formatNumber(selectedItems.length)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-dim)]">
                Valor FB
              </p>
              <p className="mt-2 text-lg font-semibold text-white">
                {formatCurrency(selectedValue)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-dim)]">
                Resultado coleta
              </p>
              <p className={`mt-2 text-lg font-semibold ${getSignalProfitClass(selectedCollectionResult)}`}>
                {formatCurrency(selectedCollectionResult)}
              </p>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <div className="mx-auto w-full max-w-4xl">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[14%]" />
                  <col className="w-[28%]" />
                  <col className="w-[26%]" />
                  <col className="w-[32%]" />
                </colgroup>
                <thead className="text-[var(--text-dim)]">
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-3 text-center font-medium">Selecionar</th>
                    <th className="px-3 py-3 text-center font-medium">Data da coleta</th>
                    <th className="px-3 py-3 text-center font-medium">Valor FB</th>
                    <th className="px-3 py-3 text-center font-medium">
                      Resultado coleta
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      className="border-b border-white/8 align-middle transition hover:bg-white/4"
                      key={item.id}
                    >
                      <td className="px-3 py-3.5 text-center">
                        <input
                          aria-label={`Selecionar freebet de ${formatCurrency(
                            item.valor_fb,
                          )}`}
                          checked={selectedIds.includes(item.id)}
                          className="lz-checkbox"
                          onChange={() => toggleSelectedFreebet(item.id)}
                          type="checkbox"
                        />
                      </td>
                      <td className="px-3 py-3.5 text-center text-[var(--text-secondary)]">
                        {item.data || "-"}
                      </td>
                      <td className="px-3 py-3.5 text-center font-medium text-white">
                        {formatCurrency(item.valor_fb)}
                      </td>
                      <td
                        className={`px-3 py-3.5 text-center font-medium ${getSignalProfitClass(item.lucro_real)}`}
                      >
                        {formatCurrency(item.lucro_real)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mx-auto mt-5 flex w-full max-w-4xl flex-wrap justify-end gap-3">
            <button
              className="lz-button-secondary rounded-full px-4 py-3 text-sm font-semibold"
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            {selectedIds.length > 0 ? (
              <button
                className="lz-button-primary rounded-full px-4 py-3 text-sm font-semibold"
                onClick={handleConfirm}
                type="button"
              >
                Ver oportunidades
              </button>
            ) : (
              <button
                className="lz-button-secondary rounded-full px-4 py-3 text-sm font-semibold opacity-60"
                disabled
                type="button"
              >
                Ver oportunidades
              </button>
            )}
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}

function OpportunityLineMini({
  line,
  onToggle,
  selected,
}: {
  line: FreebetConversionOpportunity["lines"][number];
  onToggle: () => void;
  selected: boolean;
}) {
  return (
    <div
      aria-pressed={selected}
      className={`pointer-events-auto min-w-0 cursor-pointer rounded-2xl border px-3 py-2.5 transition ${
        selected
          ? "border-[rgba(191,219,254,0.66)] bg-[rgba(59,130,246,0.14)] shadow-[0_0_18px_rgba(147,197,253,0.12)]"
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

function SignalCard({
  conversionContext,
  onToggleCalculator,
  row,
  selectedIds,
  showRelativeDateLabel,
  favorite,
  trending,
  onToggleFavorite,
}: {
  conversionContext: CalculatorConversionContext | null;
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
        href={getEventDetailHref(event.fixture_id, conversionContext)}
      />

      <div className="pointer-events-none relative z-10 grid gap-4 lg:grid-cols-[minmax(260px,0.9fr)_minmax(460px,1.35fr)_170px] lg:items-center">
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
              key={`${line.bookmakerSlug}-${line.selectionLabel}-${line.role}-${index}`}
              line={line}
              onToggle={() => onToggleCalculator(row)}
              selected={selected}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:w-[170px] lg:flex-col lg:items-end">
          <span className="whitespace-nowrap rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
            {opportunity.modeLabel}
          </span>
          <strong className={`text-lg font-semibold tabular-nums ${getSignalProfitClass(opportunity.conversionPercent)}`}>
            {formatFreebetConversionPercent(opportunity.conversionPercent)}
          </strong>
          <span className="text-xs font-semibold text-[var(--text-dim)]">
            {formatCurrency(opportunity.profitAmount)}
          </span>
        </div>
      </div>
    </article>
  );
}

function SignalSkeleton() {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.026] p-4">
      <div className="grid animate-pulse gap-4 lg:grid-cols-[minmax(260px,0.9fr)_minmax(460px,1.35fr)_170px] lg:items-center">
        <div>
          <div className="mb-3 flex gap-2">
            <span className="h-6 w-20 rounded-full bg-white/8" />
            <span className="h-6 w-14 rounded-full bg-white/8" />
          </div>
          <span className="block h-5 w-64 max-w-full rounded-full bg-white/10" />
          <span className="mt-2 block h-3 w-44 rounded-full bg-white/8" />
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <span className="h-16 rounded-2xl bg-white/8" />
          <span className="h-16 rounded-2xl bg-white/8" />
          <span className="h-16 rounded-2xl bg-white/8" />
        </div>
        <span className="h-8 w-24 rounded-full bg-white/8" />
      </div>
    </div>
  );
}

export function FreebetConverterMonitorWorkspace({
  consultationBookmakers,
  convertibleGroups,
}: FreebetConverterMonitorWorkspaceProps) {
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("registered");
  const [detailsGroup, setDetailsGroup] = useState<ConvertibleFreebetGroup | null>(
    null,
  );
  const [selectedConversion, setSelectedConversion] =
    useState<ConvertibleFreebetGroup | null>(null);
  const [selectedConversionSource, setSelectedConversionSource] =
    useState<ConversionSource>("registered");
  const [consultationHouse, setConsultationHouse] = useState("");
  const [consultationFreebetValue, setConsultationFreebetValue] = useState("");
  const [consultationError, setConsultationError] = useState<string | null>(null);
  const [minOddValue, setMinOddValue] = useState("1.50");
  const [maxOddValue, setMaxOddValue] = useState("999999");
  const [activeDateFilter, setActiveDateFilter] = useState<DateFilter>("all");
  const [activeMode, setActiveMode] = useState<ModeFilter>("all");
  const [hiddenLeagueKeys, setHiddenLeagueKeys] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hiddenBookmakers, setHiddenBookmakers] = useState<string[]>([]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const { favoriteGames, favoriteLeagues, toggleGame } = useMonitorFavorites();
  const { trendingRank } = useTrendingFixtures();
  const [sortMode, setSortMode] = useState<SortMode>("conversion_desc");
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
    loading: false,
    refreshingOdds: false,
  });
  const activeLoadIdRef = useRef(0);
  const freebetHouseKey = selectedConversion
    ? getFreebetConversionBookmakerKey(selectedConversion.casa)
    : "";
  const consultationBookmakerOptions = useMemo(
    () =>
      consultationBookmakers
        .filter(Boolean)
        .map((bookmaker) => ({
          label: formatDuploBookmakerName(bookmaker),
          value: bookmaker,
        }))
        .sort((left, right) => left.label.localeCompare(right.label, "pt-BR")),
    [consultationBookmakers],
  );
  const { maxOdd, minOdd } = useMemo(
    () => getOddLimits(minOddValue, maxOddValue),
    [maxOddValue, minOddValue],
  );
  const viewStateRestoredRef = useRef(false);
  const pendingScrollRef = useRef<number | null>(null);
  const scrollYRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = readConverterViewState();

      if (stored) {
        const conversion =
          stored.conversionSource === "registered" && stored.conversion?.ids?.length
            ? findStoredSelectedConversion(convertibleGroups, stored.conversion.ids)
            : stored.conversion ?? null;

        setSelectionMode(stored.selectionMode === "consultation" ? "consultation" : "registered");
        setConsultationHouse(stored.consultationHouse ?? "");
        setConsultationFreebetValue(stored.consultationFreebetValue ?? "");
        setMinOddValue(stored.minOddValue ?? "1.50");
        setMaxOddValue(stored.maxOddValue ?? "999999");
        setActiveDateFilter(stored.activeDateFilter ?? "all");
        setActiveMode(stored.activeMode ?? "all");
        setHiddenLeagueKeys(Array.isArray(stored.hiddenLeagueKeys) ? stored.hiddenLeagueKeys : []);
        setHiddenBookmakers(Array.isArray(stored.hiddenBookmakers) ? stored.hiddenBookmakers : []);
        setSortMode(stored.sortMode ?? "conversion_desc");

        if (conversion) {
          setSelectedConversion(conversion);
          setSelectedConversionSource(
            stored.conversionSource === "consultation" ? "consultation" : "registered",
          );
          pendingScrollRef.current = Number(stored.scrollY) || 0;
        }
      }

      viewStateRestoredRef.current = true;
    }, 0);

    return () => window.clearTimeout(timer);
    // Restaura só ao montar; os grupos vêm do servidor já na primeira renderização.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      selectedConversion ||
      selectionMode !== "registered" ||
      !convertibleGroups.length
    ) {
      return;
    }

    const storedIds = readStoredSelectedConversionIds();

    if (!storedIds.length) {
      return;
    }

    const storedConversion = findStoredSelectedConversion(
      convertibleGroups,
      storedIds,
    );

    if (!storedConversion) {
      clearRememberedSelectedConversion();
      return;
    }

    setSelectedConversion(storedConversion);
    setSelectedConversionSource("registered");
  }, [convertibleGroups, selectedConversion, selectionMode]);

  useEffect(() => {
    if (selectionMode !== "consultation" || !consultationHouse) {
      return;
    }

    const houseStillAvailable = consultationBookmakerOptions.some(
      (option) => option.value === consultationHouse,
    );

    if (!houseStillAvailable) {
      setConsultationHouse("");
    }
  }, [consultationBookmakerOptions, consultationHouse, selectionMode]);

  const loadEvents = useCallback(
    async (options: { signal?: AbortSignal; showLoading?: boolean } = {}) => {
      const loadId = activeLoadIdRef.current + 1;
      activeLoadIdRef.current = loadId;

      if (options.showLoading !== false) {
        const rememberedEvents = getRememberedConverterEvents();

        setState({
          error: null,
          events: rememberedEvents,
          loading: !rememberedEvents.length,
          refreshingOdds: Boolean(rememberedEvents.length),
        });
      }

      try {
        const response = await fetch("/api/monitor-odds/events", {
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
        if (options.signal?.aborted || activeLoadIdRef.current !== loadId) {
          return;
        }

        const events = hydrateEventsWithRememberedOdds(payload.events ?? []);
        const oddsVersion =
          payload.odds_version ?? payload.latest_odd_updated_at ?? null;
        rememberConverterEvents(events);

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

        if (options.signal?.aborted || activeLoadIdRef.current !== loadId) {
          return;
        }

        if (oddsResult.complete) {
          rememberOddsSnapshots(oddsResult.snapshots);
        }

        const hydratedEvents = oddsResult.complete
          ? mergeOddsSnapshots(events, oddsResult.snapshots)
          : hydrateEventsWithRememberedOdds(events);
        rememberConverterEvents(hydratedEvents);

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
          activeLoadIdRef.current !== loadId
        ) {
          return;
        }

        setState((current) => ({
          ...current,
          error:
            error instanceof Error
              ? error.message
              : "Não foi possível carregar o conversor de freebet.",
          loading: false,
          refreshingOdds: false,
        }));
      }
    },
    [],
  );

  useEffect(() => {
    if (!selectedConversion) {
      return;
    }

    const controller = new AbortController();

    void loadEvents({ signal: controller.signal });

    return () => {
      controller.abort();
    };
  }, [loadEvents, selectedConversion]);

  useEffect(() => {
    setHiddenBookmakers((current) =>
      current.filter((bookmakerKey) => bookmakerKey !== freebetHouseKey),
    );
  }, [freebetHouseKey]);

  const dateFilteredEvents = useMemo(
    () => state.events.filter((event) => isEventInDateFilter(event, activeDateFilter)),
    [activeDateFilter, state.events],
  );
  const availableBookmakers = useMemo(
    () => getAvailableBookmakers(dateFilteredEvents, getBookmakerKey),
    [dateFilteredEvents],
  );
  const availableLeagues = useMemo(
    () => getAvailableLeagues(dateFilteredEvents),
    [dateFilteredEvents],
  );
  const activeHiddenBookmakers = useMemo(() => {
    const availableKeys = new Set(availableBookmakers.map((bookmaker) => bookmaker.key));
    return new Set(
      hiddenBookmakers.filter(
        (key) => availableKeys.has(key) && key !== freebetHouseKey,
      ),
    );
  }, [availableBookmakers, freebetHouseKey, hiddenBookmakers]);
  const activeHiddenLeagueKeys = useMemo(() => {
    const availableKeys = new Set(availableLeagues.map((league) => league.key));
    return new Set(hiddenLeagueKeys.filter((key) => availableKeys.has(key)));
  }, [availableLeagues, hiddenLeagueKeys]);
  const analyzedEvents = useMemo(
    () =>
      getAnalyzedEvents(
        state.events,
        selectedConversion,
        activeDateFilter,
        activeHiddenBookmakers,
        minOdd,
        maxOdd,
        activeHiddenLeagueKeys,
      ),
    [
      activeDateFilter,
      activeHiddenBookmakers,
      activeHiddenLeagueKeys,
      maxOdd,
      minOdd,
      selectedConversion,
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
  const visibleCalculatorSelectionIds = useMemo(() => {
    const ids = new Set<string>();

    for (const row of rows) {
      for (const selection of getOpportunityCalculatorSelections(
        row.event.fixture_id,
        row.opportunity,
      )) {
        ids.add(selection.id);
      }
    }

    return ids;
  }, [rows]);
  const conversionContext = useMemo(() => {
    const context = getConversionContext(selectedConversion, selectedConversionSource);

    return context ? { ...context, maxOdd, minOdd } : null;
  }, [maxOdd, minOdd, selectedConversion, selectedConversionSource]);
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
    maxOdd,
    minOdd,
    selectedConversion,
    activeHiddenLeagueKeys,
    onlyFavorites,
    sortMode,
  ]);
  const showSignalSkeleton =
    state.loading || (state.refreshingOdds && !rows.length && state.events.length > 0);
  const selectedCalculatorIds = useMemo(
    () => new Set(calculatorSelections.map((selection) => selection.id)),
    [calculatorSelections],
  );

  useEffect(() => {
    setCalculatorSelections((current) =>
      current.filter((selection) => visibleCalculatorSelectionIds.has(selection.id)),
    );
  }, [visibleCalculatorSelectionIds]);

  const buildViewState = useCallback(
    (): StoredConverterViewState => ({
      activeDateFilter,
      activeMode,
      consultationFreebetValue,
      consultationHouse,
      conversion: selectedConversion,
      conversionSource: selectedConversionSource,
      hiddenBookmakers,
      maxOddValue,
      minOddValue,
      scrollY: scrollYRef.current,
      hiddenLeagueKeys,
      selectionMode,
      sortMode,
    }),
    [
      activeDateFilter,
      activeMode,
      consultationFreebetValue,
      consultationHouse,
      hiddenBookmakers,
      maxOddValue,
      minOddValue,
      selectedConversion,
      selectedConversionSource,
      hiddenLeagueKeys,
      selectionMode,
      sortMode,
    ],
  );

  useEffect(() => {
    if (viewStateRestoredRef.current) {
      writeConverterViewState(buildViewState());
    }
  }, [buildViewState]);

  useEffect(() => {
    let frame: number | null = null;

    function handleScroll() {
      if (frame !== null) {
        return;
      }

      frame = window.requestAnimationFrame(() => {
        frame = null;

        if (!viewStateRestoredRef.current || pendingScrollRef.current !== null) {
          return;
        }

        scrollYRef.current = window.scrollY;
        writeConverterViewState(buildViewState());
      });
    }

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);

      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [buildViewState]);

  useEffect(() => {
    if (pendingScrollRef.current === null || state.loading || !rows.length) {
      return;
    }

    const targetY = pendingScrollRef.current;
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({ top: targetY });
      scrollYRef.current = targetY;
      pendingScrollRef.current = null;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [rows.length, state.loading]);

  function handleSelectConversion(group: ConvertibleFreebetGroup) {
    rememberSelectedConversion(group);
    setSelectedConversionSource("registered");
    setSelectedConversion(group);
    setDetailsGroup(null);
    setCalculatorSelections([]);
    setHiddenBookmakers([]);
    setActiveDateFilter("all");
    setActiveMode("all");
    setHiddenLeagueKeys([]);
  }

  function handleStartConsultation() {
    const house = consultationHouse.trim();
    const freebetValue = toNumberInput(consultationFreebetValue, 0);

    if (!house) {
      setConsultationError("Selecione a casa da freebet.");
      return;
    }

    if (freebetValue <= 0) {
      setConsultationError("Informe o valor da freebet.");
      return;
    }

    clearRememberedSelectedConversion();
    setConsultationError(null);
    setSelectedConversionSource("consultation");
    setSelectedConversion({
      casa: house,
      data: "Consulta",
      ids: [],
      itens: [],
      lucro_total: 0,
      quantidade: 1,
      valor_total: freebetValue,
    });
    setDetailsGroup(null);
    setCalculatorSelections([]);
    setHiddenBookmakers([]);
    setActiveDateFilter("all");
    setActiveMode("all");
    setHiddenLeagueKeys([]);
  }

  function handleBackToSelection() {
    const previousSource = selectedConversionSource;

    clearRememberedSelectedConversion();
    setSelectedConversion(null);
    setSelectedConversionSource("registered");
    setSelectionMode(previousSource === "consultation" ? "consultation" : "registered");
    setCalculatorSelections([]);
    setHiddenBookmakers([]);
    setFiltersOpen(false);
    setActiveDateFilter("all");
    setHiddenLeagueKeys([]);
  }

  const screenFilterState = useMemo(
    () => ({
      activeDateFilter,
      activeMode,
      hiddenBookmakers,
      hiddenLeagueKeys,
      maxOddValue,
      minOddValue,
      onlyFavorites,
      sortMode,
    }),
    [
      activeDateFilter,
      activeMode,
      hiddenBookmakers,
      hiddenLeagueKeys,
      maxOddValue,
      minOddValue,
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
    maxOddValue: string;
    minOddValue: string;
    sortMode: SortMode;
  }>) => {
      if (typeof filters.onlyFavorites === "boolean") setOnlyFavorites(filters.onlyFavorites);
      if (filters.activeDateFilter) setActiveDateFilter(filters.activeDateFilter);
      if (filters.activeMode) setActiveMode(filters.activeMode);
      if (Array.isArray(filters.hiddenBookmakers)) setHiddenBookmakers(filters.hiddenBookmakers);
      if (Array.isArray(filters.hiddenLeagueKeys)) setHiddenLeagueKeys(filters.hiddenLeagueKeys);
      if (typeof filters.maxOddValue === "string") setMaxOddValue(filters.maxOddValue);
      if (typeof filters.minOddValue === "string") setMinOddValue(filters.minOddValue);
      if (filters.sortMode && sortOptions.includes(filters.sortMode)) {
        setSortMode(filters.sortMode);
      }
    },
    [],
  );
  const { clearPreset, hasPreset, savePreset, savingPreset } = useScreenFilters({
    apply: applyScreenFilters,
    screen: "monitor-converter-freebet",
    state: screenFilterState,
  });

  function handleToggleBookmaker(key: string) {
    if (key === freebetHouseKey) {
      return;
    }

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

  if (!selectedConversion) {
    return (
      <div className="space-y-5">
        <section className="lz-panel rounded-[32px] p-5 md:p-6">
          <div className="relative z-10 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
                  Consultar
                </p>
                <h1 className="mt-1 text-2xl font-semibold text-white">
                  Oportunidades
                </h1>
              </div>

              <div className="inline-flex rounded-full border border-white/10 bg-black/15 p-1">
                {[
                  { label: "Freebets cadastradas", value: "registered" },
                  { label: "Consulta", value: "consultation" },
                ].map((option) => (
                  <button
                    aria-pressed={selectionMode === option.value}
                    className={`rounded-full px-4 py-2.5 text-sm font-semibold transition ${
                      selectionMode === option.value
                        ? "lz-button-primary"
                        : "text-[var(--text-secondary)] hover:text-white"
                    }`}
                    key={option.value}
                    onClick={() => {
                      setSelectionMode(option.value as SelectionMode);
                      setDetailsGroup(null);
                      setConsultationError(null);
                    }}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {selectionMode === "registered" ? (
              <div className="rounded-[22px] border border-white/10 bg-black/10 px-3 py-2 md:px-4">
                {convertibleGroups.length === 0 ? (
                  <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 text-sm text-[var(--text-muted)]">
                    Nenhuma freebet pronta para conversão.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] table-fixed text-sm">
                      <colgroup>
                        <col className="w-[15%]" />
                        <col className="w-[16%]" />
                        <col className="w-[9%]" />
                        <col className="w-[16%]" />
                        <col className="w-[20%]" />
                        <col className="w-[24%]" />
                      </colgroup>
                      <thead className="text-[var(--text-dim)]">
                        <tr className="border-b border-white/10">
                          <th className="px-2 py-2.5 text-center font-semibold">
                            Data da coleta
                          </th>
                          <th className="px-2 py-2.5 text-center font-semibold">
                            Casa
                          </th>
                          <th className="px-2 py-2.5 text-center font-semibold">
                            Qtd
                          </th>
                          <th className="px-2 py-2.5 text-center font-semibold">
                            Valor FB
                          </th>
                          <th className="px-2 py-2.5 text-center font-semibold">
                            Resultado coleta
                          </th>
                          <th className="px-2 py-2.5 text-center font-semibold">
                            Ação
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {convertibleGroups.map((item, index) => (
                          <tr
                            className="border-b border-white/8 align-middle transition hover:bg-white/5"
                            key={getConvertibleGroupKey(item, index)}
                          >
                            <td className="px-2 py-2.5 text-center font-semibold text-white">
                              {item.data}
                            </td>
                            <td className="px-2 py-2.5 text-center font-semibold text-white">
                              {item.casa}
                            </td>
                            <td className="px-2 py-2.5 text-center font-semibold text-white">
                              {formatNumber(item.quantidade)}
                            </td>
                            <td className="px-2 py-2.5 text-center font-semibold text-white">
                              {formatCurrency(item.valor_total)}
                            </td>
                            <td
                              className={`px-2 py-2.5 text-center font-semibold ${getSignalProfitClass(
                                item.lucro_total,
                              )}`}
                            >
                              {formatCurrency(item.lucro_total)}
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              <button
                                className="lz-button-primary rounded-full px-3.5 py-2 text-sm font-semibold leading-none"
                                onClick={() => setDetailsGroup(item)}
                                type="button"
                              >
                                Converter
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <form
                className="rounded-[26px] border border-white/10 bg-black/10 p-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleStartConsultation();
                }}
              >
                <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_150px_120px_120px_auto] lg:items-end">
                  <label className="space-y-1.5 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                      Casa
                    </span>
                    <LzSelect
                      className="h-12 w-full rounded-full border border-white/10 bg-[rgba(22,10,18,0.72)] px-4 text-sm font-semibold"
                      disabled={!consultationBookmakerOptions.length}
                      onValueChange={(value) => {
                        setConsultationHouse(value);
                        setConsultationError(null);
                      }}
                      options={consultationBookmakerOptions}
                      placeholder={
                        consultationBookmakerOptions.length
                          ? "Selecionar casa"
                          : "Nenhuma casa disponível"
                      }
                      value={consultationHouse}
                    />
                  </label>

                  <label className="space-y-1.5 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                      Valor FB
                    </span>
                    <div className="flex h-12 w-full items-center gap-2 rounded-full border border-white/10 bg-[rgba(22,10,18,0.72)] px-4 text-sm text-[var(--text-secondary)] transition focus-within:border-[rgba(255,139,187,0.45)] focus-within:ring-2 focus-within:ring-[rgba(255,139,187,0.08)]">
                      <span className="shrink-0 font-semibold">R$</span>
                      <input
                        className="min-w-0 flex-1 border-0 bg-transparent text-center text-sm font-semibold text-white outline-none placeholder:text-[var(--text-dim)]"
                        inputMode="decimal"
                        maxLength={12}
                        onChange={(event) => {
                          setConsultationFreebetValue(
                            clampDecimalInput(event.target.value, 12),
                          );
                          setConsultationError(null);
                        }}
                        placeholder="0,00"
                        value={consultationFreebetValue}
                      />
                    </div>
                  </label>

                  <label className="space-y-1.5 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                      Odd min.
                    </span>
                    <input
                      className="h-12 w-full rounded-full border border-white/10 bg-[rgba(22,10,18,0.72)] px-4 text-center text-sm font-semibold text-white outline-none transition placeholder:text-[var(--text-dim)] focus:border-[rgba(255,139,187,0.45)] focus:ring-2 focus:ring-[rgba(255,139,187,0.08)]"
                      inputMode="decimal"
                      maxLength={10}
                      onChange={(event) =>
                        setMinOddValue(clampDecimalInput(event.target.value, 10))
                      }
                      placeholder="1.50"
                      value={minOddValue}
                    />
                  </label>

                  <label className="space-y-1.5 text-sm">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                      Odd max.
                    </span>
                    <input
                      className="h-12 w-full rounded-full border border-white/10 bg-[rgba(22,10,18,0.72)] px-4 text-center text-sm font-semibold text-white outline-none transition placeholder:text-[var(--text-dim)] focus:border-[rgba(255,139,187,0.45)] focus:ring-2 focus:ring-[rgba(255,139,187,0.08)]"
                      inputMode="decimal"
                      maxLength={10}
                      onChange={(event) =>
                        setMaxOddValue(clampDecimalInput(event.target.value, 10))
                      }
                      placeholder="999999"
                      value={maxOddValue}
                    />
                  </label>

                  <button
                    className="lz-button-primary inline-flex h-12 items-center justify-center rounded-full px-5 text-sm font-semibold"
                    type="submit"
                  >
                    Buscar oportunidades
                  </button>
                </div>

                {consultationError ? (
                  <p className="mt-3 text-sm font-medium text-rose-300">
                    {consultationError}
                  </p>
                ) : null}
              </form>
            )}
          </div>
        </section>

        {detailsGroup ? (
          <FreebetSelectionDialog
            group={detailsGroup}
            onClose={() => setDetailsGroup(null)}
            onConfirm={handleSelectConversion}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="lz-panel rounded-[32px] p-5 md:p-6">
        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-dim)]">
                Converter freebet
              </p>
              <h1 className="mt-1 text-2xl font-semibold text-white">
                {selectedConversionSource === "consultation"
                  ? "Consulta"
                  : selectedConversion.casa}
              </h1>
              <p className="mt-1 text-sm font-medium text-[var(--text-secondary)]">
                {selectedConversionSource === "consultation"
                  ? `${selectedConversion.casa} · ${formatCurrency(
                      selectedConversion.valor_total,
                    )}`
                  : `${formatFreebetCount(selectedConversion.quantidade)} · ${formatCurrency(
                      selectedConversion.valor_total,
                    )}`}
              </p>
            </div>
            <button
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-5 text-sm font-semibold text-[var(--text-secondary)] transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
              onClick={handleBackToSelection}
              type="button"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              <span>
                {selectedConversionSource === "consultation"
                  ? "Voltar para consulta"
                  : "Trocar freebet"}
              </span>
            </button>
          </div>

          <div className="grid gap-3 lg:grid-cols-[120px_120px_130px_190px] lg:items-end">
            <label className="space-y-1.5 text-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                Odd min.
              </span>
              <input
                aria-label="Odd mínima da freebet"
                className="h-12 w-full rounded-full border border-white/10 bg-[rgba(22,10,18,0.72)] px-4 text-center text-sm font-semibold text-white outline-none transition placeholder:text-[var(--text-dim)] focus:border-[rgba(255,139,187,0.45)] focus:ring-2 focus:ring-[rgba(255,139,187,0.08)]"
                inputMode="decimal"
                maxLength={10}
                onChange={(event) =>
                  setMinOddValue(clampDecimalInput(event.target.value, 10))
                }
                placeholder="1.50"
                value={minOddValue}
              />
            </label>
            <label className="space-y-1.5 text-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                Odd max.
              </span>
              <input
                aria-label="Odd máxima da freebet"
                className="h-12 w-full rounded-full border border-white/10 bg-[rgba(22,10,18,0.72)] px-4 text-center text-sm font-semibold text-white outline-none transition placeholder:text-[var(--text-dim)] focus:border-[rgba(255,139,187,0.45)] focus:ring-2 focus:ring-[rgba(255,139,187,0.08)]"
                inputMode="decimal"
                maxLength={10}
                onChange={(event) =>
                  setMaxOddValue(clampDecimalInput(event.target.value, 10))
                }
                placeholder="999999"
                value={maxOddValue}
              />
            </label>
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
          </div>
        </div>
      </section>

      {filtersOpen ? (
        <FiltersDialog
          activeMode={activeMode}
          activeDateFilter={activeDateFilter}
          availableBookmakers={availableBookmakers}
          availableLeagues={availableLeagues}
          counts={counts}
          freebetHouseKey={freebetHouseKey}
          hiddenBookmakers={activeHiddenBookmakers}
          hiddenLeagueKeys={activeHiddenLeagueKeys}
          onShowAllLeagues={() => setHiddenLeagueKeys([])}
          onHideAllLeagues={() =>
            setHiddenLeagueKeys(availableLeagues.map((league) => league.key))
          }
          onShowAllBookmakers={() => setHiddenBookmakers([])}
          onHideAllBookmakers={() =>
            setHiddenBookmakers(
              availableBookmakers
                .map((bookmaker) => bookmaker.key)
                .filter((key) => key !== freebetHouseKey),
            )
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
                  key={`${row.event.fixture_id}:${row.opportunity.lines
                    .map((line) => `${line.bookmakerSlug}:${line.selectionLabel}`)
                    .join("|")}`}
                  conversionContext={conversionContext}
                  onToggleCalculator={handleToggleCalculatorRow}
                  row={row}
                  selectedIds={selectedCalculatorIds}
                  showRelativeDateLabel={activeDateFilter === "all"}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 text-sm text-[var(--text-muted)]">
                Nenhuma conversão encontrada para esta freebet.
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
        conversionContext={conversionContext}
        onClear={() => setCalculatorSelections([])}
        onRemove={handleRemoveCalculatorSelection}
        selections={calculatorSelections}
      />
    </div>
  );
}
