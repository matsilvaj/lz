"use client";

import { Calendar, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

const DAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  month: "long",
  year: "numeric",
});

type DatePickerFieldProps = {
  className?: string;
  name?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function parseDateValue(value: string) {
  const [year, month, day] = String(value ?? "").split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(value: string) {
  const parsedDate = parseDateValue(value);

  if (!parsedDate) {
    return "";
  }

  const day = String(parsedDate.getDate()).padStart(2, "0");
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const year = parsedDate.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatMonthLabel(date: Date) {
  const label = MONTH_LABEL_FORMATTER.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function isSameDay(first: Date | null, second: Date | null) {
  if (!first || !second) {
    return false;
  }

  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function buildCalendarDays(viewDate: Date) {
  const monthStart = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const gridStart = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth(),
    1 - monthStart.getDay(),
  );

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index,
    );

    return {
      date,
      inCurrentMonth: date.getMonth() === viewDate.getMonth(),
      value: formatDateValue(date),
    };
  });
}

export function DatePickerField({
  className,
  name,
  onChange,
  placeholder = "dd/mm/aaaa",
  value,
}: DatePickerFieldProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => selectedDate ?? new Date());
  const [popoverPosition, setPopoverPosition] = useState({
    left: 16,
    top: 16,
    width: 304,
  });

  const calendarDays = useMemo(() => buildCalendarDays(viewDate), [viewDate]);
  const displayValue = formatDisplayDate(value);
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const syncPosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();

      if (!rect) {
        return;
      }

      const nextWidth = clamp(Math.max(rect.width, 304), 304, 360);
      const estimatedHeight = 368;
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const top =
        spaceBelow < estimatedHeight && spaceAbove > estimatedHeight
          ? rect.top - estimatedHeight - 12
          : rect.bottom + 12;

      setPopoverPosition({
        left: clamp(rect.left, 16, window.innerWidth - nextWidth - 16),
        top: Math.max(16, top),
        width: nextWidth,
      });
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }

      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    const animationFrame = window.requestAnimationFrame(syncPosition);
    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", syncPosition, true);
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, true);
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function handleOpen() {
    setViewDate(selectedDate ?? today);
    setOpen(true);
  }

  function handleSelect(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
  }

  function handleClear() {
    onChange("");
    setOpen(false);
  }

  function handleToday() {
    handleSelect(formatDateValue(today));
  }

  return (
    <>
      {name ? <input name={name} type="hidden" value={value} /> : null}

      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        className={`lz-input flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-sm ${className ?? ""}`}
        onClick={() => {
          if (open) {
            setOpen(false);
            return;
          }

          handleOpen();
        }}
        ref={triggerRef}
        type="button"
      >
        <span className={displayValue ? "text-white" : "text-[var(--text-dim)]"}>
          {displayValue || placeholder}
        </span>

        <Calendar
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-[var(--text-muted)]"
        />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              className="lz-floating-panel fixed z-[120] rounded-[28px] border border-white/10 bg-[rgba(20,10,16,0.98)] p-4 shadow-[0_28px_90px_rgba(0,0,0,0.46)] backdrop-blur-2xl"
              data-lz-date-picker-popover="true"
              ref={popoverRef}
              style={{
                left: popoverPosition.left,
                top: popoverPosition.top,
                width: popoverPosition.width,
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">
                  {formatMonthLabel(viewDate)}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    aria-label="Mes anterior"
                    className="lz-button-secondary inline-flex h-9 w-9 items-center justify-center rounded-full"
                    onClick={() =>
                      setViewDate(
                        new Date(
                          viewDate.getFullYear(),
                          viewDate.getMonth() - 1,
                          1,
                        ),
                      )
                    }
                    type="button"
                  >
                    <ChevronLeft
                      aria-hidden="true"
                      className="h-4 w-4"
                    />
                  </button>

                  <button
                    aria-label="Proximo mes"
                    className="lz-button-secondary inline-flex h-9 w-9 items-center justify-center rounded-full"
                    onClick={() =>
                      setViewDate(
                        new Date(
                          viewDate.getFullYear(),
                          viewDate.getMonth() + 1,
                          1,
                        ),
                      )
                    }
                    type="button"
                  >
                    <ChevronRight
                      aria-hidden="true"
                      className="h-4 w-4"
                    />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-xs font-medium uppercase tracking-[0.16em] text-[var(--text-dim)]">
                {DAY_LABELS.map((label, index) => (
                  <span className="py-1" key={`${label}-${index}`}>
                    {label}
                  </span>
                ))}
              </div>

              <div className="mt-2 grid grid-cols-7 gap-1.5">
                {calendarDays.map((day) => {
                  const isSelected = isSameDay(day.date, selectedDate);
                  const isToday = isSameDay(day.date, today);

                  return (
                    <button
                      className={`inline-flex h-10 items-center justify-center rounded-2xl text-sm transition ${
                        isSelected
                          ? "bg-[linear-gradient(135deg,rgba(216,31,89,0.96),rgba(122,12,48,0.96))] text-white shadow-[0_12px_24px_rgba(216,31,89,0.28)]"
                          : day.inCurrentMonth
                            ? "text-[var(--text-secondary)] hover:bg-white/6 hover:text-white"
                            : "text-[rgba(245,199,214,0.35)] hover:bg-white/4"
                      } ${isToday && !isSelected ? "border border-[rgba(255,119,163,0.35)]" : "border border-transparent"}`}
                      key={day.value}
                      onClick={() => handleSelect(day.value)}
                      type="button"
                    >
                      {day.date.getDate()}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                <button
                  className="inline-flex items-center gap-1.5 text-sm text-[var(--text-dim)] transition hover:text-white"
                  onClick={handleClear}
                  type="button"
                >
                  <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
                  <span>Limpar</span>
                </button>

                <button
                  className="text-sm text-[var(--accent-gold)] transition hover:text-white"
                  onClick={handleToday}
                  type="button"
                >
                  Hoje
                </button>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
