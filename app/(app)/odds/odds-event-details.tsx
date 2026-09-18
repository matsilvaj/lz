"use client";

import {
  ArrowLeft,
  CalendarCheck,
  Check,
  Gift,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
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
  parseConversionContextParams,
  type CalculatorConversionContext,
  type CalculatorSelectionLine,
} from "@/app/_components/calculator-selection-dock";
import { ExchangeCommissionTag } from "@/app/(app)/_components/exchange-commission-tag";
import { redirectToLoginOnUnauthorized } from "@/lib/auth/client-redirect";
import {
  useMonitorOddsStatusFeed,
  type MonitorOddsStatus as StatusResponse,
} from "@/lib/monitor-odds/use-status-feed";
import {
  applyExchangeCommission,
  BET365_BOOKMAKER_KEY,
  BET365_BOOKMAKER_LABEL,
  buildDuploAnalysis,
  formatDuploPercent,
  REQUIRED_BOOKMAKER_PARAM,
  type DuploOpportunity,
} from "@/lib/monitor-odds/duplo";
import { getBookmakerCommission } from "@/lib/monitor-odds/exchange";
import {
  buildFreebetConversionAnalysis,
  formatFreebetConversionPercent,
  getFreebetConversionBookmakerKey,
  type FreebetConversionMode,
  type FreebetConversionOpportunity,
} from "@/lib/monitor-odds/freebet-conversion";
import { formatCurrency } from "@/lib/format";
import { BookmakerEventLink } from "@/app/(app)/monitor/_components/signal-controls";
import { areCalculatorSelectionsActive } from "@/lib/monitor-odds/signal-helpers";

import {
  type BookmakerFilterOption,
  BookmakerToggleButton,
  type OddsEvent,
  type OddsFeedItem,
  formatDate,
  formatFixtureTeams,
  formatLeagueLine,
  formatTime,
} from "./odds-shared";

type OddsSnapshotItem = Pick<
  OddsFeedItem,
  | "bookmaker_slug"
  | "bookmaker_name"
  | "bookmaker_event_url"
  | "market_code"
  | "market_name"
  | "selection"
  | "price"
  | "pa_category"
  | "confidence_score"
  | "odd_updated_at"
>;

type OddsSnapshot = {
  fixture_id: string;
  latest_odd_updated_at: string | null;
  odds: OddsSnapshotItem[];
};

type OddsResponse = {
  complete?: boolean;
  odds_version?: string | null;
  snapshots?: OddsSnapshot[];
  stale?: boolean;
};

type OddsRefreshResult = {
  events: OddsEvent[];
  oddsVersion: string | null;
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
  "grid grid-cols-[minmax(84px,1fr)_repeat(3,minmax(54px,78px))] items-center gap-1.5 sm:grid-cols-[minmax(120px,1fr)_repeat(3,minmax(62px,90px))] sm:gap-2";

const oddsBoxClass =
  "flex h-9 w-full min-w-0 items-center justify-center rounded-xl px-2 text-center";

const oddsSnapshotMemoryLimit = 300;

const lastOddsUpdateFormatter = new Intl.DateTimeFormat("pt-BR", {
  timeStyle: "short",
});

function formatLastOddsUpdate(value: string | null) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return lastOddsUpdateFormatter.format(date);
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

const oddsSnapshotsByFixtureId = new Map<string, OddsSnapshot>();

function getSnapshotFromEvent(event: OddsEvent): OddsSnapshot | null {
  if (!event.odds.length) {
    return null;
  }

  return {
    fixture_id: event.fixture_id,
    latest_odd_updated_at: event.latest_odd_updated_at,
    odds: event.odds.map((odd) => ({
      bookmaker_event_url: odd.bookmaker_event_url,
      bookmaker_name: odd.bookmaker_name,
      bookmaker_slug: odd.bookmaker_slug,
      confidence_score: odd.confidence_score,
      market_code: odd.market_code,
      market_name: odd.market_name,
      odd_updated_at: odd.odd_updated_at,
      pa_category: odd.pa_category,
      price: odd.price,
      selection: odd.selection,
    })),
  };
}

function rememberOddsSnapshots(snapshots: OddsSnapshot[]) {
  for (const snapshot of snapshots) {
    if (!snapshot.fixture_id || !snapshot.odds.length) {
      continue;
    }

    oddsSnapshotsByFixtureId.delete(snapshot.fixture_id);
    oddsSnapshotsByFixtureId.set(snapshot.fixture_id, snapshot);
  }

  while (oddsSnapshotsByFixtureId.size > oddsSnapshotMemoryLimit) {
    const oldestFixtureId = oddsSnapshotsByFixtureId.keys().next().value;

    if (!oldestFixtureId) {
      return;
    }

    oddsSnapshotsByFixtureId.delete(oldestFixtureId);
  }
}

function rememberEventOdds(events: OddsEvent[]) {
  const snapshots = events
    .map(getSnapshotFromEvent)
    .filter((snapshot): snapshot is OddsSnapshot => Boolean(snapshot));

  rememberOddsSnapshots(snapshots);
}

function hydrateEventsWithRememberedOdds(events: OddsEvent[]) {
  const snapshots = events
    .map((event) => oddsSnapshotsByFixtureId.get(event.fixture_id))
    .filter((snapshot): snapshot is OddsSnapshot => Boolean(snapshot));

  if (!snapshots.length) {
    return events;
  }

  return mergeOddsSnapshots(events, snapshots, {
    preserveExistingOddsOnEmptySnapshot: true,
  });
}

function mergeOddsSnapshots(
  events: OddsEvent[],
  snapshots: OddsSnapshot[],
  options: { preserveExistingOddsOnEmptySnapshot?: boolean } = {},
) {
  const snapshotsByFixtureId = new Map(
    snapshots.map((snapshot) => [snapshot.fixture_id, snapshot]),
  );

  return events.map((event) => {
    const snapshot = snapshotsByFixtureId.get(event.fixture_id);

    if (
      options.preserveExistingOddsOnEmptySnapshot &&
      event.odds.length &&
      (!snapshot || !snapshot.odds.length)
    ) {
      return event;
    }

    const odds = (snapshot?.odds ?? [])
      .map((odd) => ({
        fixture_id: event.fixture_id,
        api_football_fixture_id: event.api_football_fixture_id,
        fixture_name: event.fixture_name,
        home_team: event.home_team,
        away_team: event.away_team,
        starts_at: event.starts_at,
        status: event.status,
        round: event.round,
        league_name: event.league_name,
        league_slug: event.league_slug,
        league_country: event.league_country,
        league_logo_url: event.league_logo_url,
        league_country_flag_url: event.league_country_flag_url,
        ...odd,
      }))
      .sort((left, right) => {
        const marketOrder = left.market_code.localeCompare(right.market_code);
        if (marketOrder !== 0) return marketOrder;

        const categoryOrder = left.pa_category.localeCompare(right.pa_category);
        if (categoryOrder !== 0) return categoryOrder;

        const bookmakerOrder = left.bookmaker_name.localeCompare(right.bookmaker_name);
        if (bookmakerOrder !== 0) return bookmakerOrder;

        return left.selection.localeCompare(right.selection);
      });

    return {
      ...event,
      bookmaker_count: new Set(odds.map((odd) => odd.bookmaker_slug)).size,
      latest_odd_updated_at: snapshot?.latest_odd_updated_at ?? null,
      odd_count: odds.length,
      odds,
    };
  });
}

async function fetchOddsForEvents(
  events: OddsEvent[],
  oddsVersion: string | null,
  options: { signal?: AbortSignal } = {},
): Promise<OddsRefreshResult> {
  if (!events.length) {
    return {
      events,
      oddsVersion,
    };
  }

  const response = await fetch("/api/monitor-odds/odds", {
    body: JSON.stringify({
      fixtureIds: events.map((event) => event.fixture_id),
      oddsVersion,
    }),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
    signal: options.signal,
  });

  if (redirectToLoginOnUnauthorized(response)) {
    throw new Error("Sessao encerrada.");
  }

  if (response.status === 429) {
    throw new Error("Muitas atualizacoes em pouco tempo. Aguarde alguns segundos.");
  }

  if (!response.ok) {
    throw new Error("Nao foi possivel atualizar as odds.");
  }

  const payload = (await response.json()) as OddsResponse;
  const isComplete = payload.complete !== false && payload.stale !== true;

  if (!isComplete) {
    return {
      events,
      oddsVersion: null,
    };
  }

  const snapshots = payload.snapshots ?? [];
  rememberOddsSnapshots(snapshots);

  return {
    events: mergeOddsSnapshots(events, snapshots, {
      preserveExistingOddsOnEmptySnapshot: true,
    }),
    oddsVersion: payload.odds_version ?? oddsVersion,
  };
}

function selectionLabel(value: string) {
  if (value === "HOME") return "1";
  if (value === "DRAW") return "X";
  if (value === "AWAY") return "2";
  return value;
}

function formatOdd(value: number | undefined) {
  return value ? value.toFixed(3) : "-";
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

function getRowEventUrl(row: OddsTableRow) {
  return selections
    .map((selection) => row.odds[selection]?.bookmaker_event_url)
    .find((eventUrl): eventUrl is string => Boolean(eventUrl)) ?? null;
}

function getCalculatorMeta(marketLabel: string) {
  return marketLabel.trim().toUpperCase() === "1X2"
    ? undefined
    : marketLabel;
}

function isConversionFreebetHouse(
  bookmaker: Pick<OddsFeedItem, "bookmaker_name" | "bookmaker_slug">,
  conversionContext: CalculatorConversionContext | null,
) {
  if (!conversionContext) {
    return false;
  }

  const freebetHouseKey = getFreebetConversionBookmakerKey(
    conversionContext.house,
  );

  return (
    getFreebetConversionBookmakerKey(
      bookmaker.bookmaker_name,
      bookmaker.bookmaker_slug,
    ) === freebetHouseKey ||
    getFreebetConversionBookmakerKey(bookmaker.bookmaker_name) === freebetHouseKey
  );
}

function isConversionFreebetLine(
  line: Pick<DuploOpportunity["lines"][number], "bookmakerName" | "bookmakerSlug">,
  conversionContext: CalculatorConversionContext | null,
) {
  if (!conversionContext) {
    return false;
  }

  const freebetHouseKey = getFreebetConversionBookmakerKey(
    conversionContext.house,
  );

  return (
    getFreebetConversionBookmakerKey(
      line.bookmakerName,
      line.bookmakerSlug,
    ) === freebetHouseKey ||
    getFreebetConversionBookmakerKey(line.bookmakerName) === freebetHouseKey
  );
}

function getOddCalculatorSelection(
  fixtureId: string,
  odd: OddsFeedItem,
  conversionContext: CalculatorConversionContext | null = null,
  eventName?: string,
): CalculatorSelectionLine {
  const house = formatBookmakerName(odd.bookmaker_name);
  const lineSelectionLabel = selectionLabel(odd.selection);
  const marketLabel = odd.market_code || odd.market_name || "Odd";
  const freebet = isConversionFreebetHouse(odd, conversionContext);

  return {
    eventName,
    freebet,
    house,
    id: createCalculatorSelectionId([
      fixtureId,
      odd.bookmaker_slug || odd.bookmaker_name,
      marketLabel,
      lineSelectionLabel,
      odd.pa_category,
    ]),
    meta: getCalculatorMeta(marketLabel),
    commission:
      odd.commission_percent ?? getBookmakerCommission(odd.bookmaker_name, odd.bookmaker_slug),
    odd: odd.raw_price ?? odd.price,
    pa: odd.pa_category === "COM_PA",
    selectionKey: lineSelectionLabel,
    selectionLabel: lineSelectionLabel,
    stake: freebet ? conversionContext?.freebetValue : undefined,
  };
}

function getOpportunityCalculatorSelections(
  fixtureId: string,
  opportunity: DuploOpportunity,
  conversionContext: CalculatorConversionContext | null = null,
  eventName?: string,
): CalculatorSelectionLine[] {
  return opportunity.lines.map((line) => {
    const freebet = isConversionFreebetLine(line, conversionContext);

    return {
      eventName,
      freebet,
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
      stake: freebet ? conversionContext?.freebetValue : undefined,
    };
  });
}

function getBookmakerKey(slug: string | null | undefined, name: string) {
  return (slug?.trim() || name.trim() || "casa").toLocaleLowerCase("pt-BR");
}

function getAvailableBookmakers(event: OddsEvent): BookmakerFilterOption[] {
  const bookmakers = new Map<string, string>();

  for (const odd of event.odds) {
    const key = getBookmakerKey(odd.bookmaker_slug, odd.bookmaker_name);
    const name = formatBookmakerName(odd.bookmaker_name);

    if (!bookmakers.has(key)) {
      bookmakers.set(key, name);
    }
  }

  return Array.from(bookmakers, ([key, name]) => ({ key, name })).sort((left, right) =>
    left.name.localeCompare(right.name, "pt-BR"),
  );
}

function filterEventBookmakers(
  event: OddsEvent,
  hiddenBookmakers: ReadonlySet<string>,
) {
  if (!hiddenBookmakers.size) {
    return event;
  }

  const odds = event.odds.filter((odd) => {
    return !hiddenBookmakers.has(
      getBookmakerKey(odd.bookmaker_slug, odd.bookmaker_name),
    );
  });

  return {
    ...event,
    bookmaker_count: new Set(
      odds.map((odd) => getBookmakerKey(odd.bookmaker_slug, odd.bookmaker_name)),
    ).size,
    odd_count: odds.length,
    odds,
  };
}

function OddPricePulse({
  children,
  className,
  price,
  pulseId,
  pulseVersion,
}: {
  children: ReactNode;
  className: string;
  price: number | undefined;
  pulseId: string;
  pulseVersion: number;
}) {
  const elementRef = useRef<HTMLSpanElement | null>(null);
  const previousPriceRef = useRef(price);
  const previousPulseIdRef = useRef(pulseId);
  const previousPulseVersionRef = useRef(pulseVersion);

  useEffect(() => {
    const element = elementRef.current;

    if (previousPulseIdRef.current !== pulseId) {
      previousPulseIdRef.current = pulseId;
      previousPriceRef.current = price;
      previousPulseVersionRef.current = pulseVersion;
      element?.classList.remove("odds-price-move-up", "odds-price-move-down");
      return;
    }

    const previousPrice = previousPriceRef.current;
    const previousPulseVersion = previousPulseVersionRef.current;
    previousPriceRef.current = price;
    previousPulseVersionRef.current = pulseVersion;

    if (
      pulseVersion === previousPulseVersion ||
      price === undefined ||
      previousPrice === undefined ||
      price === previousPrice
    ) {
      return;
    }

    if (!element) {
      return;
    }

    const movementClass =
      price > previousPrice ? "odds-price-move-up" : "odds-price-move-down";

    element.classList.remove("odds-price-move-up", "odds-price-move-down");
    void element.offsetWidth;
    element.classList.add(movementClass);

    const timeoutId = window.setTimeout(() => {
      element.classList.remove(movementClass);
    }, 1400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [price, pulseId, pulseVersion]);

  return (
    <span className={className} ref={elementRef}>
      {children}
    </span>
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
      className={`${oddsBoxClass} odds-sort-button ${
        active ? "odds-sort-button--active" : ""
      } text-[11px] font-semibold transition`}
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

function OddsTableLoadingRows() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, rowIndex) => (
        <div
          aria-hidden="true"
          className={`${oddsTableGridClass} rounded-2xl bg-white/[0.026] p-1.5`}
          key={`odds-loading-row-${rowIndex}`}
        >
          <span className="mx-2 h-4 rounded-full bg-white/8" />
          {selections.map((selection) => (
            <span
              className={`${oddsBoxClass} animate-pulse border border-transparent bg-white/[0.04]`}
              key={`odds-loading-row-${rowIndex}-${selection}`}
            />
          ))}
        </div>
      ))}
    </>
  );
}

function OddsTable({
  category,
  conversionContext,
  event,
  isOddSelected,
  oddsLoading = false,
  onOddToggle,
  pulseVersion,
  sort,
  onSortChange,
}: {
  category: PaCategory;
  conversionContext: CalculatorConversionContext | null;
  event: OddsEvent;
  isOddSelected: (odd: OddsFeedItem) => boolean;
  oddsLoading?: boolean;
  onOddToggle: (odd: OddsFeedItem) => void;
  pulseVersion: number;
  sort: OddsSortState | null;
  onSortChange: (category: PaCategory, selection: Selection) => void;
}) {
  // Montar e ordenar as linhas percorre todas as odds do evento e usa
  // localeCompare; sem memo isso refazia a cada renderizacao, nas duas tabelas.
  const baseRows = useMemo(() => get1x2Rows(event, category), [category, event]);
  const highestPrices = useMemo(() => getHighestPrices(baseRows), [baseRows]);
  const rows = useMemo(() => sortRows(baseRows, sort), [baseRows, sort]);

  return (
    <section className="flex min-h-0 min-w-0 flex-col rounded-[22px] border border-white/10 bg-white/[0.025] p-3 md:p-4">
      <div className="mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
          {category === "COM_PA" ? "COM PA" : "SEM PA"}
        </h3>
      </div>

      <div className="mt-2 min-h-0 max-h-[34dvh] space-y-2 overflow-y-auto overscroll-contain pr-1 sm:max-h-[40dvh] lg:max-h-[56vh] [scrollbar-gutter:stable]">
        <div
          className={`${oddsTableGridClass} odds-table-header sticky top-0 z-10 rounded-2xl p-1.5 backdrop-blur`}
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
          rows.map((row) => {
            const eventUrl = getRowEventUrl(row);
            const freebetRow = Object.values(row.odds).some((odd) =>
              odd ? isConversionFreebetHouse(odd, conversionContext) : false,
            );

            return (
              <div
                className={`${oddsTableGridClass} rounded-2xl bg-white/[0.026] p-1.5`}
                key={row.key}
              >
                <span className="flex min-w-0 items-center gap-2 px-2">
                  <BookmakerEventLink
                    bookmakerName={row.bookmakerName}
                    className={`min-w-0 truncate text-xs font-medium no-underline transition ${
                      eventUrl
                        ? "text-white hover:text-[var(--accent-soft)] focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
                        : "text-white"
                    }`}
                    eventUrl={eventUrl}
                  >
                    {row.bookmakerName}
                  </BookmakerEventLink>
                  <ExchangeCommissionTag
                    commission={
                      Object.values(row.odds).find((odd) => odd?.commission_percent)
                        ?.commission_percent ?? 0
                    }
                  />
                  {freebetRow ? (
                    <>
                      <Gift
                        aria-label="Freebet"
                        className="h-3.5 w-3.5 shrink-0 text-[#ff9bbd] sm:hidden"
                      />
                      <span className="hidden sm:inline-flex">
                        <FreebetTag />
                      </span>
                    </>
                  ) : null}
                </span>
                {selections.map((selection) => {
                  const odd = row.odds[selection];
                  const selected = odd ? isOddSelected(odd) : false;
                  const highlighted = odd?.price === highestPrices[selection];

                  return (
                    <button
                      aria-pressed={selected}
                      className={`${oddsBoxClass} text-[13px] font-semibold text-white transition ${
                        selected
                          ? "border border-[rgba(191,219,254,0.72)] bg-[rgba(59,130,246,0.18)] shadow-[0_0_18px_rgba(147,197,253,0.16)]"
                          : highlighted
                            ? "border border-[rgba(255,139,187,0.45)] bg-[rgba(255,139,187,0.16)] shadow-[0_0_18px_rgba(255,139,187,0.08)]"
                            : "border border-transparent bg-white/[0.04]"
                      } ${
                        odd
                          ? "hover:border-[rgba(191,219,254,0.5)] hover:bg-[rgba(59,130,246,0.12)]"
                          : "cursor-default opacity-55"
                      }`}
                      disabled={!odd}
                      key={`${row.key}-${selection}`}
                      onClick={() => {
                        if (odd) {
                          onOddToggle(odd);
                        }
                      }}
                      type="button"
                    >
                      <OddPricePulse
                        className="tabular-nums"
                        price={odd?.price}
                        pulseId={`table:${row.key}:${selection}`}
                        pulseVersion={pulseVersion}
                      >
                        {formatOdd(odd?.price)}
                      </OddPricePulse>
                    </button>
                  );
                })}
              </div>
            );
          })
        ) : oddsLoading ? (
          <OddsTableLoadingRows />
        ) : (
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-sm text-[var(--text-muted)]">
            Sem odds 1X2.
          </div>
        )}
      </div>
    </section>
  );
}

function BookmakerFiltersDialog({
  availableBookmakers,
  hiddenBookmakers,
  onClose,
  onHideAll,
  onReset,
  onToggleBookmaker,
}: {
  availableBookmakers: BookmakerFilterOption[];
  hiddenBookmakers: ReadonlySet<string>;
  onClose: () => void;
  onHideAll: () => void;
  onReset: () => void;
  onToggleBookmaker: (key: string) => void;
}) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-black/65 p-4 backdrop-blur-md sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        aria-modal="true"
        className="lz-floating-panel flex max-h-[min(760px,calc(100dvh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(18,5,13,0.96)] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.48)] [zoom:0.92]"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-dim)]">
              Filtros
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Casas
            </h2>
          </div>
          <button
            aria-label="Fechar filtros"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.035] text-[var(--text-secondary)] transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">Casas visíveis</h3>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <button
                className="text-[var(--text-secondary)] transition hover:text-white"
                onClick={onReset}
                type="button"
              >
                Marcar todos
              </button>
              <button
                className="text-[var(--text-dim)] transition hover:text-white"
                onClick={onHideAll}
                type="button"
              >
                Desmarcar todos
              </button>
            </div>
          </div>

          {availableBookmakers.length ? (
            <div className="grid gap-1.5 sm:grid-cols-2 md:grid-cols-3">
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
        </div>

        <div className="mt-3 flex shrink-0 justify-end border-t border-white/8 pt-3">
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[rgba(211,27,91,0.7)] bg-[linear-gradient(180deg,rgba(211,27,91,0.95),rgba(163,8,63,0.95))] px-5 text-xs font-semibold text-white shadow-[0_14px_30px_rgba(211,27,91,0.2)] transition hover:brightness-110"
            onClick={onClose}
            type="button"
          >
            <Check aria-hidden="true" className="h-3.5 w-3.5" />
            <span>Aplicar</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function getDuploProfitClass(value: number) {
  if (Math.abs(value) < 0.005) {
    return "text-white";
  }

  return value > 0 ? "text-emerald-400" : "text-rose-400";
}

function FreebetTag() {
  return (
    <span className="shrink-0 rounded-full border border-[rgba(255,119,163,0.32)] bg-[rgba(216,31,89,0.16)] px-2 py-0.5 text-[10px] font-semibold text-[#ff9bbd]">
      Freebet
    </span>
  );
}

function DuploLineBadge({
  freebet = false,
  line,
}: {
  freebet?: boolean;
  line: DuploOpportunity["lines"][number];
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl border px-3 py-2.5 ${
        freebet
          ? "border-[rgba(255,119,163,0.42)] bg-[rgba(216,31,89,0.1)]"
          : "border-white/8 bg-white/[0.035]"
      }`}
      title={freebet ? `${line.bookmakerName} · Freebet` : undefined}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          {freebet ? (
            <Gift aria-label="Freebet" className="h-3.5 w-3.5 shrink-0 text-[#ff9bbd]" />
          ) : null}
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
        <span className="shrink-0 text-sm font-semibold text-white">
          {line.odd.toFixed(3)}
        </span>
      </div>
    </div>
  );
}

function DuploTopList({
  conversionContext,
  event,
  onToggleOpportunity,
  opportunities,
  selectedIds,
  title,
}: {
  conversionContext: CalculatorConversionContext | null;
  event: OddsEvent;
  onToggleOpportunity: (opportunity: DuploOpportunity) => void;
  opportunities: DuploOpportunity[];
  selectedIds: ReadonlySet<string>;
  title: string;
}) {
  return (
    <section className="rounded-[22px] border border-white/10 bg-white/[0.025] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
        {title}
      </h3>

      <div className="mt-4 space-y-2">
        {opportunities.length ? (
          opportunities.map((opportunity, index) => {
            const selected = areCalculatorSelectionsActive(
              selectedIds,
              getOpportunityCalculatorSelections(
                event.fixture_id,
                opportunity,
                conversionContext,
              ),
            );

            return (
              <div
                aria-pressed={selected}
                className={`grid cursor-pointer gap-3 rounded-2xl border p-3 transition lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center ${
                  selected
                    ? "border-[rgba(191,219,254,0.66)] bg-[rgba(59,130,246,0.14)] shadow-[0_0_20px_rgba(147,197,253,0.12)]"
                    : "border-white/8 bg-white/[0.024] hover:border-[rgba(255,139,187,0.24)] hover:bg-white/[0.04]"
                }`}
                key={`${opportunity.mode}-${opportunity.family}-${index}`}
                onClick={() => onToggleOpportunity(opportunity)}
                onKeyDown={(keyboardEvent: ReactKeyboardEvent<HTMLDivElement>) => {
                  if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") {
                    return;
                  }

                  keyboardEvent.preventDefault();
                  onToggleOpportunity(opportunity);
                }}
                role="button"
                tabIndex={0}
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-xs font-semibold text-[var(--text-secondary)]">
                  {index + 1}
                </span>
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {opportunity.lines.map((line, lineIndex) => (
                    <DuploLineBadge
                      key={`${line.bookmakerSlug}-${line.selectionLabel}-${lineIndex}`}
                      line={line}
                    />
                  ))}
                </div>
                <span
                  className={`text-sm font-semibold ${getDuploProfitClass(
                    opportunity.profitPercent,
                  )}`}
                >
                  {formatDuploPercent(opportunity.profitPercent)}
                </span>
              </div>
            );
          })
        ) : (
          <p className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-sm text-[var(--text-muted)]">
            Sem combinações suficientes.
          </p>
        )}
      </div>
    </section>
  );
}

const CONVERSION_MODE_SECTIONS: Array<{ mode: FreebetConversionMode; title: string }> = [
  { mode: "pa_um_lado", title: "Top 5 - PA para 1 dos lados" },
  { mode: "pa_dois_lados", title: "Top 5 - PA para os Dois lados" },
];

function getConversionCalculatorSelections(
  fixtureId: string,
  opportunity: FreebetConversionOpportunity,
  eventName?: string,
): CalculatorSelectionLine[] {
  return [
    ...opportunity.lines.filter((line) => line.role === "freebet"),
    ...opportunity.lines.filter((line) => line.role !== "freebet"),
  ].map((line) => ({
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

function ConversionEventAnalysis({
  conversionContext,
  event,
  onToggleOpportunity,
  selectedIds,
}: {
  conversionContext: CalculatorConversionContext;
  event: OddsEvent;
  onToggleOpportunity: (opportunity: FreebetConversionOpportunity) => void;
  selectedIds: ReadonlySet<string>;
}) {
  const analysis = buildFreebetConversionAnalysis(event, {
    freebetHouse: conversionContext.house,
    freebetValue: conversionContext.freebetValue,
    maxOdd: conversionContext.maxOdd,
    minOdd: conversionContext.minOdd,
  });

  return (
    <section className="grid gap-3 xl:grid-cols-2">
      {CONVERSION_MODE_SECTIONS.map((section) => {
        const opportunities = analysis.all
          .filter((opportunity) => opportunity.mode === section.mode)
          .slice(0, 5);

        return (
          <div
            className="rounded-[22px] border border-white/10 bg-white/[0.025] p-4"
            key={section.mode}
          >
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
              {section.title}
            </h3>

            <div className="mt-4 space-y-2">
              {opportunities.length ? (
                opportunities.map((opportunity, index) => {
                  const selected = getConversionCalculatorSelections(
                    event.fixture_id,
                    opportunity,
                  ).every((selection) => selectedIds.has(selection.id));

                  return (
                    <div
                      aria-pressed={selected}
                      className={`grid cursor-pointer gap-3 rounded-2xl border p-3 transition lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center ${
                        selected
                          ? "border-[rgba(191,219,254,0.66)] bg-[rgba(59,130,246,0.14)] shadow-[0_0_20px_rgba(147,197,253,0.12)]"
                          : "border-white/8 bg-white/[0.024] hover:border-[rgba(255,139,187,0.24)] hover:bg-white/[0.04]"
                      }`}
                      key={`${section.mode}-${index}`}
                      onClick={() => onToggleOpportunity(opportunity)}
                      onKeyDown={(keyboardEvent: ReactKeyboardEvent<HTMLDivElement>) => {
                        if (keyboardEvent.key !== "Enter" && keyboardEvent.key !== " ") {
                          return;
                        }

                        keyboardEvent.preventDefault();
                        onToggleOpportunity(opportunity);
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-xs font-semibold text-[var(--text-secondary)]">
                        {index + 1}
                      </span>
                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {opportunity.lines.map((line, lineIndex) => (
                          <DuploLineBadge
                            freebet={line.role === "freebet"}
                            key={`${line.bookmakerSlug}-${line.selectionLabel}-${lineIndex}`}
                            line={line}
                          />
                        ))}
                      </div>
                      <span className="flex items-baseline justify-between gap-2 lg:flex-col lg:items-end lg:gap-0.5">
                        <span
                          className={`text-sm font-semibold ${getDuploProfitClass(
                            opportunity.conversionPercent,
                          )}`}
                        >
                          {formatFreebetConversionPercent(opportunity.conversionPercent)}
                        </span>
                        <span className="text-[11px] font-semibold text-[var(--text-dim)]">
                          {formatCurrency(opportunity.profitAmount)}
                        </span>
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="rounded-2xl border border-white/8 bg-white/[0.02] p-4 text-sm text-[var(--text-muted)]">
                  Sem combinações com {conversionContext.house} como freebet.
                </p>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function DuploEventAnalysis({
  conversionContext,
  event,
  onToggleOpportunity,
  requiredBookmaker = null,
  selectedIds,
}: {
  conversionContext: CalculatorConversionContext | null;
  event: OddsEvent;
  onToggleOpportunity: (opportunity: DuploOpportunity) => void;
  requiredBookmaker?: string | null;
  selectedIds: ReadonlySet<string>;
}) {
  // So refaz quando o evento muda de verdade (odds novas ou filtro de casas).
  // Solto no corpo do componente, isso rodava a cada renderizacao.
  const analysis = useMemo(
    () => buildDuploAnalysis(event, requiredBookmaker),
    [event, requiredBookmaker],
  );

  if (!analysis.all.length) {
    return (
      <section className="rounded-[22px] border border-white/10 bg-white/[0.025] p-4 text-sm text-[var(--text-muted)]">
        {requiredBookmaker
          ? `Sem combinações com a ${BET365_BOOKMAKER_LABEL} neste evento.`
          : "Sem sinais de duplo suficientes para este evento."}
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="grid gap-3 xl:grid-cols-2">
        <DuploTopList
          conversionContext={conversionContext}
          event={event}
          onToggleOpportunity={onToggleOpportunity}
          opportunities={analysis.paSingleTop}
          selectedIds={selectedIds}
          title="Top 5 - PA para 1 dos lados"
        />
        <DuploTopList
          conversionContext={conversionContext}
          event={event}
          onToggleOpportunity={onToggleOpportunity}
          opportunities={analysis.paBothTop}
          selectedIds={selectedIds}
          title="Top 5 - PA para os Dois lados"
        />
      </div>
    </section>
  );
}

export function OddsEventDetails({
  backHref = "/monitor/odds",
  event,
}: {
  backHref?: string;
  event: OddsEvent;
}) {
  const searchParams = useSearchParams();
  const conversionContext = useMemo(
    () => parseConversionContextParams(searchParams),
    [searchParams],
  );
  const requiredBookmaker = conversionContext
    ? null
    : searchParams.get(REQUIRED_BOOKMAKER_PARAM) === BET365_BOOKMAKER_KEY
      ? BET365_BOOKMAKER_KEY
      : null;
  const effectiveBackHref = conversionContext
    ? "/monitor/converter-freebet"
    : requiredBookmaker
      ? "/monitor/semanal-bet365"
      : backHref;
  const [currentEventState, setCurrentEvent] = useState(() => ({
    event,
    fixtureId: event.fixture_id,
  }));
  const currentEvent =
    currentEventState.fixtureId === event.fixture_id
      ? currentEventState.event
      : event;
  const [sorts, setSorts] = useState<Record<PaCategory, OddsSortState | null>>({
    COM_PA: null,
    SEM_PA: null,
  });
  const [oddsPulseVersion, setOddsPulseVersion] = useState(0);
  const [refreshingOdds, setRefreshingOdds] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hiddenBookmakers, setHiddenBookmakers] = useState<string[]>([]);
  const [calculatorSelections, setCalculatorSelections] = useState<
    CalculatorSelectionLine[]
  >([]);
  const currentEventRef = useRef(event);
  const currentEventFixtureIdRef = useRef(event.fixture_id);
  const latestOddsVersionRef = useRef<string | null>(event.latest_odd_updated_at);
  const lastOddsUpdateLabel = formatLastOddsUpdate(
    currentEvent.latest_odd_updated_at,
  );
  const currentFixtureTeams = formatFixtureTeams(currentEvent);
  const availableBookmakers = useMemo(
    () => getAvailableBookmakers(currentEvent),
    [currentEvent],
  );
  const activeHiddenBookmakers = useMemo(() => {
    const availableKeys = new Set(availableBookmakers.map((bookmaker) => bookmaker.key));
    return new Set(hiddenBookmakers.filter((key) => availableKeys.has(key)));
  }, [availableBookmakers, hiddenBookmakers]);
  const filteredCurrentEvent = useMemo(
    () => filterEventBookmakers(currentEvent, activeHiddenBookmakers),
    [activeHiddenBookmakers, currentEvent],
  );
  const tableEvent = useMemo(
    () => applyExchangeCommission(filteredCurrentEvent),
    [filteredCurrentEvent],
  );
  const selectedCalculatorIds = useMemo(
    () => new Set(calculatorSelections.map((selection) => selection.id)),
    [calculatorSelections],
  );

  useEffect(() => {
    currentEventRef.current = currentEvent;
    rememberEventOdds([currentEvent]);

    if (currentEvent.fixture_id !== currentEventFixtureIdRef.current) {
      currentEventFixtureIdRef.current = currentEvent.fixture_id;
      latestOddsVersionRef.current = currentEvent.latest_odd_updated_at;
    }
  }, [currentEvent]);

  useEffect(() => {
    let active = true;
    const [rememberedEvent] = hydrateEventsWithRememberedOdds([event]);

    if (
      rememberedEvent &&
      rememberedEvent.odds.length > event.odds.length
    ) {
      currentEventRef.current = rememberedEvent;
      window.setTimeout(() => {
        if (!active) {
          return;
        }

        setCurrentEvent({
          event: rememberedEvent,
          fixtureId: rememberedEvent.fixture_id,
        });
      }, 0);
    }

    return () => {
      active = false;
    };
  }, [event]);

  const handleStatusUpdate = useCallback(async (payload: StatusResponse) => {
    const nextOddsVersion =
      payload.odds_version ?? payload.latest_odd_updated_at ?? null;

    if (!nextOddsVersion || nextOddsVersion === latestOddsVersionRef.current) {
      return;
    }

    setRefreshingOdds(true);

    try {
      const previousEvent = currentEventRef.current;
      const result = await fetchOddsForEvents(
        [previousEvent],
        nextOddsVersion,
      );
      const [updatedEvent] = result.events;

      if (!updatedEvent) {
        return;
      }

      if (result.oddsVersion) {
        latestOddsVersionRef.current = result.oddsVersion;
      }

      if (
        updatedEvent.latest_odd_updated_at === previousEvent.latest_odd_updated_at &&
        updatedEvent.odd_count === previousEvent.odd_count
      ) {
        return;
      }

      currentEventRef.current = updatedEvent;
      setCurrentEvent({
        event: updatedEvent,
        fixtureId: updatedEvent.fixture_id,
      });
      setOddsPulseVersion((current) => current + 1);
    } catch {
      // Detail odds refresh is best-effort; the current snapshot remains visible.
    } finally {
      setRefreshingOdds(false);
    }
  }, []);
  const canPollStatus = useCallback(() => Boolean(currentEventRef.current.fixture_id), []);

  useMonitorOddsStatusFeed(canPollStatus, handleStatusUpdate);

  function handleSortChange(category: PaCategory, selection: Selection) {
    setSorts((current) => ({
      ...current,
      [category]: getNextSort(current[category], selection),
    }));
  }

  function handleToggleBookmaker(key: string) {
    setHiddenBookmakers((current) =>
      current.includes(key)
        ? current.filter((bookmakerKey) => bookmakerKey !== key)
        : [...current, key],
    );
  }

  function handleResetFilters() {
    setHiddenBookmakers([]);
  }

  function handleToggleCalculatorOdd(odd: OddsFeedItem) {
    const selection = getOddCalculatorSelection(
      currentEvent.fixture_id,
      odd,
      conversionContext,
      formatFixtureTeams(currentEvent).label,
    );

    setCalculatorSelections((current) =>
      current.some((item) => item.id === selection.id)
        ? current.filter((item) => item.id !== selection.id)
        : mergeCalculatorSelections(current, [selection]),
    );
  }

  function handleToggleCalculatorOpportunity(opportunity: DuploOpportunity) {
    const selections = getOpportunityCalculatorSelections(
      currentEvent.fixture_id,
      opportunity,
      conversionContext,
      formatFixtureTeams(currentEvent).label,
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

  function handleToggleConversionOpportunity(opportunity: FreebetConversionOpportunity) {
    const selections = getConversionCalculatorSelections(
      currentEvent.fixture_id,
      opportunity,
      formatFixtureTeams(currentEvent).label,
    );

    setCalculatorSelections((current) => {
      const currentIds = new Set(current.map((selection) => selection.id));
      const selected = selections.every((selection) => currentIds.has(selection.id));

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
      <section className="lz-panel rounded-[28px] p-4 md:p-6">
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {formatDate(currentEvent.starts_at)}
              </span>
              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1">
                {formatTime(currentEvent.starts_at)}
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">
              {currentFixtureTeams.label}
            </h1>
            <p className="mt-2 text-sm font-medium text-[var(--text-muted)]">
              {formatLeagueLine(currentEvent)}
            </p>
            {lastOddsUpdateLabel ? (
              <p className="mt-1 text-xs text-[var(--text-dim)]">
                Odds atualizadas às {lastOddsUpdateLabel}
              </p>
            ) : null}
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
            {conversionContext ? (
              <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[rgba(255,119,163,0.3)] bg-[rgba(216,31,89,0.12)] px-3 py-2 sm:mr-1">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[rgba(255,119,163,0.3)] bg-[rgba(216,31,89,0.18)] text-[#ff9bbd]">
                  <Gift aria-hidden="true" className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white">
                    Conversão de freebet
                  </span>
                  <span className="block truncate text-xs text-[var(--text-secondary)]">
                    {conversionContext.house} ·{" "}
                    {formatCurrency(conversionContext.freebetValue)}
                  </span>
                </span>
              </div>
            ) : null}

            {requiredBookmaker ? (
              <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[rgba(250,204,21,0.35)] bg-[rgba(250,204,21,0.08)] px-3 py-2 sm:mr-1">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-[rgba(250,204,21,0.35)] bg-[rgba(250,204,21,0.14)] text-yellow-300">
                  <CalendarCheck aria-hidden="true" className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white">
                    Semanal {BET365_BOOKMAKER_LABEL}
                  </span>
                  <span className="block truncate text-xs text-[var(--text-secondary)]">
                    Só combinações com a {BET365_BOOKMAKER_LABEL}
                  </span>
                </span>
              </div>
            ) : null}

            <Link
              className="lz-button-secondary inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition sm:w-auto"
              href={effectiveBackHref}
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              <span>Voltar</span>
            </Link>

            <button
              className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition sm:w-auto ${
                filtersOpen || activeHiddenBookmakers.size
                  ? "border-[rgba(211,27,91,0.72)] bg-[rgba(211,27,91,0.18)] text-white"
                  : "border-white/10 bg-white/[0.035] text-[var(--text-secondary)] hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
              }`}
              onClick={() => setFiltersOpen(true)}
              type="button"
            >
              <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
              <span>Filtros</span>
              {activeHiddenBookmakers.size ? (
                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-white/10 px-2 py-0.5 text-xs text-[var(--text-secondary)]">
                  {activeHiddenBookmakers.size}
                </span>
              ) : null}
            </button>
          </div>
        </div>
      </section>

      {filtersOpen ? (
        <BookmakerFiltersDialog
          availableBookmakers={availableBookmakers}
          hiddenBookmakers={activeHiddenBookmakers}
          onClose={() => setFiltersOpen(false)}
          onHideAll={() =>
            setHiddenBookmakers(availableBookmakers.map((bookmaker) => bookmaker.key))
          }
          onReset={handleResetFilters}
          onToggleBookmaker={handleToggleBookmaker}
        />
      ) : null}

      {conversionContext ? (
        <ConversionEventAnalysis
          conversionContext={conversionContext}
          event={filteredCurrentEvent}
          onToggleOpportunity={handleToggleConversionOpportunity}
          selectedIds={selectedCalculatorIds}
        />
      ) : (
        <DuploEventAnalysis
          conversionContext={conversionContext}
          event={filteredCurrentEvent}
          requiredBookmaker={requiredBookmaker}
          onToggleOpportunity={handleToggleCalculatorOpportunity}
          selectedIds={selectedCalculatorIds}
        />
      )}

      <div className="grid gap-3 lg:grid-cols-2">
        <OddsTable
          category="COM_PA"
          conversionContext={conversionContext}
          event={tableEvent}
          isOddSelected={(odd) =>
            selectedCalculatorIds.has(
              getOddCalculatorSelection(
                currentEvent.fixture_id,
                odd,
                conversionContext,
              ).id,
            )
          }
          onOddToggle={handleToggleCalculatorOdd}
          onSortChange={handleSortChange}
          oddsLoading={refreshingOdds}
          pulseVersion={oddsPulseVersion}
          sort={sorts.COM_PA}
        />
        <OddsTable
          category="SEM_PA"
          conversionContext={conversionContext}
          event={tableEvent}
          isOddSelected={(odd) =>
            selectedCalculatorIds.has(
              getOddCalculatorSelection(
                currentEvent.fixture_id,
                odd,
                conversionContext,
              ).id,
            )
          }
          onOddToggle={handleToggleCalculatorOdd}
          onSortChange={handleSortChange}
          oddsLoading={refreshingOdds}
          pulseVersion={oddsPulseVersion}
          sort={sorts.SEM_PA}
        />
      </div>

      <CalculatorSelectionDock
        conversionContext={conversionContext}
        onClear={() => setCalculatorSelections([])}
        requiredHouse={requiredBookmaker ? BET365_BOOKMAKER_LABEL : null}
        onRemove={handleRemoveCalculatorSelection}
        selections={calculatorSelections}
      />
    </div>
  );
}
