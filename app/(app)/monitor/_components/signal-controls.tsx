"use client";

// Controles compartilhados pelas telas de sinais do monitor (Duplo, Semanal e Converter).

import { ArrowUpDown, ChevronDown } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function BookmakerEventLink({
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

export function ModeButton({
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

export function DateFilterButton({
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

export function BookmakerToggleButton({
  active,
  disabled,
  disabledLabel = "Freebet",
  name,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  disabledLabel?: string;
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
            {disabledLabel}
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function SortMenu<T extends string>({
  labels,
  onChange,
  options,
  value,
}: {
  labels: Record<T, string>;
  onChange: (value: T) => void;
  options: readonly T[];
  value: T;
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
            {options.map((option) => (
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
                {labels[option]}
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
          <span className="truncate">{labels[value]}</span>
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

