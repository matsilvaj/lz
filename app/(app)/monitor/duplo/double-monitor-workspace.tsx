"use client";

import {
  ArrowUpDown,
  Check,
  ChevronDown,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  type FormEvent,
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
  type CalculatorSelectionLine,
} from "@/app/_components/calculator-selection-dock";
import {
  buildDuploAnalysis,
  formatDuploPercent,
  formatDuploBookmakerName,
  getDuploModeLabel,
  type DuploEvent,
  type DuploOddItem,
  type DuploOpportunity,
} from "@/lib/monitor-odds/duplo";
import {
  formatCompetitionName,
  formatLeagueCountryName,
  formatNationalTeamName,
} from "@/lib/monitor-odds/display-names";

type PaModeFilter = "pa_um_lado" | "pa_dois_lados";
type ModeFilter = PaModeFilter | "all";
type SortMode =
  | "profit_desc"
  | "profit_asc"
  | "recent"
  | "oldest"
  | "nearest"
  | "farthest";

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
  latest_odd_updated_at?: string | null;
  odds_version?: string | null;
};

type OddsSnapshot = {
  fixture_id: string;
  latest_odd_updated_at: string | null;
  odds: DuploOddItem[];
};

type OddsResponse = {
  complete?: boolean;
  odds_version?: string | null;
  snapshots?: OddsSnapshot[];
};

type SignalRow = {
  analysis: ReturnType<typeof buildDuploAnalysis>;
  event: DuploEvent;
  opportunity: DuploOpportunity;
};

type BookmakerFilterOption = {
  key: string;
  name: string;
};

type SearchState = {
  error: string | null;
  events: DuploEvent[];
  loading: boolean;
  refreshingOdds: boolean;
};

const paModeFilters: PaModeFilter[] = ["pa_um_lado", "pa_dois_lados"];
const modeFilters: ModeFilter[] = ["all", ...paModeFilters];

const sortLabels: Record<SortMode, string> = {
  farthest: "Mais distante",
  nearest: "Mais próximo",
  oldest: "Mais antigos",
  profit_asc: "Menor lucro",
  profit_desc: "Maior lucro",
  recent: "Mais recentes",
};

const sortOptions: SortMode[] = [
  "profit_desc",
  "profit_asc",
  "recent",
  "oldest",
  "nearest",
  "farthest",
];
const duploEventsMemoryLimit = 20;
const duploOddsSnapshotMemoryLimit = 300;
const duploEventsByRequestKey = new Map<string, DuploEvent[]>();
const duploOddsSnapshotsByFixtureId = new Map<string, OddsSnapshot>();

function isPaModeFilter(value: string): value is PaModeFilter {
  return paModeFilters.some((mode) => mode === value);
}

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

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatLeagueLine(event: DuploEvent) {
  const leagueName = formatCompetitionName(event.league_name, event.league_country);
  const country = formatLeagueCountryName(event.league_country);

  return country ? `${leagueName} - ${country}` : leagueName;
}

function formatFixtureTeams(event: Pick<DuploEvent, "away_team" | "home_team">) {
  const homeTeam = formatNationalTeamName(event.home_team);
  const awayTeam = formatNationalTeamName(event.away_team);

  return {
    awayTeam,
    homeTeam,
    label: `${homeTeam} x ${awayTeam}`,
  };
}

function getProfitClass(value: number) {
  if (Math.abs(value) < 0.005) {
    return "text-white";
  }

  return value > 0 ? "text-emerald-400" : "text-rose-400";
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
): CalculatorSelectionLine[] {
  return opportunity.lines.map((line) => ({
    house: line.bookmakerName,
    id: createCalculatorSelectionId([
      fixtureId,
      line.bookmakerSlug || line.bookmakerName,
      line.marketLabel,
      line.selectionLabel,
      line.paCategory,
    ]),
    meta: getCalculatorMeta(line.marketLabel),
    odd: line.odd,
    pa: line.paCategory === "COM_PA",
    selectionKey: line.selectionLabel,
    selectionLabel: line.selectionLabel,
  }));
}

function areCalculatorSelectionsActive(
  selectedIds: ReadonlySet<string>,
  lines: CalculatorSelectionLine[],
) {
  return lines.length > 0 && lines.every((line) => selectedIds.has(line.id));
}

function BookmakerEventLink({
  bookmakerName,
  children,
  className,
  eventUrl,
}: {
  bookmakerName: string;
  children: ReactNode;
  className: string;
  eventUrl: string | null | undefined;
}) {
  if (eventUrl) {
    return (
      <a
        aria-label={`Abrir evento na ${bookmakerName}`}
        className={`${className} pointer-events-auto`}
        href={eventUrl}
        onClick={(event) => event.stopPropagation()}
        rel="noopener noreferrer"
        target="_blank"
      >
        {children}
      </a>
    );
  }

  return <span className={className}>{children}</span>;
}

function getAvailableBookmakers(events: DuploEvent[]): BookmakerFilterOption[] {
  const bookmakers = new Map<string, string>();

  for (const event of events) {
    for (const odd of event.odds) {
      const key = getBookmakerKey(odd.bookmaker_slug, odd.bookmaker_name);
      const name = formatDuploBookmakerName(odd.bookmaker_name);

      if (!bookmakers.has(key)) {
        bookmakers.set(key, name);
      }
    }
  }

  return Array.from(bookmakers, ([key, name]) => ({ key, name })).sort((left, right) =>
    left.name.localeCompare(right.name, "pt-BR"),
  );
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

function getTimeValue(event: DuploEvent) {
  const timestamp = new Date(event.starts_at).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function sortSignalRows(rows: SignalRow[], mode: SortMode) {
  const now = Date.now();

  return [...rows].sort((left, right) => {
    if (mode === "profit_asc") {
      return left.opportunity.profitPercent - right.opportunity.profitPercent;
    }

    if (mode === "recent") {
      return getTimeValue(right.event) - getTimeValue(left.event);
    }

    if (mode === "oldest") {
      return getTimeValue(left.event) - getTimeValue(right.event);
    }

    if (mode === "nearest") {
      return Math.abs(getTimeValue(left.event) - now) - Math.abs(getTimeValue(right.event) - now);
    }

    if (mode === "farthest") {
      return Math.abs(getTimeValue(right.event) - now) - Math.abs(getTimeValue(left.event) - now);
    }

    const profitOrder =
      right.opportunity.profitPercent - left.opportunity.profitPercent;

    if (profitOrder !== 0) return profitOrder;
    return getTimeValue(left.event) - getTimeValue(right.event);
  });
}

function getSignalRows(
  events: DuploEvent[],
  mode: ModeFilter,
  hiddenBookmakers: ReadonlySet<string>,
  sortMode: SortMode = "profit_desc",
): SignalRow[] {
  const rows = events
    .map((event) => {
      const filteredEvent = filterEventBookmakers(event, hiddenBookmakers);
      const analysis = buildDuploAnalysis(filteredEvent);
      const visibleOpportunities = analysis.all.filter((opportunity) =>
        isPaModeFilter(opportunity.mode),
      );
      const opportunities =
        mode === "all"
          ? visibleOpportunities
          : visibleOpportunities.filter((opportunity) => opportunity.mode === mode);
      const opportunity = opportunities[0] ?? null;

      return opportunity ? { analysis, event: filteredEvent, opportunity } : null;
    })
    .filter((row): row is SignalRow => Boolean(row));

  return sortSignalRows(rows, sortMode);
}

function ModeButton({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean;
  count: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`inline-flex h-11 items-center justify-center gap-3 rounded-full border px-4 text-sm font-semibold transition ${
        active
          ? "border-[rgba(211,27,91,0.78)] bg-[rgba(211,27,91,0.2)] text-white shadow-[0_12px_28px_rgba(211,27,91,0.12)]"
          : "border-white/10 bg-white/[0.035] text-[var(--text-secondary)] hover:border-white/18 hover:bg-white/[0.06] hover:text-white"
      }`}
      onClick={onClick}
      type="button"
    >
      <span>{label}</span>
      <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-white/8 px-2 py-0.5 text-xs text-[var(--text-secondary)]">
        {count}
      </span>
    </button>
  );
}

function BookmakerToggleButton({
  active,
  name,
  onClick,
}: {
  active: boolean;
  name: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`min-w-0 rounded-2xl border px-3 py-2 text-left text-sm font-semibold transition ${
        active
          ? "border-[rgba(211,27,91,0.78)] bg-[rgba(211,27,91,0.18)] text-white"
          : "border-white/10 bg-white/[0.035] text-[var(--text-secondary)] hover:border-white/18 hover:bg-white/[0.06] hover:text-white"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="block truncate">{name}</span>
    </button>
  );
}

function FiltersDialog({
  activeMode,
  availableBookmakers,
  counts,
  hiddenBookmakers,
  onClose,
  onModeChange,
  onReset,
  onToggleBookmaker,
}: {
  activeMode: ModeFilter;
  availableBookmakers: BookmakerFilterOption[];
  counts: Record<ModeFilter, number>;
  hiddenBookmakers: ReadonlySet<string>;
  onClose: () => void;
  onModeChange: (mode: ModeFilter) => void;
  onReset: () => void;
  onToggleBookmaker: (key: string) => void;
}) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[170] flex items-center justify-center overflow-hidden bg-black/65 p-4 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        aria-modal="true"
        className="max-h-[calc(100vh-48px)] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-white/10 bg-[rgba(18,5,13,0.96)] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.48)]"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-dim)]">
              Filtros
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Monitor de duplo
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

        <div className="mt-5 space-y-5">
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
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">Ocultar casas</h3>
              <button
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                onClick={onReset}
                type="button"
              >
                <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
                <span>Limpar</span>
              </button>
            </div>

            {availableBookmakers.length ? (
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {availableBookmakers.map((bookmaker) => (
                  <BookmakerToggleButton
                    active={hiddenBookmakers.has(bookmaker.key)}
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

        <div className="mt-6 flex justify-end">
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

function SortMenu({
  onChange,
  value,
}: {
  onChange: (value: SortMode) => void;
  value: SortMode;
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const updateMenuPosition = useCallback(() => {
    const button = buttonRef.current;

    if (!button) return;

    const rect = button.getBoundingClientRect();
    const menuHeight = 252;
    const gap = 8;
    const viewportPadding = 16;
    const width = Math.max(rect.width, 190);
    const left = Math.min(
      Math.max(viewportPadding, rect.right - width),
      window.innerWidth - width - viewportPadding,
    );
    const hasRoomBelow = rect.bottom + gap + menuHeight <= window.innerHeight;
    const top = hasRoomBelow
      ? rect.bottom + gap
      : Math.max(viewportPadding, rect.top - menuHeight - gap);

    setMenuPosition({ left, top, width });
  }, []);

  useEffect(() => {
    if (!open) return;

    updateMenuPosition();

    function handlePointerDown(event: MouseEvent) {
      const target = event.target;

      if (!(target instanceof Node)) return;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;

      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, updateMenuPosition]);

  const menu =
    open && menuPosition
      ? createPortal(
          <div
            className="fixed z-[80] overflow-hidden rounded-2xl border border-white/10 bg-[rgba(18,5,13,0.98)] p-1 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
            ref={menuRef}
            role="listbox"
            style={{
              left: menuPosition.left,
              top: menuPosition.top,
              width: menuPosition.width,
            }}
          >
            {sortOptions.map((option) => (
              <button
                aria-selected={value === option}
                className={`flex h-10 w-full items-center rounded-xl px-3 text-left text-sm font-semibold transition ${
                  value === option
                    ? "bg-[rgba(211,27,91,0.22)] text-white"
                    : "text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-white"
                }`}
                key={option}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                role="option"
                type="button"
              >
                {sortLabels[option]}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative w-full sm:w-[190px]">
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`inline-flex h-12 w-full items-center justify-between gap-3 rounded-full border px-4 text-sm font-semibold transition ${
          open
            ? "border-[rgba(255,139,187,0.52)] bg-[rgba(255,139,187,0.12)] text-white shadow-[0_12px_30px_rgba(211,27,91,0.12)]"
            : "border-white/10 bg-[rgba(22,10,18,0.72)] text-white hover:border-white/20 hover:bg-white/[0.05]"
        }`}
        onClick={() => setOpen((current) => !current)}
        ref={buttonRef}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2">
          <ArrowUpDown
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-[var(--text-secondary)]"
          />
          <span className="truncate">{sortLabels[value]}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-[var(--text-secondary)] transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {menu}
    </div>
  );
}

function OpportunityLineMini({
  line,
  onToggle,
  selected,
}: {
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
        </span>
        <span className="text-sm font-semibold text-white">
          {line.odd.toFixed(2)}
        </span>
      </div>
    </div>
  );
}

function SignalCard({
  onToggleCalculator,
  row,
  selectedIds,
}: {
  onToggleCalculator: (row: SignalRow) => void;
  row: SignalRow;
  selectedIds: ReadonlySet<string>;
}) {
  const { event, opportunity } = row;
  const teams = formatFixtureTeams(event);
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
        href={`/monitor/odds/${encodeURIComponent(event.fixture_id)}`}
      />

      <div className="pointer-events-none relative z-10 grid gap-4 lg:grid-cols-[minmax(260px,0.9fr)_minmax(460px,1.35fr)_150px] lg:items-center">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-secondary)]">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {formatDate(event.starts_at)}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1">
              {formatTime(event.starts_at)}
            </span>
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
          <strong className={`text-lg font-semibold tabular-nums ${getProfitClass(opportunity.profitPercent)}`}>
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

export function DoubleMonitorWorkspace() {
  const [query, setQuery] = useState("");
  const [activeMode, setActiveMode] = useState<ModeFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hiddenBookmakers, setHiddenBookmakers] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("profit_desc");
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

        const oddsResponse = await fetch("/api/monitor-odds/odds", {
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

        if (!oddsResponse.ok) {
          throw new Error("Não foi possível atualizar as odds dos jogos.");
        }

        const oddsPayload = (await oddsResponse.json()) as OddsResponse;
        if (
          options.signal?.aborted ||
          !isSameEventsRequest(activeRequestRef.current, request)
        ) {
          return;
        }

        if (oddsPayload.complete !== false) {
          rememberOddsSnapshots(oddsPayload.snapshots ?? []);
        }

        const hydratedEvents =
          oddsPayload.complete === false
            ? hydrateEventsWithRememberedOdds(events)
            : mergeOddsSnapshots(events, oddsPayload.snapshots ?? []);
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

  const availableBookmakers = useMemo(
    () => getAvailableBookmakers(state.events),
    [state.events],
  );
  const activeHiddenBookmakers = useMemo(() => {
    const availableKeys = new Set(availableBookmakers.map((bookmaker) => bookmaker.key));
    return new Set(hiddenBookmakers.filter((key) => availableKeys.has(key)));
  }, [availableBookmakers, hiddenBookmakers]);
  const rows = useMemo(
    () => getSignalRows(state.events, activeMode, activeHiddenBookmakers, sortMode),
    [activeHiddenBookmakers, activeMode, sortMode, state.events],
  );
  const showSignalSkeleton =
    state.loading || (state.refreshingOdds && !rows.length && state.events.length > 0);
  const selectedCalculatorIds = useMemo(
    () => new Set(calculatorSelections.map((selection) => selection.id)),
    [calculatorSelections],
  );
  const counts = useMemo(() => {
    return modeFilters.reduce<Record<ModeFilter, number>>(
      (accumulator, mode) => {
        accumulator[mode] = getSignalRows(
          state.events,
          mode,
          activeHiddenBookmakers,
        ).length;
        return accumulator;
      },
      {
        all: 0,
        pa_dois_lados: 0,
        pa_um_lado: 0,
      },
    );
  }, [activeHiddenBookmakers, state.events]);

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

  function handleToggleBookmaker(key: string) {
    setHiddenBookmakers((current) =>
      current.includes(key)
        ? current.filter((bookmakerKey) => bookmakerKey !== key)
        : [...current, key],
    );
  }

  function handleResetFilters() {
    setActiveMode("all");
    setHiddenBookmakers([]);
  }

  function handleToggleCalculatorRow(row: SignalRow) {
    const selections = getOpportunityCalculatorSelections(
      row.event.fixture_id,
      row.opportunity,
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
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Digite um time, evento ou liga"
              type="search"
              value={query}
            />
            <div className="grid gap-3 sm:grid-cols-[130px_190px_120px]">
              <button
                aria-expanded={filtersOpen}
                className={`inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border px-4 text-sm font-semibold transition ${
                  filtersOpen || activeMode !== "all" || activeHiddenBookmakers.size > 0
                    ? "border-[rgba(255,139,187,0.42)] bg-[rgba(255,139,187,0.16)] text-white"
                    : "border-white/10 bg-white/[0.035] text-[var(--text-secondary)] hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                }`}
                onClick={() => setFiltersOpen((current) => !current)}
                type="button"
              >
                <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
                Filtros
              </button>
              <SortMenu onChange={setSortMode} value={sortMode} />
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
          availableBookmakers={availableBookmakers}
          counts={counts}
          hiddenBookmakers={activeHiddenBookmakers}
          onClose={() => setFiltersOpen(false)}
          onModeChange={setActiveMode}
          onReset={handleResetFilters}
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
            ) : rows.length ? (
              rows.map((row) => (
                <SignalCard
                  key={row.event.fixture_id}
                  onToggleCalculator={handleToggleCalculatorRow}
                  row={row}
                  selectedIds={selectedCalculatorIds}
                />
              ))
            ) : (
              <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 text-sm text-[var(--text-muted)]">
                Nenhum sinal encontrado para este filtro.
              </div>
            )}
          </div>

          {state.refreshingOdds ? (
            <p className="text-xs font-medium text-[var(--text-dim)]">
              Atualizando odds dos jogos...
            </p>
          ) : null}
        </div>
      </section>

      <CalculatorSelectionDock
        onClear={() => setCalculatorSelections([])}
        onRemove={handleRemoveCalculatorSelection}
        selections={calculatorSelections}
      />
    </div>
  );
}
