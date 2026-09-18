"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  CalculatorSelectionDock,
  createCalculatorSelectionId,
  mergeCalculatorSelections,
  type CalculatorSelectionLine,
} from "@/app/_components/calculator-selection-dock";
import { useMonitorFavorites } from "@/app/(app)/_components/use-monitor-favorites";
import { useTrendingFixtures } from "@/app/(app)/_components/use-trending-fixtures";
import { useScreenFilters } from "@/app/(app)/_components/use-screen-filters";
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
import { SortMenu } from "@/app/(app)/monitor/_components/signal-controls";
import {
  areCalculatorSelectionsActive,
  formatFixtureTeams,
  getAvailableBookmakers,
  getAvailableLeagues,
  getEventTimeValue,
  getLeagueKey,
  getModeCounts,
  getSignalProfitClass,
  isEventInDateFilter,
  type SignalDateFilter,
} from "@/lib/monitor-odds/signal-helpers";
import {
  cloneSignalEvent,
  mergeSignalOddsSnapshots,
  SignalOddsMemory,
  type SignalOddsSnapshot,
} from "@/lib/monitor-odds/signal-odds-memory";
import { SignalFiltersDialog } from "@/app/(app)/monitor/_components/signal-filters-dialog";
import {
  SignalCard,
  SignalSkeleton,
  type SignalCardLine,
} from "@/app/(app)/monitor/_components/signal-card";

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

type OddsSnapshot = SignalOddsSnapshot;

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

type SearchState = {
  error: string | null;
  events: DuploEvent[];
  loading: boolean;
  refreshingOdds: boolean;
};

const duploModeLabels: Record<ModeFilter, string> = {
  all: getDuploModeLabel("all"),
  pa_dois_lados: getDuploModeLabel("pa_dois_lados"),
  pa_um_lado: getDuploModeLabel("pa_um_lado"),
  sem_pa: getDuploModeLabel("sem_pa"),
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
const duploEventsByRequestKey = new Map<string, DuploEvent[]>();
const duploOddsMemory = new SignalOddsMemory(300);

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

function rememberDuploEvents(request: EventsRequest, events: DuploEvent[]) {
  const key = getEventsRequestKey(request);

  if (!events.length) {
    duploEventsByRequestKey.delete(key);
    return;
  }

  duploEventsByRequestKey.delete(key);
  duploEventsByRequestKey.set(key, events.map(cloneSignalEvent));
  duploOddsMemory.rememberEvents(events);

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
      ?.map(cloneSignalEvent) ?? []
  );
}

function getBookmakerKey(slug: string | null | undefined, name: string) {
  return (slug?.trim() || name.trim() || "casa").toLocaleLowerCase("pt-BR");
}

// Semanal Bet365 abre o evento só com combinações da casa obrigatória.
function getDuploEventHref(fixtureId: string, requiredBookmaker: string | null) {
  const href = `/monitor/odds/${encodeURIComponent(fixtureId)}`;

  return requiredBookmaker
    ? `${href}?${REQUIRED_BOOKMAKER_PARAM}=${encodeURIComponent(requiredBookmaker)}`
    : href;
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
export type DoubleMonitorVariant = "duplo" | "semanal-bet365";

export function DoubleMonitorWorkspace({
  variant = "duplo",
}: {
  variant?: DoubleMonitorVariant;
}) {
  const requiredBookmaker = variant === "semanal-bet365" ? BET365_BOOKMAKER_KEY : null;
  const isRequiredLine = useCallback(
    (line: SignalCardLine) =>
      Boolean(
        requiredBookmaker &&
          isRequiredBookmaker(
            { bookmaker_name: line.bookmakerName, bookmaker_slug: line.bookmakerSlug },
            requiredBookmaker,
          ),
      ),
    [requiredBookmaker],
  );
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

        const events = duploOddsMemory.hydrate(payload.events ?? []);
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
          duploOddsMemory.remember(oddsResult.snapshots);
        }

        const hydratedEvents = oddsResult.complete
          ? mergeSignalOddsSnapshots(events, oddsResult.snapshots)
          : duploOddsMemory.hydrate(events);
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
      duploOddsMemory.remember(result.snapshots);

      const updatedEvents = mergeSignalOddsSnapshots(currentEvents, result.snapshots);

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
        <SignalFiltersDialog
          modeLabels={duploModeLabels}
          modeTitle="Tipo de sinal"
          title={variant === "semanal-bet365" ? "Semanal Bet365" : "Monitor de duplo"}
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
                  event={row.event}
                  favorite={favoriteGames.has(row.event.fixture_id)}
                  href={getDuploEventHref(row.event.fixture_id, requiredBookmaker)}
                  isLineHighlighted={isRequiredLine}
                  key={row.event.fixture_id}
                  lines={row.opportunity.lines}
                  modeLabel={row.opportunity.modeLabel}
                  onToggleCalculator={() => handleToggleCalculatorRow(row)}
                  onToggleFavorite={() => toggleGame(row.event.fixture_id)}
                  result={
                    <strong
                      className={`text-lg font-semibold tabular-nums ${getSignalProfitClass(row.opportunity.profitPercent)}`}
                    >
                      {formatDuploPercent(row.opportunity.profitPercent)}
                    </strong>
                  }
                  selected={areCalculatorSelectionsActive(
                    selectedCalculatorIds,
                    getOpportunityCalculatorSelections(row.event.fixture_id, row.opportunity),
                  )}
                  showRelativeDateLabel={activeDateFilter === "all"}
                  trending={trendingRank.has(row.event.fixture_id)}
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
