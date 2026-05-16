"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

const numberFormatter = new Intl.NumberFormat("pt-BR");

function formatDate(value: string | null) {
  if (!value) return "Sem data";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem data";

  return dateFormatter.format(date);
}

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

function EventCard({ event }: { event: OddsEvent }) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-white/[0.025] p-4 md:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
              {event.status ?? "Agendado"}
            </span>
            {event.round ? (
              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
                {event.round}
              </span>
            ) : null}
          </div>

          <h2 className="mt-3 text-lg font-semibold tracking-tight text-white md:text-xl">
            {event.home_team} x {event.away_team}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
            {event.league_name}
            {event.league_country ? ` - ${event.league_country}` : ""} -{" "}
            {formatDate(event.starts_at)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm sm:min-w-[260px]">
          <div className="rounded-2xl bg-white/[0.035] px-3 py-3">
            <p className="text-xs text-[var(--text-dim)]">Casas</p>
            <p className="mt-1 font-semibold text-white">
              {formatNumber(event.bookmaker_count)}
            </p>
          </div>
          <div className="rounded-2xl bg-white/[0.035] px-3 py-3">
            <p className="text-xs text-[var(--text-dim)]">Odds</p>
            <p className="mt-1 font-semibold text-white">{formatNumber(event.odd_count)}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

export function OddsEventSearch() {
  const [query, setQuery] = useState("");
  const [latestOddUpdatedAt, setLatestOddUpdatedAt] = useState<string | null>(null);
  const [state, setState] = useState<SearchState>({
    events: [],
    loading: false,
    error: null,
  });
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
        const nextLatestOddUpdatedAt = payload.latest_odd_updated_at ?? null;
        latestOddUpdatedAtRef.current = nextLatestOddUpdatedAt;
        setLatestOddUpdatedAt(nextLatestOddUpdatedAt);
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
          setLatestOddUpdatedAt(nextLatestOddUpdatedAt);
          await loadEvents(activeQuery, { showLoading: false });
          return;
        }

        if (!previousLatestOddUpdatedAt) {
          latestOddUpdatedAtRef.current = nextLatestOddUpdatedAt;
          setLatestOddUpdatedAt(nextLatestOddUpdatedAt);
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
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-dim)]">
            Odds
          </p>
          <label
            className="mt-4 block text-sm font-semibold text-white"
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
          <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">
            {hasQuery && latestOddUpdatedAt
              ? `Atualizado em ${formatDate(latestOddUpdatedAt)}. A busca e conferida a cada 10s.`
              : "Digite ao menos 2 caracteres para buscar no feed do monitor."}
          </p>
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
            <EventCard event={event} key={event.fixture_id} />
          ))}
        </section>
      ) : null}
    </div>
  );
}
