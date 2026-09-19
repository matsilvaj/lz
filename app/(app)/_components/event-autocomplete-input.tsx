"use client";

import { useEffect, useId, useRef, useState } from "react";

import { formatNationalTeamName } from "@/lib/monitor-odds/display-names";

type EventSuggestion = {
  id: string;
  label: string;
  league: string;
  startsAt: string;
};

type MonitorEvent = {
  fixture_id?: unknown;
  home_team?: unknown;
  away_team?: unknown;
  league_name?: unknown;
  starts_at?: unknown;
};

type EventAutocompleteInputProps = {
  className?: string;
  maxLength?: number;
  name?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
};

const MAX_SUGGESTIONS = 8;

function toText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function formatStartsAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toSuggestions(events: unknown): EventSuggestion[] {
  if (!Array.isArray(events)) {
    return [];
  }

  const now = Date.now();

  return (events as MonitorEvent[])
    .filter((event) => {
      const startsAt = new Date(toText(event.starts_at)).getTime();
      return !Number.isFinite(startsAt) || startsAt > now;
    })
    .map((event) => {
      const home = formatNationalTeamName(toText(event.home_team));
      const away = formatNationalTeamName(toText(event.away_team));

      return {
        id: String(event.fixture_id ?? `${home}-${away}`),
        label: home && away ? `${home} x ${away}` : home || away,
        league: toText(event.league_name),
        startsAt: formatStartsAt(toText(event.starts_at)),
      };
    })
    .filter((event) => event.label)
    .slice(0, MAX_SUGGESTIONS);
}

export function EventAutocompleteInput({
  className = "lz-input w-full rounded-2xl px-3 py-3",
  maxLength = 120,
  name,
  onChange,
  placeholder = "Ex.: Barcelona x Real Madrid",
  value,
}: EventAutocompleteInputProps) {
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const skipNextSearchRef = useRef(true);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<EventSuggestion[]>([]);

  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }

    const term = value.trim();

    if (term.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);

      try {
        const response = await fetch(
          `/api/monitor-odds/events?q=${encodeURIComponent(term.slice(0, 80))}`,
          { cache: "no-store", signal: controller.signal },
        );

        if (!response.ok) {
          setSuggestions([]);
          return;
        }

        const data = (await response.json()) as { events?: unknown };
        setSuggestions(toSuggestions(data.events));
        setActiveIndex(-1);
        setOpen(true);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [value]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function selectSuggestion(suggestion: EventSuggestion) {
    skipNextSearchRef.current = true;
    onChange(suggestion.label.slice(0, maxLength));
    setOpen(false);
    setSuggestions([]);
  }

  const showList = open && value.trim().length >= 2 && (loading || suggestions.length > 0);

  return (
    <div className="relative" ref={containerRef}>
      <input
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={showList}
        autoComplete="off"
        className={className}
        maxLength={maxLength}
        name={name}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (!showList || suggestions.length === 0) {
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => (current + 1) % suggestions.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) =>
              current <= 0 ? suggestions.length - 1 : current - 1,
            );
          } else if (event.key === "Enter" && activeIndex >= 0) {
            event.preventDefault();
            const suggestion = suggestions[activeIndex];
            if (suggestion) {
              selectSuggestion(suggestion);
            }
          } else if (event.key === "Escape") {
            event.stopPropagation();
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        role="combobox"
        type="text"
        value={value}
      />

      {showList ? (
        <div
          className="lz-floating-panel absolute left-0 right-0 top-full z-[80] mt-2 overflow-hidden rounded-2xl border border-white/10 bg-[rgba(17,8,14,0.98)] p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
          id={listId}
          role="listbox"
        >
          {loading && suggestions.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-[var(--text-dim)]">Buscando eventos...</p>
          ) : (
            suggestions.map((suggestion, index) => (
              <button
                aria-selected={index === activeIndex}
                className={`block w-full rounded-xl px-3 py-2 text-left transition ${
                  index === activeIndex ? "bg-white/8" : "hover:bg-white/6"
                }`}
                key={suggestion.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectSuggestion(suggestion)}
                role="option"
                type="button"
              >
                <span className="block truncate text-sm font-medium text-white">
                  {suggestion.label}
                </span>
                {suggestion.league || suggestion.startsAt ? (
                  <span className="mt-0.5 block truncate text-xs text-[var(--text-dim)]">
                    {[suggestion.league, suggestion.startsAt].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
