"use client";

import { Check, ChevronDown, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { PartnerOption } from "./partner-picker";

// Filtro "Parceiro" (dashboard e histórico): "me" e/ou ids de parceiros; vazio = todos.
export function PartnerFilterSelect({
  disabled = false,
  id,
  onChange,
  partners,
  value,
}: {
  disabled?: boolean;
  id?: string;
  onChange: (value: string[]) => void;
  partners: PartnerOption[];
  value: string[];
}) {
  const [position, setPosition] = useState<{
    left: number;
    maxHeight: number;
    top: number;
    width: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const open = position !== null;
  const options = [
    { label: "Eu", value: "me" },
    ...partners.map((partner) => ({ label: partner.name, value: String(partner.id) })),
  ];
  const selected = options.filter((option) => value.includes(option.value));
  const label =
    selected.length === 0
      ? "Todos"
      : selected.length === 1
        ? selected[0].label
        : `${selected.length} selecionados`;

  useEffect(() => {
    if (!open) {
      return;
    }

    function close() {
      setPosition(null);
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
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);

  // A lista abre sobre a página: painéis com camada própria não a escondem.
  function toggleOpen() {
    if (open) {
      setPosition(null);
      return;
    }

    const rect = rootRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const margin = 12;
    const width = Math.min(Math.max(rect.width, 256), window.innerWidth - margin * 2);
    const left = Math.min(Math.max(margin, rect.right - width), window.innerWidth - width - margin);

    const top = rect.bottom + 8;
    // Cerca de 7 itens e depois rolagem; nunca passa do fim da tela.
    const maxHeight = Math.max(160, Math.min(320, window.innerHeight - top - margin));

    setPosition({ left, maxHeight, top, width });
  }

  function toggle(optionValue: string) {
    onChange(
      value.includes(optionValue)
        ? value.filter((item) => item !== optionValue)
        : [...value, optionValue],
    );
  }

  return (
    <div className="relative w-full sm:w-auto" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className={`inline-flex w-full items-center justify-between gap-2 rounded-full border px-4 py-2 text-sm transition disabled:opacity-60 sm:min-w-[190px] ${
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
          <UserRound aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--text-secondary)]" />
          <span className="truncate">{label}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-[var(--text-secondary)] transition ${open ? "rotate-180" : ""}`}
        />
      </button>

      {position && typeof document !== "undefined" ? createPortal(
        <div
          className="lz-floating-panel fixed z-[90] overflow-y-auto overscroll-contain rounded-[20px] border border-white/10 bg-[rgba(17,8,14,0.98)] p-1.5 shadow-[0_24px_60px_rgba(0,0,0,0.42)] backdrop-blur-2xl"
          ref={panelRef}
          role="listbox"
          style={{
            left: position.left,
            maxHeight: position.maxHeight,
            top: position.top,
            width: position.width,
          }}
        >
          <button
            aria-selected={selected.length === 0}
            className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
              selected.length === 0 ? "bg-white/[0.07] text-white" : "text-[var(--text-secondary)] hover:bg-white/[0.05] hover:text-white"
            }`}
            onClick={() => onChange([])}
            role="option"
            type="button"
          >
            <span>Todos</span>
            {selected.length === 0 ? <Check aria-hidden="true" className="h-4 w-4" /> : null}
          </button>
          {options.map((option) => {
            const active = value.includes(option.value);

            return (
              <button
                aria-selected={active}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition ${
                  active ? "bg-white/[0.07] text-white" : "text-[var(--text-secondary)] hover:bg-white/[0.05] hover:text-white"
                }`}
                key={option.value}
                onClick={() => toggle(option.value)}
                role="option"
                type="button"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {option.value === "me" ? null : (
                    <UserRound aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-violet-300" />
                  )}
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
          })}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
