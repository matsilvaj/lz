"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type OddsFeedItem = {
  fixture_id: string;
  api_football_fixture_id: number | null;
  fixture_name: string;
  home_team: string;
  away_team: string;
  starts_at: string;
  status: string | null;
  round: string | null;
  league_name: string;
  league_slug: string;
  league_country: string | null;
  bookmaker_slug: string;
  bookmaker_name: string;
  market_code: string;
  market_name: string;
  selection: string;
  price: number;
  pa_category: string;
  confidence_score: number | null;
  odd_updated_at: string | null;
};

type OddsEvent = {
  fixture_id: string;
  api_football_fixture_id: number | null;
  fixture_name: string;
  home_team: string;
  away_team: string;
  starts_at: string;
  status: string | null;
  round: string | null;
  league_name: string;
  league_slug: string;
  league_country: string | null;
  bookmaker_count: number;
  odd_count: number;
  latest_odd_updated_at: string | null;
  odds: OddsFeedItem[];
};

type SearchState = {
  events: OddsEvent[];
  loading: boolean;
  error: string | null;
};

type EventsResponse = {
  events?: OddsEvent[];
  latest_odd_updated_at?: string | null;
};

type StatusResponse = {
  latest_odd_updated_at?: string | null;
};

type PaCategory = "SEM_PA" | "COM_PA";
type Selection = "HOME" | "DRAW" | "AWAY";
type SortDirection = "asc" | "desc";
type OddsSortState = {
  direction: SortDirection;
  selection: Selection;
};
type OddsTableRow = {
  bookmakerName: string;
  key: string;
  odds: Partial<Record<Selection, OddsFeedItem>>;
};

const selections: Selection[] = ["HOME", "DRAW", "AWAY"];
const oddsTableGridClass =
  "grid grid-cols-[minmax(120px,1fr)_repeat(3,minmax(62px,90px))] items-center gap-2";
const oddsBoxClass =
  "flex h-9 w-full items-center justify-center rounded-xl px-2 text-center";
const leagueCountryNames: Record<string, string> = {
  albania: "Albânia",
  algeria: "Argélia",
  andorra: "Andorra",
  angola: "Angola",
  argentina: "Argentina",
  armenia: "Armênia",
  aruba: "Aruba",
  australia: "Austrália",
  austria: "Áustria",
  azerbaijan: "Azerbaijão",
  bahrain: "Bahrein",
  belarus: "Belarus",
  belgium: "Bélgica",
  bolivia: "Bolívia",
  "bosnia-herzegovina": "Bósnia e Herzegovina",
  bosnia: "Bósnia e Herzegovina",
  brazil: "Brasil",
  bulgaria: "Bulgária",
  canada: "Canadá",
  chile: "Chile",
  china: "China",
  colombia: "Colômbia",
  "costa-rica": "Costa Rica",
  croatia: "Croácia",
  cyprus: "Chipre",
  "czech-republic": "República Tcheca",
  czechia: "República Tcheca",
  denmark: "Dinamarca",
  ecuador: "Equador",
  egypt: "Egito",
  england: "Inglaterra",
  estonia: "Estônia",
  "faroe-islands": "Ilhas Faroé",
  finland: "Finlândia",
  france: "França",
  georgia: "Geórgia",
  germany: "Alemanha",
  gibraltar: "Gibraltar",
  greece: "Grécia",
  hungary: "Hungria",
  iceland: "Islândia",
  india: "Índia",
  indonesia: "Indonésia",
  iran: "Irã",
  ireland: "Irlanda",
  israel: "Israel",
  italy: "Itália",
  japan: "Japão",
  kazakhstan: "Cazaquistão",
  kosovo: "Kosovo",
  latvia: "Letônia",
  lithuania: "Lituânia",
  luxembourg: "Luxemburgo",
  malaysia: "Malásia",
  malta: "Malta",
  mexico: "México",
  moldova: "Moldávia",
  montenegro: "Montenegro",
  morocco: "Marrocos",
  netherlands: "Holanda",
  "new-zealand": "Nova Zelândia",
  nigeria: "Nigéria",
  "north-macedonia": "Macedônia do Norte",
  "northern-ireland": "Irlanda do Norte",
  norway: "Noruega",
  paraguay: "Paraguai",
  peru: "Peru",
  poland: "Polônia",
  portugal: "Portugal",
  qatar: "Catar",
  romania: "Romênia",
  russia: "Rússia",
  "san-marino": "San Marino",
  "saudi-arabia": "Arábia Saudita",
  scotland: "Escócia",
  serbia: "Sérvia",
  singapore: "Singapura",
  slovakia: "Eslováquia",
  slovenia: "Eslovênia",
  "south-africa": "África do Sul",
  "south-korea": "Coreia do Sul",
  spain: "Espanha",
  sweden: "Suécia",
  switzerland: "Suíça",
  thailand: "Tailândia",
  tunisia: "Tunísia",
  turkey: "Turquia",
  ukraine: "Ucrânia",
  uruguay: "Uruguai",
  usa: "Estados Unidos",
  "united-states": "Estados Unidos",
  venezuela: "Venezuela",
  vietnam: "Vietnã",
  wales: "País de Gales",
  world: "Mundo",
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
});

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeStyle: "short",
});

function formatDate(value: string | null) {
  if (!value) return "Sem data";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";

  return dateFormatter.format(date);
}

function formatTime(value: string | null) {
  if (!value) return "Sem horario";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem horario";

  return timeFormatter.format(date);
}

function normalizeLabelKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatBookmakerName(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => {
      if (!word) return word;
      const rest = word.slice(1);
      const hasInternalCase = /[a-z][A-Z]/.test(word) || /[0-9][A-Z]/.test(word);
      const normalizedRest = hasInternalCase ? rest : rest.toLocaleLowerCase("pt-BR");

      return `${word.charAt(0).toLocaleUpperCase("pt-BR")}${normalizedRest}`;
    })
    .join(" ");
}

function formatLeagueCountry(value: string | null) {
  if (!value) return "";
  return leagueCountryNames[normalizeLabelKey(value)] ?? value;
}

function formatLeagueLine(event: OddsEvent) {
  const country = formatLeagueCountry(event.league_country);
  return country ? `${event.league_name} - ${country}` : event.league_name;
}

function selectionLabel(value: string) {
  if (value === "HOME") return "1";
  if (value === "DRAW") return "X";
  if (value === "AWAY") return "2";
  return value;
}

function formatOdd(value: number | undefined) {
  return value ? value.toFixed(2) : "-";
}

function getBest1x2Odds(event: OddsEvent, category?: PaCategory) {
  const bestBySelection = new Map<string, OddsFeedItem>();

  for (const odd of event.odds) {
    if (odd.market_code !== "1X2") continue;
    if (category && odd.pa_category !== category) continue;
    if (!["HOME", "DRAW", "AWAY"].includes(odd.selection)) continue;

    const current = bestBySelection.get(odd.selection);
    if (!current || odd.price > current.price) {
      bestBySelection.set(odd.selection, odd);
    }
  }

  return selections.map((selection) => ({
    selection,
    odd: bestBySelection.get(selection),
  }));
}

function summaryCategoryLabel(value: string | undefined) {
  if (value === "COM_PA") return "PA";
  if (value === "SEM_PA") return "SEM PA";
  return "";
}

function get1x2Rows(event: OddsEvent, category: PaCategory) {
  const rows = new Map<string, OddsTableRow>();

  for (const odd of event.odds) {
    if (odd.market_code !== "1X2") continue;
    if (odd.pa_category !== category) continue;
    if (!selections.includes(odd.selection as Selection)) continue;

    const selection = odd.selection as Selection;
    const key = `${odd.bookmaker_slug}-${category}`;
    const existing = rows.get(key) ?? {
      bookmakerName: formatBookmakerName(odd.bookmaker_name),
      key,
      odds: {},
    };
    const current = existing.odds[selection];

    if (!current || odd.price > current.price) {
      existing.odds[selection] = odd;
    }

    rows.set(key, existing);
  }

  return Array.from(rows.values()).sort((left, right) =>
    left.bookmakerName.localeCompare(right.bookmakerName, "pt-BR"),
  );
}

function sortRows(rows: OddsTableRow[], sort: OddsSortState | null) {
  if (!sort) {
    return rows;
  }

  return [...rows].sort((left, right) => {
    const leftPrice = left.odds[sort.selection]?.price;
    const rightPrice = right.odds[sort.selection]?.price;

    if (leftPrice === undefined && rightPrice === undefined) {
      return left.bookmakerName.localeCompare(right.bookmakerName, "pt-BR");
    }

    if (leftPrice === undefined) return 1;
    if (rightPrice === undefined) return -1;

    return sort.direction === "desc"
      ? rightPrice - leftPrice
      : leftPrice - rightPrice;
  });
}

function getNextSort(
  current: OddsSortState | null,
  selection: Selection,
): OddsSortState {
  if (!current || current.selection !== selection) {
    return { direction: "desc", selection };
  }

  return {
    direction: current.direction === "desc" ? "asc" : "desc",
    selection,
  };
}

function getHighestPrices(rows: OddsTableRow[]) {
  return selections.reduce<Partial<Record<Selection, number>>>((accumulator, selection) => {
    const prices = rows
      .map((row) => row.odds[selection]?.price)
      .filter((price): price is number => price !== undefined);

    if (prices.length) {
      accumulator[selection] = Math.max(...prices);
    }

    return accumulator;
  }, {});
}

function OddsSummaryRow({ event }: { event: OddsEvent }) {
  const bestOdds = getBest1x2Odds(event);
  const hasAnyOdd = bestOdds.some(({ odd }) => odd);

  return (
    <span className="w-full max-w-[360px] rounded-[18px] border border-white/8 bg-white/[0.025] p-3">
      {!hasAnyOdd ? (
        <span className="mb-2 block text-xs text-[var(--text-muted)]">Sem odds</span>
      ) : null}

      <span className="grid grid-cols-3 gap-2">
        {bestOdds.map(({ selection, odd }) => (
          <span
            className="flex min-h-[66px] flex-col items-center justify-center rounded-[14px] bg-white/[0.035] px-2 py-2 text-center"
            key={`best-${selection}`}
          >
            <span className="text-base font-semibold text-white">
              {formatOdd(odd?.price)}
            </span>
            <span className="mt-0.5 max-w-[96px] truncate text-[10px] text-[var(--text-muted)]">
              {odd
                ? `${formatBookmakerName(odd.bookmaker_name)} ${summaryCategoryLabel(odd.pa_category)}`
                : "Sem odd"}
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}

function EventCard({
  event,
  onOpen,
}: {
  event: OddsEvent;
  onOpen: (event: OddsEvent) => void;
}) {
  return (
    <button
      className="group w-full rounded-[24px] border border-white/10 bg-white/[0.025] p-4 text-left transition hover:border-[rgba(255,139,187,0.28)] hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] md:p-5"
      onClick={() => onOpen(event)}
      type="button"
    >
      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.38fr)] xl:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
            <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {formatDate(event.starts_at)}
            </span>
            <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {formatLeagueLine(event)}
            </span>
          </div>

          <h2 className="mt-4 text-lg font-semibold tracking-tight text-white md:text-xl">
            {event.home_team} x {event.away_team}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            {formatTime(event.starts_at)}
          </p>
        </div>

        <div className="flex w-full justify-center xl:justify-end">
          <OddsSummaryRow event={event} />
        </div>
      </div>
    </button>
  );
}

function SortHeaderButton({
  label,
  onClick,
  selection,
  sort,
}: {
  label: string;
  onClick: (selection: Selection) => void;
  selection: Selection;
  sort: OddsSortState | null;
}) {
  const active = sort?.selection === selection;
  const directionLabel = active ? (sort.direction === "desc" ? "↓" : "↑") : "";

  return (
    <button
      className={`${oddsBoxClass} border border-white/8 bg-white/[0.035] text-[11px] font-semibold text-[var(--text-secondary)] transition hover:bg-white/[0.07] hover:text-white`}
      onClick={() => onClick(selection)}
      type="button"
    >
      <span>{label}</span>
      {directionLabel ? (
        <span className="ml-1 text-[10px] font-medium text-[var(--text-muted)]">
          {directionLabel}
        </span>
      ) : null}
    </button>
  );
}

function OddsTable({
  category,
  event,
  sort,
  onSortChange,
}: {
  category: PaCategory;
  event: OddsEvent;
  sort: OddsSortState | null;
  onSortChange: (category: PaCategory, selection: Selection) => void;
}) {
  const baseRows = get1x2Rows(event, category);
  const highestPrices = getHighestPrices(baseRows);
  const rows = sortRows(baseRows, sort);

  return (
    <section className="min-w-0 rounded-[22px] border border-white/10 bg-white/[0.025] p-3 md:p-4">
      <div className="mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
          {category === "COM_PA" ? "COM PA" : "SEM PA"}
        </h3>
      </div>

      <div className="mt-2 max-h-[56vh] space-y-2 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
        <div
          className={`${oddsTableGridClass} sticky top-0 z-10 rounded-2xl bg-[rgba(29,12,21,0.96)] p-1.5 backdrop-blur`}
        >
          <span className="px-2 text-xs font-medium text-[var(--text-muted)]">
            Casa
          </span>
          {selections.map((selection) => (
            <SortHeaderButton
              key={`${category}-${selection}`}
              label={selectionLabel(selection)}
              onClick={(nextSelection) => onSortChange(category, nextSelection)}
              selection={selection}
              sort={sort}
            />
          ))}
        </div>

        {rows.length ? (
          rows.map((row) => (
            <div
              className={`${oddsTableGridClass} rounded-2xl bg-white/[0.026] p-1.5`}
              key={row.key}
            >
              <span className="min-w-0 truncate px-2 text-xs font-medium text-white">
                {row.bookmakerName}
              </span>
              {selections.map((selection) => (
                <span
                  className={`${oddsBoxClass} text-[13px] font-semibold text-white ${
                    row.odds[selection]?.price === highestPrices[selection]
                      ? "border border-[rgba(255,139,187,0.45)] bg-[rgba(255,139,187,0.16)] shadow-[0_0_18px_rgba(255,139,187,0.08)]"
                      : "border border-transparent bg-white/[0.04]"
                  }`}
                  key={`${row.key}-${selection}`}
                >
                  {formatOdd(row.odds[selection]?.price)}
                </span>
              ))}
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-sm text-[var(--text-muted)]">
            Sem odds 1X2.
          </div>
        )}
      </div>
    </section>
  );
}

function EventOddsPanel({
  event,
  onClose,
}: {
  event: OddsEvent | null;
  onClose: () => void;
}) {
  const [sorts, setSorts] = useState<Record<PaCategory, OddsSortState | null>>({
    COM_PA: null,
    SEM_PA: null,
  });
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!event) return;

    function handleKeyDown(keyboardEvent: KeyboardEvent) {
      if (keyboardEvent.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [event, onClose]);

  if (!event || typeof document === "undefined") {
    return null;
  }

  function handleSortChange(category: PaCategory, selection: Selection) {
    setSorts((current) => ({
      ...current,
      [category]: getNextSort(current[category], selection),
    }));
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(mouseEvent) => {
        if (!dialogRef.current?.contains(mouseEvent.target as Node)) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        aria-modal="true"
        className="lz-panel w-full max-w-6xl rounded-[28px] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.55)] md:p-5"
        onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
        ref={dialogRef}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {formatDate(event.starts_at)}
              </span>
              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {formatLeagueLine(event)}
              </span>
            </div>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-white">
              {event.home_team} x {event.away_team}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {formatTime(event.starts_at)}
            </p>
          </div>

          <button
            aria-label="Fechar"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/4 text-[var(--text-secondary)] transition hover:bg-white/8 hover:text-white"
            onClick={onClose}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="h-4 w-4"
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
          </button>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <OddsTable
            category="COM_PA"
            event={event}
            onSortChange={handleSortChange}
            sort={sorts.COM_PA}
          />
          <OddsTable
            category="SEM_PA"
            event={event}
            onSortChange={handleSortChange}
            sort={sorts.SEM_PA}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function OddsEventSearch() {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<SearchState>({
    events: [],
    loading: false,
    error: null,
  });
  const [selectedEvent, setSelectedEvent] = useState<OddsEvent | null>(null);
  const latestOddUpdatedAtRef = useRef<string | null>(null);
  const queryRef = useRef("");

  const loadEvents = useCallback(
    async (
      search: string,
      options: { signal?: AbortSignal; showLoading?: boolean } = {},
    ) => {
      if (options.showLoading !== false) {
        setState({ events: [], loading: true, error: null });
      }

      try {
        const params = new URLSearchParams({ q: search });
        const response = await fetch(`/api/monitor-odds/events?${params.toString()}`, {
          cache: "no-store",
          signal: options.signal,
        });

        if (response.status === 429) {
          throw new Error("Muitas buscas em pouco tempo. Aguarde alguns segundos.");
        }

        if (!response.ok) {
          throw new Error("Nao foi possivel buscar os eventos.");
        }

        const payload = (await response.json()) as EventsResponse;
        latestOddUpdatedAtRef.current = payload.latest_odd_updated_at ?? null;
        setState({
          events: payload.events ?? [],
          loading: false,
          error: null,
        });
      } catch (error) {
        if (options.signal?.aborted) {
          return;
        }

        setState({
          events: [],
          loading: false,
          error: error instanceof Error ? error.message : "Erro ao buscar eventos.",
        });
      }
    },
    [],
  );

  useEffect(() => {
    const trimmedQuery = query.trim();
    queryRef.current = trimmedQuery;

    if (trimmedQuery.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadEvents(trimmedQuery, { signal: controller.signal });
    }, 260);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [loadEvents, query]);

  useEffect(() => {
    let active = true;

    async function checkFeedStatus() {
      const activeQuery = queryRef.current;

      if (activeQuery.length < 2) {
        return;
      }

      try {
        const response = await fetch("/api/monitor-odds/status", {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as StatusResponse;
        const nextLatestOddUpdatedAt = payload.latest_odd_updated_at ?? null;
        const previousLatestOddUpdatedAt = latestOddUpdatedAtRef.current;

        if (!active || !nextLatestOddUpdatedAt) {
          return;
        }

        if (
          previousLatestOddUpdatedAt &&
          nextLatestOddUpdatedAt !== previousLatestOddUpdatedAt
        ) {
          latestOddUpdatedAtRef.current = nextLatestOddUpdatedAt;
          await loadEvents(activeQuery, { showLoading: false });
          return;
        }

        if (!previousLatestOddUpdatedAt) {
          latestOddUpdatedAtRef.current = nextLatestOddUpdatedAt;
        }
      } catch {
        // Status polling is only a freshness hint; the search remains usable.
      }
    }

    const intervalId = window.setInterval(checkFeedStatus, 10_000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [loadEvents]);

  const hasQuery = query.trim().length >= 2;
  const events = hasQuery ? state.events : [];
  const showEmpty = hasQuery && !state.loading && !state.error && events.length === 0;

  return (
    <div className="space-y-5">
      <section className="lz-panel rounded-[28px] p-5 md:p-6">
        <div className="mx-auto max-w-3xl">
          <label
            className="block text-sm font-semibold text-white"
            htmlFor="odds-event-search"
          >
            Buscar eventos
          </label>
          <input
            autoComplete="off"
            className="lz-input mt-3 h-13 w-full rounded-2xl px-4 text-base"
            id="odds-event-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Digite um time, evento ou liga"
            type="search"
            value={query}
          />
        </div>
      </section>

      {hasQuery && state.loading ? (
        <div className="rounded-[24px] border border-white/10 bg-white/[0.025] p-5 text-sm text-[var(--text-muted)]">
          Buscando eventos...
        </div>
      ) : null}

      {hasQuery && state.error ? (
        <div className="rounded-[24px] border border-[rgba(255,107,133,0.2)] bg-[rgba(255,107,133,0.08)] p-5 text-sm text-[var(--negative)]">
          {state.error}
        </div>
      ) : null}

      {showEmpty ? (
        <div className="rounded-[24px] border border-white/10 bg-white/[0.025] p-5 text-sm text-[var(--text-muted)]">
          Nenhum evento encontrado.
        </div>
      ) : null}

      {events.length ? (
        <section className="space-y-3">
          {events.map((event) => (
            <EventCard
              event={event}
              key={event.fixture_id}
              onOpen={setSelectedEvent}
            />
          ))}
        </section>
      ) : null}

      <EventOddsPanel
        event={selectedEvent}
        key={selectedEvent?.fixture_id ?? "closed"}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}
