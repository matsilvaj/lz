"use client";

import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type MultiSelectOption = {
  icon?: ReactNode;
  label: string;
  value: string;
};

// Seletor de vários valores usado nos filtros (parceiros, casas…): abre sobre a
// página, tem busca e rola quando a lista é grande. Sem nada marcado = todos.
export function MultiSelectFilter({
  allLabel = "Todos",
  disabled = false,
  icon,
  id,
  // inline: a lista abre no próprio fluxo (dentro da janela de filtros), em vez
  // de flutuar sobre a página, para não ficar cortada nem se soltar ao rolar.
  inline = false,
  onChange,
  options,
  searchPlaceholder = "Buscar...",
  value,
}: {
  allLabel?: string;
  disabled?: boolean;
  icon?: ReactNode;
  id?: string;
  inline?: boolean;
  onChange: (value: string[]) => void;
  options: MultiSelectOption[];
  searchPlaceholder?: string;
  value: string[];
}) {
  const [position, setPosition] = useState<{
    left: number;
    maxHeight: number;
    top: number;
    width: number;
  } | null>(null);
  const [inlineOpen, setInlineOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const open = inline ? inlineOpen : position !== null;
  const selected = options.filter((option) => value.includes(option.value));
  const label =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? selected[0].label
        : `${selected.length} selecionados`;
  const visibleOptions = useMemo(() => {
    const normalized = search.trim().toLowerCase();

    return normalized
      ? options.filter((option) => option.label.toLowerCase().includes(normalized))
      : options;
  }, [options, search]);

  useEffect(() => {
    if (!open || inline) {
      return;
    }

    function close() {
      setPosition(null);
    }

    function syncPosition() {
      const rect = rootRef.current?.getBoundingClientRect();
      const next = getPanelPosition();

      if (!rect || !next) {
        return;
      }

      // Campo fora da área visível: não faz sentido manter a lista aberta.
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        close();
        return;
      }

      setPosition((current) =>
        current &&
        current.left === next.left &&
        current.top === next.top &&
        current.width === next.width &&
        current.maxHeight === next.maxHeight
          ? current
          : next,
      );
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;

      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        close();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", syncPosition);
    window.addEventListener("scroll", syncPosition, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", syncPosition);
      window.removeEventListener("scroll", syncPosition, true);
    };
  }, [inline, open]);

  // Posição do painel flutuante em relação ao campo.
  function getPanelPosition() {
    const rect = rootRef.current?.getBoundingClientRect();

    if (!rect) {
      return null;
    }

    const margin = 12;
    const width = Math.min(Math.max(rect.width, 256), window.innerWidth - margin * 2);
    const left = Math.min(Math.max(margin, rect.right - width), window.innerWidth - width - margin);
    const top = rect.bottom + 8;
    const maxHeight = Math.max(200, Math.min(340, window.innerHeight - top - margin));

    return { left, maxHeight, top, width };
  }

  // A lista abre sobre a página: painéis com camada própria não a escondem.
  function toggleOpen() {
    if (inline) {
      setSearch("");
      setInlineOpen((current) => !current);
      return;
    }

    if (open) {
      setPosition(null);
      return;
    }

    const next = getPanelPosition();

    if (!next) {
      return;
    }

    setSearch("");
    setPosition(next);
  }

  function toggle(optionValue: string) {
    onChange(
      value.includes(optionValue)
        ? value.filter((item) => item !== optionValue)
        : [...value, optionValue],
    );
  }

  const listBody = (
    <>
      <div className="relative p-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-dim)]"
        />
        <input
          className="lz-input w-full rounded-xl py-2 pl-9 pr-3 text-sm"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={searchPlaceholder}
          type="search"
          value={search}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <button
          aria-selected={selected.length === 0}
          className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
            selected.length === 0
              ? "bg-white/[0.07] text-white"
              : "text-[var(--text-secondary)] hover:bg-white/[0.05] hover:text-white"
          }`}
          onClick={() => onChange([])}
          role="option"
          type="button"
        >
          <span>{allLabel}</span>
          {selected.length === 0 ? <Check aria-hidden="true" className="h-4 w-4" /> : null}
        </button>

        {visibleOptions.length === 0 ? (
          <p className="px-3 py-3 text-sm text-[var(--text-muted)]">Nada encontrado.</p>
        ) : (
          visibleOptions.map((option) => {
            const active = value.includes(option.value);

            return (
              <button
                aria-selected={active}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                  active
                    ? "bg-white/[0.07] text-white"
                    : "text-[var(--text-secondary)] hover:bg-white/[0.05] hover:text-white"
                }`}
                key={option.value}
                onClick={() => toggle(option.value)}
                role="option"
                type="button"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {option.icon}
                  <span className="truncate">{option.label}</span>
                </span>
                <span
                  className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                    active ? "border-[var(--accent)] bg-[var(--accent)]" : "border-white/20"
                  }`}
                >
                  {active ? <Check aria-hidden="true" className="h-3 w-3 text-white" /> : null}
                </span>
              </button>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <div className={`relative w-full ${inline ? "" : "sm:w-auto"}`} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`inline-flex w-full items-center justify-between gap-2 rounded-full border px-4 py-2 text-sm transition disabled:opacity-60 ${
          inline ? "" : "sm:min-w-[190px]"
        } ${
          selected.length
            ? "border-[rgba(167,139,250,0.45)] bg-[rgba(167,139,250,0.12)] text-violet-100"
            : "border-white/10 bg-white/[0.04] text-white hover:border-white/20"
        }`}
        disabled={disabled}
        id={id}
        onClick={toggleOpen}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2">
          {icon}
          <span className="truncate">{label}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-[var(--text-secondary)] transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {inline && inlineOpen ? (
        <div className="mt-2 flex max-h-72 flex-col overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.03] p-1.5">
          {listBody}
        </div>
      ) : null}

      {!inline && position && typeof document !== "undefined" ? createPortal(
        <div
          className="lz-floating-panel fixed z-[190] flex flex-col overflow-hidden rounded-[20px] border border-white/10 bg-[rgba(17,8,14,0.98)] p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.42)] backdrop-blur-2xl"
          ref={panelRef}
          role="listbox"
          style={{
            left: position.left,
            maxHeight: position.maxHeight,
            top: position.top,
            width: position.width,
          }}
        >
          {listBody}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
