"use client";

import {
  ArrowLeft,
  ArrowUpDown,
  Check,
  ChevronDown,
  RotateCcw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Link from "next/link";
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
  appendConversionContextParams,
  createCalculatorSelectionId,
  mergeCalculatorSelections,
  type CalculatorConversionContext,
  type CalculatorSelectionLine,
} from "@/app/_components/calculator-selection-dock";
import { redirectToLoginOnUnauthorized } from "@/lib/auth/client-redirect";
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
  formatDuploBookmakerName,
  type DuploEvent,
  type DuploOddItem,
} from "@/lib/monitor-odds/duplo";
import {
  formatCompetitionName,
  formatLeagueCountryName,
  formatNationalTeamName,
} from "@/lib/monitor-odds/display-names";

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

type DateFilter = "all" | "today" | "tomorrow";
type SelectionMode = "registered" | "consultation";
type ConversionSource = "registered" | "consultation";
type ModeFilter = FreebetConversionMode | "all";
type SortMode =
  | "conversion_desc"
  | "conversion_asc"
  | "nearest"
  | "farthest"
  | "recent"
  | "oldest";

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

type OddsResponse = {
  complete?: boolean;
  odds_version?: string | null;
  snapshots?: OddsSnapshot[];
};

type SignalRow = {
  analysis: ReturnType<typeof buildFreebetConversionAnalysis>;
  event: DuploEvent;
  opportunity: FreebetConversionOpportunity;
};

type BookmakerFilterOption = {
  key: string;
  name: string;
};

type LeagueFilterOption = {
  key: string;
  name: string;
};

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
  oldest: "Mais antigos",
  recent: "Mais recentes",
};
const sortOptions: SortMode[] = [
  "conversion_desc",
  "conversion_asc",
  "nearest",
  "farthest",
  "recent",
  "oldest",
];
const converterOddsSnapshotMemoryLimit = 300;
const converterOddsSnapshotsByFixtureId = new Map<string, OddsSnapshot>();
const selectedConversionStorageKey = "lz:monitor-converter-freebet:selected";
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

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(Number.isFinite(value) ? value : 0);
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

function getLeagueKey(event: Pick<DuploEvent, "league_country" | "league_name">) {
  return `${event.league_name || "campeonato"}::${event.league_country || ""}`;
}

function getAvailableLeagues(events: DuploEvent[]): LeagueFilterOption[] {
  const leagues = new Map<string, string>();

  for (const event of events) {
    const key = getLeagueKey(event);
    const name = formatLeagueLine(event);

    if (!leagues.has(key)) {
      leagues.set(key, name);
    }
  }

  return Array.from(leagues, ([key, name]) => ({ key, name })).sort((left, right) =>
    left.name.localeCompare(right.name, "pt-BR"),
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

function getTimeValue(event: DuploEvent) {
  const timestamp = new Date(event.starts_at).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatDateParam(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateFilterKey(filter: DateFilter) {
  if (filter === "all") {
    return null;
  }

  const date = new Date();
  date.setHours(0, 0, 0, 0);

  if (filter === "tomorrow") {
    date.setDate(date.getDate() + 1);
  }

  return formatDateParam(date);
}

function isEventInDateFilter(event: DuploEvent, filter: DateFilter) {
  const filterKey = getDateFilterKey(filter);

  if (!filterKey) {
    return true;
  }

  const eventDate = new Date(event.starts_at);

  if (Number.isNaN(eventDate.getTime())) {
    return false;
  }

  return formatDateParam(eventDate) === filterKey;
}

function getRelativeDateLabel(value: string) {
  const eventDate = new Date(value);

  if (Number.isNaN(eventDate.getTime())) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const eventKey = formatDateParam(eventDate);

  if (eventKey === formatDateParam(today)) {
    return "Hoje";
  }

  if (eventKey === formatDateParam(tomorrow)) {
    return "Amanhã";
  }

  return null;
}

function sortSignalRows(rows: SignalRow[], sortMode: SortMode) {
  const now = Date.now();

  return [...rows].sort((left, right) => {
    if (sortMode === "conversion_asc") {
      return left.opportunity.conversionPercent - right.opportunity.conversionPercent;
    }

    if (sortMode === "nearest") {
      return Math.abs(getTimeValue(left.event) - now) - Math.abs(getTimeValue(right.event) - now);
    }

    if (sortMode === "farthest") {
      return Math.abs(getTimeValue(right.event) - now) - Math.abs(getTimeValue(left.event) - now);
    }

    if (sortMode === "recent") {
      return getTimeValue(right.event) - getTimeValue(left.event);
    }

    if (sortMode === "oldest") {
      return getTimeValue(left.event) - getTimeValue(right.event);
    }

    const conversionOrder =
      right.opportunity.conversionPercent - left.opportunity.conversionPercent;

    if (conversionOrder !== 0) return conversionOrder;
    return getTimeValue(left.event) - getTimeValue(right.event);
  });
}

function getSignalRows(
  events: DuploEvent[],
  group: ConvertibleFreebetGroup | null,
  dateFilter: DateFilter,
  hiddenBookmakers: ReadonlySet<string>,
  minOdd: number,
  maxOdd: number,
  activeMode: ModeFilter,
  selectedLeagueKeys: ReadonlySet<string>,
  sortMode: SortMode,
): SignalRow[] {
  if (!group) {
    return [];
  }

  const freebetHouseKey = getFreebetConversionBookmakerKey(group.casa);
  const rows = events
    .filter((event) => isEventInDateFilter(event, dateFilter))
    .filter(
      (event) =>
        selectedLeagueKeys.size === 0 ||
        selectedLeagueKeys.has(getLeagueKey(event)),
    )
    .map((event) => {
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
      const opportunities =
        activeMode === "all"
          ? analysis.all
          : analysis.all.filter((opportunity) => opportunity.mode === activeMode);
      const opportunity = opportunities[0] ?? null;

      return opportunity ? { analysis, event: filteredEvent, opportunity } : null;
    })
    .filter((row): row is SignalRow => Boolean(row));

  return sortSignalRows(rows, sortMode);
}

function getOpportunityCalculatorSelections(
  fixtureId: string,
  opportunity: FreebetConversionOpportunity,
): CalculatorSelectionLine[] {
  const calculatorLines = [
    ...opportunity.lines.filter((line) => line.role === "freebet"),
    ...opportunity.lines.filter((line) => line.role !== "freebet"),
  ];

  return calculatorLines.map((line) => ({
    freebet: line.role === "freebet",
    house: line.bookmakerName,
    id: createCalculatorSelectionId([
      fixtureId,
      line.bookmakerSlug || line.bookmakerName,
      line.selectionLabel,
      line.paCategory,
      line.role,
    ]),
    odd: line.odd,
    pa: line.paCategory === "COM_PA",
    selectionKey: line.selectionLabel,
    selectionLabel: line.selectionLabel,
    stake: line.role === "freebet" ? opportunity.freebetValue : undefined,
  }));
}

function areCalculatorSelectionsActive(
  selectedIds: ReadonlySet<string>,
  lines: CalculatorSelectionLine[],
) {
  return lines.length > 0 && lines.every((line) => selectedIds.has(line.id));
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

function DateFilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`inline-flex h-11 items-center justify-center rounded-full border px-4 text-sm font-semibold transition ${
        active
          ? "border-[rgba(211,27,91,0.78)] bg-[rgba(211,27,91,0.2)] text-white shadow-[0_12px_28px_rgba(211,27,91,0.12)]"
          : "border-white/10 bg-white/[0.035] text-[var(--text-secondary)] hover:border-white/18 hover:bg-white/[0.06] hover:text-white"
      }`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
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
            className="lz-floating-panel fixed z-[80] overflow-hidden rounded-2xl border border-white/10 bg-[rgba(18,5,13,0.98)] p-1 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
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

function BookmakerToggleButton({
  active,
  disabled,
  name,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  name: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`min-w-0 rounded-2xl border px-3 py-2 text-left text-sm font-semibold transition ${
        disabled
          ? "cursor-not-allowed border-[rgba(45,212,191,0.26)] bg-[rgba(45,212,191,0.08)] text-emerald-200"
          : active
            ? "border-[rgba(211,27,91,0.78)] bg-[rgba(211,27,91,0.18)] text-white"
            : "border-white/10 bg-white/[0.035] text-[var(--text-secondary)] hover:border-white/18 hover:bg-white/[0.06] hover:text-white"
      }`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="flex min-w-0 items-center justify-between gap-2">
        <span className="truncate">{name}</span>
        {disabled ? (
          <span className="shrink-0 rounded-full border border-[rgba(45,212,191,0.32)] bg-[rgba(45,212,191,0.12)] px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
            Freebet
          </span>
        ) : null}
      </span>
    </button>
  );
}

function FiltersDialog({
  activeMode,
  activeDateFilter,
  availableBookmakers,
  availableLeagues,
  counts,
  freebetHouseKey,
  hiddenBookmakers,
  selectedLeagueKeys,
  onClose,
  onClearLeagues,
  onDateFilterChange,
  onModeChange,
  onReset,
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
  selectedLeagueKeys: ReadonlySet<string>;
  onClose: () => void;
  onClearLeagues: () => void;
  onDateFilterChange: (filter: DateFilter) => void;
  onModeChange: (mode: ModeFilter) => void;
  onReset: () => void;
  onToggleLeague: (leagueKey: string) => void;
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
        className="lz-floating-panel max-h-[calc(100vh-48px)] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-white/10 bg-[rgba(18,5,13,0.96)] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.48)]"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-dim)]">
              Filtros
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">
              Converter freebet
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              className="inline-flex h-11 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-4 text-xs font-semibold text-[var(--text-secondary)] transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
              onClick={onReset}
              type="button"
            >
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
              <span>Limpar filtros</span>
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
            <h3 className="text-sm font-semibold text-white">Campeonato</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <ModeButton
                active={selectedLeagueKeys.size === 0}
                count={counts.all}
                label="Todos"
                onClick={onClearLeagues}
              />
              {availableLeagues.map((league) => (
                <button
                  aria-pressed={selectedLeagueKeys.has(league.key)}
                  className={`inline-flex h-11 min-w-0 items-center justify-center rounded-full border px-4 text-sm font-semibold transition ${
                    selectedLeagueKeys.has(league.key)
                      ? "border-[rgba(211,27,91,0.78)] bg-[rgba(211,27,91,0.2)] text-white shadow-[0_12px_28px_rgba(211,27,91,0.12)]"
                      : "border-white/10 bg-white/[0.035] text-[var(--text-secondary)] hover:border-white/18 hover:bg-white/[0.06] hover:text-white"
                  }`}
                  key={league.key}
                  onClick={() => onToggleLeague(league.key)}
                  type="button"
                >
                  <span className="truncate">{league.name}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-white">Ocultar casas</h3>

            {availableBookmakers.length ? (
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
                {availableBookmakers.map((bookmaker) => {
                  const disabled = bookmaker.key === freebetHouseKey;

                  return (
                    <BookmakerToggleButton
                      active={hiddenBookmakers.has(bookmaker.key)}
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
              <p className={`mt-2 text-lg font-semibold ${getProfitClass(selectedCollectionResult)}`}>
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
                        className={`px-3 py-3.5 text-center font-medium ${getProfitClass(item.lucro_real)}`}
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
          {line.role === "freebet" ? (
            <span className="shrink-0 rounded-full border border-[rgba(255,255,255,0.12)] bg-white/[0.045] px-2 py-0.5 text-[10px] font-semibold text-[var(--text-secondary)]">
              Freebet
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
  conversionContext,
  onToggleCalculator,
  row,
  selectedIds,
  showRelativeDateLabel,
}: {
  conversionContext: CalculatorConversionContext | null;
  onToggleCalculator: (row: SignalRow) => void;
  row: SignalRow;
  selectedIds: ReadonlySet<string>;
  showRelativeDateLabel: boolean;
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
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
              {formatDate(event.starts_at)}
            </span>
            {relativeDateLabel ? (
              <span className="rounded-full border border-[rgba(45,212,191,0.28)] bg-[rgba(45,212,191,0.09)] px-3 py-1 text-[var(--positive)]">
                {relativeDateLabel}
              </span>
            ) : null}
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
          <strong className={`text-lg font-semibold tabular-nums ${getProfitClass(opportunity.conversionPercent)}`}>
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
  const [selectedLeagueKeys, setSelectedLeagueKeys] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [hiddenBookmakers, setHiddenBookmakers] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>("conversion_desc");
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

        if (redirectToLoginOnUnauthorized(oddsResponse)) {
          return;
        }

        if (!oddsResponse.ok) {
          throw new Error("Não foi possível atualizar as odds dos jogos.");
        }

        const oddsPayload = (await oddsResponse.json()) as OddsResponse;
        if (options.signal?.aborted || activeLoadIdRef.current !== loadId) {
          return;
        }

        if (oddsPayload.complete !== false) {
          rememberOddsSnapshots(oddsPayload.snapshots ?? []);
        }

        const hydratedEvents =
          oddsPayload.complete === false
            ? hydrateEventsWithRememberedOdds(events)
            : mergeOddsSnapshots(events, oddsPayload.snapshots ?? []);
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
    () => getAvailableBookmakers(dateFilteredEvents),
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
  const activeSelectedLeagueKeys = useMemo(() => {
    const availableKeys = new Set(availableLeagues.map((league) => league.key));
    return new Set(selectedLeagueKeys.filter((key) => availableKeys.has(key)));
  }, [availableLeagues, selectedLeagueKeys]);
  const rows = useMemo(
    () =>
      getSignalRows(
        state.events,
        selectedConversion,
        activeDateFilter,
        activeHiddenBookmakers,
        minOdd,
        maxOdd,
        activeMode,
        activeSelectedLeagueKeys,
        sortMode,
      ),
    [
      activeHiddenBookmakers,
      activeDateFilter,
      activeSelectedLeagueKeys,
      activeMode,
      maxOdd,
      minOdd,
      selectedConversion,
      sortMode,
      state.events,
    ],
  );
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
  const conversionContext = useMemo(
    () => getConversionContext(selectedConversion, selectedConversionSource),
    [selectedConversion, selectedConversionSource],
  );
  const counts = useMemo(() => {
    return modeFilters.reduce<Record<ModeFilter, number>>(
      (accumulator, mode) => {
        accumulator[mode] = getSignalRows(
          state.events,
          selectedConversion,
          activeDateFilter,
          activeHiddenBookmakers,
          minOdd,
          maxOdd,
          mode,
          activeSelectedLeagueKeys,
          "conversion_desc",
        ).length;
        return accumulator;
      },
      {
        all: 0,
        pa_dois_lados: 0,
        pa_um_lado: 0,
        sem_pa: 0,
      },
    );
  }, [
    activeHiddenBookmakers,
    activeDateFilter,
    maxOdd,
    minOdd,
    selectedConversion,
    activeSelectedLeagueKeys,
    state.events,
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

  function handleSelectConversion(group: ConvertibleFreebetGroup) {
    rememberSelectedConversion(group);
    setSelectedConversionSource("registered");
    setSelectedConversion(group);
    setDetailsGroup(null);
    setCalculatorSelections([]);
    setHiddenBookmakers([]);
    setActiveDateFilter("all");
    setActiveMode("all");
    setSelectedLeagueKeys([]);
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
    setSelectedLeagueKeys([]);
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
    setSelectedLeagueKeys([]);
  }

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
    setSelectedLeagueKeys((current) =>
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
    setSelectedLeagueKeys([]);
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
                              className={`px-2 py-2.5 text-center font-semibold ${getProfitClass(
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
                activeSelectedLeagueKeys.size > 0
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
          selectedLeagueKeys={activeSelectedLeagueKeys}
          onClearLeagues={() => setSelectedLeagueKeys([])}
          onClose={() => setFiltersOpen(false)}
          onDateFilterChange={handleDateFilterChange}
          onModeChange={setActiveMode}
          onReset={handleResetFilters}
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
            ) : rows.length ? (
              rows.map((row) => (
                <SignalCard
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
