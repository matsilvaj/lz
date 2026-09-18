"use client";

import {
  ArrowUpDown,
  Check,
  ChevronDown,
  Flame,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  type ChangeEvent,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { FavoriteStarButton } from "@/app/(app)/_components/favorite-star-button";
import { TrendingBadge } from "@/app/(app)/_components/trending-badge";
import { useMonitorFavorites } from "@/app/(app)/_components/use-monitor-favorites";
import { useTrendingFixtures } from "@/app/(app)/_components/use-trending-fixtures";
import { useScreenFilters } from "@/app/(app)/_components/use-screen-filters";
import { redirectToLoginOnUnauthorized } from "@/lib/auth/client-redirect";
import {
  useMonitorOddsStatusFeed,
  type MonitorOddsStatus as StatusResponse,
} from "@/lib/monitor-odds/use-status-feed";
import { getFavoriteLeagueKey, sortByFavorites, sortByTrending } from "@/lib/monitor-odds/favorites";
import { formatDateParam } from "@/lib/monitor-odds/signal-helpers";

import {
  type BookmakerFilterOption,
  BookmakerToggleButton,
  type OddsEvent,
  formatDate,
  formatFixtureTeams,
  formatLeagueCountry,
  formatLeagueLine,
  formatLeagueName,
  formatTime,
  normalizeLabelKey,
} from "./odds-shared";

// A listagem exibe apenas metadados do jogo (data, hora, times, liga). As odds
// sao carregadas somente na tela de detalhe, por isso nao ha estado de odds aqui.
type SearchState = {
  events: OddsEvent[];
  loading: boolean;
  error: string | null;
};

type EventsResponse = {
  events?: OddsEvent[];
  fixtures_version?: string | null;
  latest_odd_updated_at?: string | null;
  odds_version?: string | null;
};

type DatePreset = "all" | "today" | "tomorrow" | "day2" | "day3" | "day4";

type DateRangePreset = Exclude<DatePreset, "all">;

type EventListSortMode = "league" | "nearest" | "farthest" | "trending";

type EventsRequest =
  | {
      kind: "available";
    }
  | {
      kind: "search";
      search: string;
    }
  | {
      from: string;
      kind: "date";
      preset: DateRangePreset;
      to: string;
    };

type LeagueFilterOption = BookmakerFilterOption;

type LeagueGroup = {
  events: OddsEvent[];
  key: string;
  leagueCountry: string | null;
  leagueCountryFlagUrl: string | null;
  leagueLogoUrl: string | null;
  leagueName: string;
};

const datePresets: DatePreset[] = [
  "all",
  "today",
  "tomorrow",
  "day2",
  "day3",
  "day4",
];

const datePresetOffsets: Record<DateRangePreset, number> = {
  day2: 2,
  day3: 3,
  day4: 4,
  today: 0,
  tomorrow: 1,
};

const datePresetBaseLabels: Record<DatePreset, string> = {
  all: "Todos",
  day2: "",
  day3: "",
  day4: "",
  today: "Hoje",
  tomorrow: "Amanhã",
};

function getPresetDate(preset: DateRangePreset) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + datePresetOffsets[preset]);
  return date;
}

function getAvailableDayKeys(events: Array<{ starts_at: string }>) {
  const keys = new Set<string>();

  for (const event of events) {
    const date = new Date(event.starts_at);

    if (!Number.isNaN(date.getTime())) {
      keys.add(formatDateParam(date));
    }
  }

  return Array.from(keys);
}

function getDatePresetLabel(preset: DatePreset) {
  if (preset === "all") {
    return datePresetBaseLabels.all;
  }

  const date = getPresetDate(preset);
  const dayLabel = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    weekday: "short",
  })
    .format(date)
    .replace(".", "");

  return datePresetBaseLabels[preset] || dayLabel;
}

function getDatePresetHint(preset: DatePreset) {
  if (preset === "all") {
    return "";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(getPresetDate(preset));
}

const eventListSortOptions: Array<{
  label: string;
  value: EventListSortMode;
}> = [
  { label: "Por campeonato", value: "league" },
  { label: "Mais acessados", value: "trending" },
  { label: "Mais próximos", value: "nearest" },
  { label: "Mais distantes", value: "farthest" },
];

const leagueLogoOutlinePositions = [
  "top",
  "top-right",
  "right",
  "bottom-right",
  "bottom",
  "bottom-left",
  "left",
  "top-left",
] as const;

const unversionedFixturesRefreshMs = 60_000;

const emptyOddsEvents: OddsEvent[] = [];

const leagueCountryIsoCodes: Record<string, string> = {
  albania: "AL",
  algeria: "DZ",
  andorra: "AD",
  angola: "AO",
  argentina: "AR",
  armenia: "AM",
  aruba: "AW",
  australia: "AU",
  austria: "AT",
  azerbaijan: "AZ",
  bahrain: "BH",
  belarus: "BY",
  belgium: "BE",
  bolivia: "BO",
  "bosnia-herzegovina": "BA",
  bosnia: "BA",
  brazil: "BR",
  bulgaria: "BG",
  canada: "CA",
  chile: "CL",
  china: "CN",
  colombia: "CO",
  "costa-rica": "CR",
  croatia: "HR",
  cyprus: "CY",
  "czech-republic": "CZ",
  czechia: "CZ",
  denmark: "DK",
  ecuador: "EC",
  egypt: "EG",
  england: "GB",
  estonia: "EE",
  "faroe-islands": "FO",
  finland: "FI",
  france: "FR",
  georgia: "GE",
  germany: "DE",
  gibraltar: "GI",
  greece: "GR",
  hungary: "HU",
  iceland: "IS",
  india: "IN",
  indonesia: "ID",
  iran: "IR",
  ireland: "IE",
  israel: "IL",
  italy: "IT",
  japan: "JP",
  kazakhstan: "KZ",
  kosovo: "XK",
  latvia: "LV",
  lithuania: "LT",
  luxembourg: "LU",
  malaysia: "MY",
  malta: "MT",
  mexico: "MX",
  moldova: "MD",
  montenegro: "ME",
  morocco: "MA",
  netherlands: "NL",
  "new-zealand": "NZ",
  nigeria: "NG",
  "north-macedonia": "MK",
  "northern-ireland": "GB",
  norway: "NO",
  paraguay: "PY",
  peru: "PE",
  poland: "PL",
  portugal: "PT",
  qatar: "QA",
  romania: "RO",
  russia: "RU",
  "san-marino": "SM",
  "saudi-arabia": "SA",
  scotland: "GB",
  serbia: "RS",
  singapore: "SG",
  slovakia: "SK",
  slovenia: "SI",
  "south-africa": "ZA",
  "south-korea": "KR",
  spain: "ES",
  sweden: "SE",
  switzerland: "CH",
  thailand: "TH",
  tunisia: "TN",
  turkey: "TR",
  ukraine: "UA",
  uruguay: "UY",
  usa: "US",
  "united-states": "US",
  venezuela: "VE",
  vietnam: "VN",
  wales: "GB",
};

function getRelativeDateLabel(value: string | null) {
  if (!value) {
    return null;
  }

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

function formatCountryFlag(value: string | null) {
  if (!value) return "";

  const countryCode = leagueCountryIsoCodes[normalizeLabelKey(value)] ?? "";

  if (countryCode.length !== 2) {
    return "";
  }

  return countryCode
    .toUpperCase()
    .split("")
    .map((letter) => String.fromCodePoint(127397 + letter.charCodeAt(0)))
    .join("");
}

function getSafeImageUrl(value: string | null) {
  if (!value) return "";

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function getEventHref(event: OddsEvent, basePath: string) {
  return `${basePath}/${encodeURIComponent(event.fixture_id)}`;
}

function getDatePresetRange(preset: DateRangePreset) {
  const start = getPresetDate(preset);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  // Enviamos o intervalo com hora e fuso: só a data seria lida como meia-noite UTC
  // e deixaria de fora os jogos da noite.
  return {
    from: start.toISOString(),
    to: end.toISOString(),
  };
}

function getEventsRequestParams(request: EventsRequest) {
  const params = new URLSearchParams();

  if (request.kind === "search") {
    params.set("q", request.search);
    return params;
  }

  if (request.kind === "available") {
    return params;
  }

  params.set("from", request.from);
  params.set("to", request.to);
  return params;
}

function isSameEventsRequest(
  left: EventsRequest | null,
  right: EventsRequest | null,
) {
  if (!left || !right || left.kind !== right.kind) {
    return false;
  }

  if (left.kind === "search" && right.kind === "search") {
    return left.search === right.search;
  }

  if (left.kind === "date" && right.kind === "date") {
    return left.preset === right.preset && left.from === right.from && left.to === right.to;
  }

  if (left.kind === "available" && right.kind === "available") {
    return true;
  }

  return false;
}

function getEventLeagueKey(event: OddsEvent) {
  return `${event.league_slug}:${normalizeLabelKey(event.league_country ?? "")}`;
}

function groupEventsByLeague(events: OddsEvent[]) {
  const groups = new Map<string, LeagueGroup>();

  for (const event of events) {
    const key = getEventLeagueKey(event);
    const current =
      groups.get(key) ??
      ({
        events: [],
        key,
        leagueCountry: event.league_country,
        leagueCountryFlagUrl: event.league_country_flag_url,
        leagueLogoUrl: event.league_logo_url,
        leagueName: event.league_name,
      } satisfies LeagueGroup);

    current.events.push(event);
    current.leagueCountryFlagUrl =
      current.leagueCountryFlagUrl ?? event.league_country_flag_url;
    current.leagueLogoUrl = current.leagueLogoUrl ?? event.league_logo_url;
    groups.set(key, current);
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      events: [...group.events].sort((left, right) => {
        const startOrder =
          new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime();

        if (startOrder !== 0) return startOrder;
        return left.fixture_name.localeCompare(right.fixture_name, "pt-BR");
      }),
    }))
    .sort((left, right) => {
      const countryOrder = formatLeagueCountry(left.leagueCountry).localeCompare(
        formatLeagueCountry(right.leagueCountry),
        "pt-BR",
      );

      if (countryOrder !== 0) return countryOrder;
      return left.leagueName.localeCompare(right.leagueName, "pt-BR");
    });
}

function getEventStartTime(event: OddsEvent) {
  const time = new Date(event.starts_at).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function sortEventsForList(events: OddsEvent[], mode: EventListSortMode) {
  if (mode === "trending") {
    return sortEventsForList(events, "nearest");
  }

  if (mode === "league") {
    return events;
  }

  return [...events].sort((left, right) => {
    const startOrder = getEventStartTime(left) - getEventStartTime(right);
    const fixtureOrder = formatFixtureTeams(left).label.localeCompare(
      formatFixtureTeams(right).label,
      "pt-BR",
    );

    if (mode === "nearest") {
      return startOrder || fixtureOrder;
    }

    return -startOrder || fixtureOrder;
  });
}

const EventCard = memo(function EventCard({
  event,
  eventBasePath,
  favorite = false,
  onToggleFavorite,
  showLeague = true,
  showRelativeDateLabel = false,
  trending = false,
}: {
  event: OddsEvent;
  eventBasePath: string;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  trending?: boolean;
  showLeague?: boolean;
  showRelativeDateLabel?: boolean;
}) {
  const teams = formatFixtureTeams(event);
  const relativeDateLabel = showRelativeDateLabel
    ? getRelativeDateLabel(event.starts_at)
    : null;

  return (
    <article
      className="group relative flex min-h-[124px] w-full flex-col rounded-[22px] border border-white/10 bg-white/[0.025] p-4 text-left transition hover:border-[rgba(255,139,187,0.28)] hover:bg-white/[0.04] hover:shadow-[0_14px_34px_rgba(0,0,0,0.2)]"
    >
      <Link
        aria-label={`Abrir odds de ${teams.label}`}
        className="absolute inset-0 z-0 rounded-[22px] border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
        href={getEventHref(event, eventBasePath)}
      />

      {onToggleFavorite ? (
        <div className="absolute right-3 top-3 z-20">
          <FavoriteStarButton
            active={favorite}
            label={teams.label}
            onToggle={onToggleFavorite}
            size="sm"
          />
        </div>
      ) : null}

      <div className="pointer-events-none relative z-10 flex h-full flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 pr-9 text-xs font-medium text-[var(--text-secondary)]">
          <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1">
            {formatDate(event.starts_at)}
          </span>
          {relativeDateLabel ? (
            <span className="inline-flex rounded-full border border-[rgba(45,212,191,0.28)] bg-[rgba(45,212,191,0.09)] px-3 py-1 text-[var(--positive)]">
              {relativeDateLabel}
            </span>
          ) : null}
          <span className="inline-flex rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-[var(--text-muted)]">
            {formatTime(event.starts_at)}
          </span>
          {trending ? <TrendingBadge /> : null}
        </div>

        <div className="min-w-0">
          <h2 className="line-clamp-2 text-base font-semibold tracking-tight text-white md:text-lg">
            {teams.label}
          </h2>

          {showLeague ? (
            <p className="mt-2 truncate text-xs font-medium text-[var(--text-muted)]">
              {formatLeagueLine(event)}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
});

function DatePresetButton({
  active,
  hint,
  label,
  onClick,
}: {
  active: boolean;
  hint?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`inline-flex h-13 items-center justify-center rounded-full border px-5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)] ${
        active
          ? "border-[rgba(255,139,187,0.42)] bg-[rgba(255,139,187,0.16)] text-white shadow-[0_0_22px_rgba(255,139,187,0.08)]"
          : "border-white/10 bg-white/[0.035] text-[var(--text-secondary)] hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className="flex flex-col items-center leading-tight">
        <span>{label}</span>
        {hint ? (
          <span className="text-[10px] font-medium text-[var(--text-dim)]">{hint}</span>
        ) : null}
      </span>
    </button>
  );
}

function EventListSortMenu({
  onChange,
  value,
}: {
  onChange: (value: EventListSortMode) => void;
  value: EventListSortMode;
}) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedLabel =
    eventListSortOptions.find((option) => option.value === value)?.label ??
    eventListSortOptions[0]?.label ??
    "Organizar";

  const updateMenuPosition = useCallback(() => {
    const button = buttonRef.current;

    if (!button) return;

    const rect = button.getBoundingClientRect();
    const gap = 8;
    const menuHeight = 132;
    const viewportPadding = 16;
    const width = Math.max(rect.width, 220);
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
            {eventListSortOptions.map((option) => (
              <button
                aria-selected={value === option.value}
                className={`flex h-10 w-full items-center rounded-xl px-3 text-left text-sm font-semibold transition ${
                  value === option.value
                    ? "bg-[rgba(211,27,91,0.22)] text-white"
                    : "text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-white"
                }`}
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                role="option"
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative w-full sm:w-[220px]">
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`inline-flex h-13 w-full items-center justify-between gap-3 rounded-full border px-4 text-sm font-semibold transition ${
          open
            ? "border-[rgba(255,139,187,0.52)] bg-[rgba(255,139,187,0.12)] text-white shadow-[0_12px_30px_rgba(211,27,91,0.12)]"
            : "border-white/10 bg-white/[0.035] text-white hover:border-white/20 hover:bg-white/[0.06]"
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
          <span className="truncate">{selectedLabel}</span>
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

function GlobalLeagueIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3.5 12h17M12 3.5c2.2 2.3 3.3 5.1 3.3 8.5s-1.1 6.2-3.3 8.5M12 3.5C9.8 5.8 8.7 8.6 8.7 12s1.1 6.2 3.3 8.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
      <circle
        cx="12"
        cy="12"
        r="8.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function LeagueIcon({
  country,
  flagUrl,
  leagueName,
  logoUrl,
}: {
  country: string;
  flagUrl: string | null;
  leagueName: string;
  logoUrl: string | null;
}) {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(() => new Set());
  const safeLogoUrl = getSafeImageUrl(logoUrl);
  const safeFlagUrl = getSafeImageUrl(flagUrl);
  const countryFlag = formatCountryFlag(country);
  const imageUrl = safeLogoUrl && !failedUrls.has(safeLogoUrl)
    ? safeLogoUrl
    : safeFlagUrl && !failedUrls.has(safeFlagUrl)
      ? safeFlagUrl
      : "";
  const isLogoImage = Boolean(imageUrl && imageUrl === safeLogoUrl);
  const imageAlt = imageUrl === safeLogoUrl ? `Logo ${leagueName}` : `Bandeira ${country}`;

  return (
    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-base text-[var(--text-secondary)]">
      {imageUrl && isLogoImage ? (
        <span className="lz-league-logo-outline relative inline-flex h-7 w-7 items-center justify-center">
          {leagueLogoOutlinePositions.map((position) => (
            <Image
              alt=""
              aria-hidden="true"
              className="lz-league-logo-outline-copy pointer-events-none absolute inset-0 h-full w-full object-contain"
              data-outline-position={position}
              height={28}
              key={position}
              loading="lazy"
              onError={() => {
                setFailedUrls((current) => new Set(current).add(imageUrl));
              }}
              referrerPolicy="no-referrer"
              src={imageUrl}
              unoptimized
              width={28}
            />
          ))}
          <Image
            alt={imageAlt}
            className="relative z-10 h-full w-full object-contain"
            height={28}
            loading="lazy"
            onError={() => {
              setFailedUrls((current) => new Set(current).add(imageUrl));
            }}
            referrerPolicy="no-referrer"
            src={imageUrl}
            unoptimized
            width={28}
          />
        </span>
      ) : imageUrl ? (
        <Image
          alt={imageAlt}
          className="h-6 w-6 object-contain"
          height={24}
          loading="lazy"
          onError={() => {
            setFailedUrls((current) => new Set(current).add(imageUrl));
          }}
          referrerPolicy="no-referrer"
          src={imageUrl}
          unoptimized
          width={24}
        />
      ) : countryFlag ? (
        <span aria-label={`Bandeira ${country}`} role="img">
          {countryFlag}
        </span>
      ) : (
        <GlobalLeagueIcon />
      )}
    </span>
  );
}

const LeagueEventsSection = memo(function LeagueEventsSection({
  group,
  eventBasePath,
  favoriteGames,
  leagueFavorite,
  onToggleGame,
  onToggleLeague,
  showRelativeDateLabel,
  trendingRank,
}: {
  group: LeagueGroup;
  eventBasePath: string;
  favoriteGames: ReadonlySet<string>;
  leagueFavorite: boolean;
  onToggleGame: (fixtureId: string) => void;
  onToggleLeague: () => void;
  showRelativeDateLabel: boolean;
  trendingRank: ReadonlyMap<string, number>;
}) {
  const country = formatLeagueCountry(group.leagueCountry);
  const leagueName = formatLeagueName(group.leagueName, group.leagueCountry);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <LeagueIcon
            country={country || group.leagueCountry || "Internacional"}
            flagUrl={group.leagueCountryFlagUrl}
            leagueName={leagueName}
            logoUrl={group.leagueLogoUrl}
          />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-white">
              {leagueName}
            </h2>
            {country ? (
              <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                {country}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
            {group.events.length} {group.events.length === 1 ? "jogo" : "jogos"}
          </span>
          <FavoriteStarButton
            active={leagueFavorite}
            label={leagueName}
            onToggle={onToggleLeague}
            size="sm"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {group.events.map((event) => (
          <EventCard
            event={event}
            eventBasePath={eventBasePath}
            favorite={favoriteGames.has(event.fixture_id)}
            key={event.fixture_id}
            onToggleFavorite={() => onToggleGame(event.fixture_id)}
            showLeague={false}
            showRelativeDateLabel={showRelativeDateLabel}
            trending={trendingRank.has(event.fixture_id)}
          />
        ))}
      </div>
    </section>
  );
});

function EventCardSkeleton() {
  return (
    <div className="min-h-[124px] w-full rounded-[22px] border border-white/10 bg-white/[0.025] p-4">
      <div className="flex h-full animate-pulse flex-col gap-3">
        <div className="flex gap-2">
          <span className="h-6 w-20 rounded-full bg-white/8" />
          <span className="h-6 w-14 rounded-full bg-white/8" />
        </div>

        <div>
          <span className="block h-5 w-4/5 rounded-full bg-white/10" />
          <span className="mt-2 block h-4 w-3/5 rounded-full bg-white/8" />
        </div>
      </div>
    </div>
  );
}

function SearchResultsSkeleton() {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <EventCardSkeleton key={`search-skeleton-${index}`} />
      ))}
    </section>
  );
}

function LeagueEventsSkeleton() {
  return (
    <section className="space-y-6">
      {Array.from({ length: 3 }).map((_, groupIndex) => (
        <div className="space-y-3" key={`league-skeleton-${groupIndex}`}>
          <div className="flex animate-pulse items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-3">
              <span className="h-10 w-12 rounded-2xl bg-white/8" />
              <div>
                <span className="block h-4 w-40 rounded-full bg-white/10" />
                <span className="mt-2 block h-3 w-24 rounded-full bg-white/8" />
              </div>
            </div>
            <span className="h-6 w-16 rounded-full bg-white/8" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <EventCardSkeleton />
            <EventCardSkeleton />
            <EventCardSkeleton />
          </div>
        </div>
      ))}
    </section>
  );
}

function LeagueFiltersDialog({
  availableLeagues,
  hasPreset,
  hiddenLeagues,
  onClearPreset,
  onClose,
  onHideAll,
  onlyFavorites,
  onSavePreset,
  onShowAll,
  onToggleLeague,
  onToggleOnlyFavorites,
  savingPreset,
}: {
  availableLeagues: LeagueFilterOption[];
  hasPreset: boolean;
  hiddenLeagues: ReadonlySet<string>;
  onClearPreset: () => void;
  onClose: () => void;
  onHideAll: () => void;
  onlyFavorites: boolean;
  onSavePreset: () => void;
  onShowAll: () => void;
  onToggleLeague: (key: string) => void;
  onToggleOnlyFavorites: () => void;
  savingPreset: boolean;
}) {
  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center overflow-hidden bg-black/65 p-3 backdrop-blur-md sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        aria-modal="true"
        className="lz-floating-panel flex max-h-[min(760px,calc(100dvh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[rgba(18,5,13,0.96)] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.48)] sm:rounded-[28px] sm:p-5"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-dim)]">
              Filtros
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white sm:text-xl">
              Monitor de odds
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

          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">Campeonatos visíveis</h3>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <button
                className="text-[var(--text-secondary)] transition hover:text-white"
                onClick={onShowAll}
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

          {availableLeagues.length ? (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {availableLeagues.map((league) => (
                <BookmakerToggleButton
                  active={!hiddenLeagues.has(league.key)}
                  key={league.key}
                  name={league.name}
                  onClick={() => onToggleLeague(league.key)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-sm text-[var(--text-muted)]">
              Nenhum campeonato encontrado.
            </div>
          )}
        </div>

        <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-3">
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

export function OddsEventSearch({
  eventBasePath = "/monitor/odds",
}: {
  eventBasePath?: string;
}) {
  const [query, setQuery] = useState("");
  const [activeDatePreset, setActiveDatePreset] = useState<DatePreset | null>("all");
  const [activeListSort, setActiveListSort] =
    useState<EventListSortMode>("league");
  const [state, setState] = useState<SearchState>({
    events: [],
    loading: true,
    error: null,
  });
  const [hiddenLeagueKeys, setHiddenLeagueKeys] = useState<string[]>([]);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [leagueFiltersOpen, setLeagueFiltersOpen] = useState(false);
  const { favoriteGames, favoriteLeagues, toggleGame, toggleLeague } =
    useMonitorFavorites();
  const { trendingRank } = useTrendingFixtures();
  const [availableDayKeys, setAvailableDayKeys] = useState<string[]>([]);
  const screenFilterState = useMemo(
    () => ({ activeDatePreset, activeListSort, hiddenLeagueKeys, onlyFavorites }),
    [activeDatePreset, activeListSort, hiddenLeagueKeys, onlyFavorites],
  );
  const applyScreenFilters = useCallback(
    (filters: Partial<{
      activeDatePreset: DatePreset | null;
      activeListSort: EventListSortMode;
      hiddenLeagueKeys: string[];
      onlyFavorites: boolean;
    }>) => {
      if (typeof filters.onlyFavorites === "boolean") {
        setOnlyFavorites(filters.onlyFavorites);
      }

      if (filters.activeDatePreset !== undefined) {
        setActiveDatePreset(filters.activeDatePreset);
      }

      if (filters.activeListSort) {
        setActiveListSort(filters.activeListSort);
      }

      if (Array.isArray(filters.hiddenLeagueKeys)) {
        setHiddenLeagueKeys(filters.hiddenLeagueKeys);
      }
    },
    [],
  );
  const { clearPreset, hasPreset, savePreset, savingPreset } = useScreenFilters({
    apply: applyScreenFilters,
    screen: "monitor-odds",
    state: screenFilterState,
  });
  const latestFixturesVersionRef = useRef<string | null>(null);
  const lastUnversionedFixturesRefreshAtRef = useRef(0);
  const activeRequestRef = useRef<EventsRequest | null>(null);

  const loadEvents = useCallback(
    async (
      request: EventsRequest,
      options: { signal?: AbortSignal; showLoading?: boolean } = {},
    ) => {
      activeRequestRef.current = request;

      if (options.showLoading !== false) {
        setState({
          events: [],
          loading: true,
          error: null,
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

        if (response.status === 429) {
          throw new Error("Muitas buscas em pouco tempo. Aguarde alguns segundos.");
        }

        if (!response.ok) {
          throw new Error("Não foi possível buscar os eventos.");
        }

        const payload = (await response.json()) as EventsResponse;

        if (
          options.signal?.aborted ||
          !isSameEventsRequest(activeRequestRef.current, request)
        ) {
          return;
        }

        const nextFixturesVersion = payload.fixtures_version ?? null;
        const events = payload.events ?? [];

        latestFixturesVersionRef.current = nextFixturesVersion;
        lastUnversionedFixturesRefreshAtRef.current = Date.now();

        if (request.kind === "available") {
          setAvailableDayKeys(getAvailableDayKeys(events));
        }

        setState({
          events,
          loading: false,
          error: null,
        });
      } catch (error) {
        if (
          options.signal?.aborted ||
          !isSameEventsRequest(activeRequestRef.current, request)
        ) {
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

  const loadDatePreset = useCallback(
    (
      preset: DatePreset,
      options: { signal?: AbortSignal; showLoading?: boolean } = {},
    ) => {
      if (preset === "all") {
        return loadEvents({ kind: "available" }, options);
      }

      const range = getDatePresetRange(preset);
      const request: EventsRequest = {
        from: range.from,
        kind: "date",
        preset,
        to: range.to,
      };

      return loadEvents(request, options);
    },
    [loadEvents],
  );

  const handleDatePresetClick = useCallback(
    (preset: DatePreset) => {
      setQuery("");
      setActiveDatePreset(preset);
      void loadDatePreset(preset);
    },
    [loadDatePreset],
  );
  const handleListSortChange = useCallback((value: EventListSortMode) => {
    setActiveListSort(value);
  }, []);

  function handleQueryChange(event: ChangeEvent<HTMLInputElement>) {
    const nextQuery = event.target.value.slice(0, 80);
    const trimmedQuery = nextQuery.trim();

    setQuery(nextQuery);

    if (trimmedQuery.length === 0) {
      setActiveDatePreset("all");
      void loadDatePreset("all");
      return;
    }

    if (activeDatePreset) {
      setActiveDatePreset(null);
    }

    if (trimmedQuery.length < 2) {
      activeRequestRef.current = null;
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadDatePreset("all", {
        showLoading: false,
        signal: controller.signal,
      });
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [loadDatePreset]);

  useEffect(() => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      if (!activeDatePreset) {
        activeRequestRef.current = null;
      }

      return;
    }

    const request: EventsRequest = {
      kind: "search",
      search: trimmedQuery,
    };
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadEvents(request, { signal: controller.signal });
    }, 260);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [activeDatePreset, loadEvents, query]);

  const handleStatusUpdate = useCallback(
    async (payload: StatusResponse) => {
      const activeRequest = activeRequestRef.current;

      if (!activeRequest) {
        return;
      }

      const nextFixturesVersion = payload.fixtures_version ?? null;
      const previousFixturesVersion = latestFixturesVersionRef.current;
      const shouldRefreshUnversionedFixtures =
        !nextFixturesVersion &&
        !previousFixturesVersion &&
        Date.now() - lastUnversionedFixturesRefreshAtRef.current >
          unversionedFixturesRefreshMs;

      if (
        nextFixturesVersion &&
        previousFixturesVersion &&
        nextFixturesVersion !== previousFixturesVersion
      ) {
        await loadEvents(activeRequest, { showLoading: false });
        return;
      }

      if (!previousFixturesVersion && nextFixturesVersion) {
        await loadEvents(activeRequest, { showLoading: false });
        return;
      }

      if (shouldRefreshUnversionedFixtures) {
        await loadEvents(activeRequest, { showLoading: false });
        return;
      }

      // Mudancas de odds nao afetam a listagem: os cards mostram apenas
      // metadados do jogo. Recarregar aqui custaria o feed inteiro de odds a
      // cada poll sem alterar um pixel na tela.
    },
    [loadEvents],
  );

  const canPollStatus = useCallback(() => Boolean(activeRequestRef.current), []);

  useMonitorOddsStatusFeed(canPollStatus, handleStatusUpdate);

  const hasQuery = query.trim().length >= 2;
  const hasActiveDatePreset = activeDatePreset !== null;
  const hasDatePreset = activeDatePreset !== null && activeDatePreset !== "all";
  const hasAllPreset = activeDatePreset === "all";
  const hasActiveList = hasQuery || hasActiveDatePreset;
  const visibleDatePresets = useMemo(() => {
    const dayKeys = new Set(availableDayKeys);

    return datePresets.filter((preset) => {
      if (preset === "all" || preset === activeDatePreset) {
        return true;
      }

      if (!dayKeys.size) {
        return preset === "today" || preset === "tomorrow";
      }

      return dayKeys.has(formatDateParam(getPresetDate(preset)));
    });
  }, [activeDatePreset, availableDayKeys]);
  const loadedEvents = hasActiveList ? state.events : emptyOddsEvents;
  const availableLeagues = useMemo<LeagueFilterOption[]>(
    () =>
      groupEventsByLeague(loadedEvents)
        .map((group) => ({
          key: group.key,
          name: formatLeagueName(group.leagueName, group.leagueCountry),
        }))
        .sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
    [loadedEvents],
  );
  const activeHiddenLeagues = useMemo(() => {
    const availableKeys = new Set(availableLeagues.map((league) => league.key));
    return new Set(hiddenLeagueKeys.filter((key) => availableKeys.has(key)));
  }, [availableLeagues, hiddenLeagueKeys]);
  const filteredEvents = useMemo(
    () =>
      loadedEvents.filter((event) => {
        if (activeHiddenLeagues.has(getEventLeagueKey(event))) {
          return false;
        }

        return (
          !onlyFavorites ||
          favoriteGames.has(event.fixture_id) ||
          favoriteLeagues.has(getFavoriteLeagueKey(event))
        );
      }),
    [activeHiddenLeagues, favoriteGames, favoriteLeagues, loadedEvents, onlyFavorites],
  );
  const favoriteEvents = useMemo(
    () => filteredEvents.filter((event) => favoriteGames.has(event.fixture_id)),
    [favoriteGames, filteredEvents],
  );
  const events = useMemo(
    () => filteredEvents.filter((event) => !favoriteGames.has(event.fixture_id)),
    [favoriteGames, filteredEvents],
  );
  const sortedEvents = useMemo(() => {
    const sorted = sortByFavorites(
      sortEventsForList(events, activeListSort),
      (event) => event,
      favoriteGames,
      favoriteLeagues,
    );

    return activeListSort === "trending"
      ? sortByTrending(sorted, (event) => event.fixture_id, trendingRank)
      : sorted;
  }, [activeListSort, events, favoriteGames, favoriteLeagues, trendingRank]);
  // Top 10 do ranking que estão na lista atual (respeita data, campeonatos e "Só favoritos").
  const trendingEvents = useMemo(
    () =>
      sortByTrending(
        filteredEvents.filter((event) => trendingRank.has(event.fixture_id)),
        (event) => event.fixture_id,
        trendingRank,
      ),
    [filteredEvents, trendingRank],
  );
  const leagueGroups = useMemo(
    () => (activeListSort === "league" ? groupEventsByLeague(events) : []),
    [activeListSort, events],
  );
  // Campeonatos fixados primeiro.
  const pinnedLeagueGroups = useMemo(
    () =>
      sortByFavorites(
        leagueGroups,
        (group) => ({
          fixture_id: "",
          league_country: group.leagueCountry,
          league_name: group.leagueName,
        }),
        favoriteGames,
        favoriteLeagues,
      ),
    [favoriteGames, favoriteLeagues, leagueGroups],
  );
  const sortedFavoriteEvents = sortEventsForList(favoriteEvents, "nearest");
  const showEmpty =
    hasActiveList &&
    !state.loading &&
    !state.error &&
    events.length === 0 &&
    favoriteEvents.length === 0;
  const activeDateLabel = activeDatePreset
    ? getDatePresetLabel(activeDatePreset).toLocaleLowerCase("pt-BR")
    : "";
  const emptyMessage = hasDatePreset
    ? `Nenhum jogo encontrado para ${activeDateLabel}.`
    : "Nenhum evento encontrado.";
  const showRelativeDateLabel = hasAllPreset || hasQuery;

  return (
    <div className="space-y-5">
      <section className="lz-panel rounded-[28px] p-5 md:p-6">
        <div className="relative z-10 flex flex-col gap-4">
          <label
            className="text-sm font-semibold text-white"
            htmlFor="odds-event-search"
          >
            Buscar eventos
          </label>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <input
              autoComplete="off"
              className="lz-input h-13 w-full min-w-0 rounded-full px-5 text-base xl:flex-1"
              id="odds-event-search"
              maxLength={80}
              onChange={handleQueryChange}
              placeholder="Digite um time, evento ou liga"
              type="search"
              value={query}
            />

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {visibleDatePresets.map((preset) => (
                <DatePresetButton
                  active={activeDatePreset === preset}
                  key={preset}
                  hint={getDatePresetHint(preset)}
                  label={getDatePresetLabel(preset)}
                  onClick={() => handleDatePresetClick(preset)}
                />
              ))}

              <EventListSortMenu
                onChange={handleListSortChange}
                value={activeListSort}
              />

              <button
                className={`inline-flex h-13 items-center justify-center gap-2 rounded-full border px-5 text-sm font-semibold transition ${
                  activeHiddenLeagues.size || onlyFavorites
                    ? "border-[rgba(211,27,91,0.72)] bg-[rgba(211,27,91,0.18)] text-white"
                    : "border-white/10 bg-white/[0.035] text-[var(--text-secondary)] hover:border-white/20 hover:bg-white/[0.06] hover:text-white"
                }`}
                onClick={() => setLeagueFiltersOpen(true)}
                type="button"
              >
                <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
                <span>Filtros</span>
                {activeHiddenLeagues.size ? (
                  <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-white/10 px-2 py-0.5 text-xs">
                    {availableLeagues.length - activeHiddenLeagues.size}
                  </span>
                ) : null}
              </button>
            </div>
          </div>

        </div>
      </section>

      {leagueFiltersOpen ? (
        <LeagueFiltersDialog
          availableLeagues={availableLeagues}
          hasPreset={hasPreset}
          hiddenLeagues={activeHiddenLeagues}
          onClearPreset={() => void clearPreset()}
          onClose={() => setLeagueFiltersOpen(false)}
          onHideAll={() =>
            setHiddenLeagueKeys(availableLeagues.map((league) => league.key))
          }
          onlyFavorites={onlyFavorites}
          onToggleOnlyFavorites={() => setOnlyFavorites((current) => !current)}
          onSavePreset={() => void savePreset()}
          onShowAll={() => setHiddenLeagueKeys([])}
          onToggleLeague={(key) =>
            setHiddenLeagueKeys((current) =>
              current.includes(key)
                ? current.filter((leagueKey) => leagueKey !== key)
                : [...current, key],
            )
          }
          savingPreset={savingPreset}
        />
      ) : null}

      {hasActiveList && state.loading ? (
        hasDatePreset ? <LeagueEventsSkeleton /> : <SearchResultsSkeleton />
      ) : null}

      {hasActiveList && state.error ? (
        <div className="rounded-[24px] border border-[rgba(255,107,133,0.2)] bg-[rgba(255,107,133,0.08)] p-5 text-sm text-[var(--negative)]">
          {state.error}
        </div>
      ) : null}

      {showEmpty ? (
        <div className="rounded-[24px] border border-white/10 bg-white/[0.025] p-5 text-sm text-[var(--text-muted)]">
          {emptyMessage}
        </div>
      ) : null}

      {sortedFavoriteEvents.length && hasActiveList && !state.loading ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <Star aria-hidden="true" className="h-4 w-4 text-amber-300" fill="currentColor" />
            <h2 className="text-sm font-semibold text-white">Jogos favoritos</h2>
            <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
              {sortedFavoriteEvents.length}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sortedFavoriteEvents.map((event) => (
              <EventCard
                event={event}
                eventBasePath={eventBasePath}
                favorite
                key={event.fixture_id}
                onToggleFavorite={() => toggleGame(event.fixture_id)}
                showRelativeDateLabel={showRelativeDateLabel}
                trending={trendingRank.has(event.fixture_id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {trendingEvents.length && hasActiveList && !state.loading ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2 border-b border-white/10 pb-3">
            <Flame aria-hidden="true" className="h-4 w-4 text-orange-300" />
            <h2 className="text-sm font-semibold text-white">Mais acessados</h2>
            <span className="text-xs font-medium text-[var(--text-muted)]">últimas 24h</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {trendingEvents.map((event) => (
              <EventCard
                event={event}
                eventBasePath={eventBasePath}
                favorite={favoriteGames.has(event.fixture_id)}
                key={event.fixture_id}
                onToggleFavorite={() => toggleGame(event.fixture_id)}
                showRelativeDateLabel={showRelativeDateLabel}
                trending
              />
            ))}
          </div>
        </section>
      ) : null}

      {events.length && activeListSort === "league" && !state.loading ? (
        <section className="space-y-4">
          {pinnedLeagueGroups.map((group) => {
            const leagueKey = getFavoriteLeagueKey({
              league_country: group.leagueCountry,
              league_name: group.leagueName,
            });

            return (
              <LeagueEventsSection
                eventBasePath={eventBasePath}
                favoriteGames={favoriteGames}
                group={group}
                key={group.key}
                leagueFavorite={favoriteLeagues.has(leagueKey)}
                onToggleGame={toggleGame}
                onToggleLeague={() => toggleLeague(leagueKey)}
                showRelativeDateLabel={showRelativeDateLabel}
                trendingRank={trendingRank}
              />
            );
          })}
        </section>
      ) : null}

      {events.length && activeListSort !== "league" && !state.loading ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sortedEvents.map((event) => (
            <EventCard
              event={event}
              eventBasePath={eventBasePath}
              favorite={favoriteGames.has(event.fixture_id)}
              key={event.fixture_id}
              onToggleFavorite={() => toggleGame(event.fixture_id)}
              showRelativeDateLabel={showRelativeDateLabel}
              trending={trendingRank.has(event.fixture_id)}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}
