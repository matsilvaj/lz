"use client";

import { RotateCcw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { CloseIcon } from "./ui";

type HousePickerDialogProps = {
  open: boolean;
  title: string;
  options: string[];
  multiple?: boolean;
  selectedValues: string[];
  onClose: () => void;
  onToggle: (value: string) => void;
  onClear: () => void;
};

export function HousePickerDialog({
  open,
  title,
  options,
  multiple = false,
  selectedValues,
  onClose,
  onToggle,
  onClear,
}: HousePickerDialogProps) {
  const [search, setSearch] = useState("");

  const visibleOptions = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return options;
    }

    return options.filter((option) =>
      option.toLowerCase().includes(normalizedSearch),
    );
  }, [options, search]);

  if (!open) {
    return null;
  }

  if (typeof document === "undefined") {
    return null;
  }

  function handleClose() {
    setSearch("");
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-4">
      <div className="lz-panel max-h-[calc(100dvh-24px)] w-full max-w-xl overflow-y-auto rounded-[26px] shadow-[0_30px_90px_rgba(0,0,0,0.5)] sm:rounded-[32px]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <h3 className="text-base font-semibold text-white">{title}</h3>

          <button
            aria-label="Fechar"
            className="lz-button-secondary inline-flex h-9 w-9 items-center justify-center rounded-full p-0"
            onClick={handleClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-dim)]"
            />
            <input
              className="lz-input w-full rounded-2xl py-3 pl-10 pr-3 text-sm"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar casa..."
              type="search"
              value={search}
            />
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {visibleOptions.length === 0 ? (
              <p className="px-1 py-3 text-sm text-[var(--text-muted)]">
                Nenhuma casa encontrada.
              </p>
            ) : (
              visibleOptions.map((option) => {
                const active = selectedValues.includes(option);

                return (
                  <button
                    className={`flex w-full items-center justify-between rounded-2xl px-3 py-2.5 text-sm transition ${
                      active ? "lz-button-primary" : "lz-button-secondary"
                    }`}
                    key={option}
                    onClick={() => {
                      onToggle(option);
                      if (!multiple) {
                        handleClose();
                      }
                    }}
                    type="button"
                  >
                    <span>{option}</span>
                    {active ? <span>Selecionada</span> : null}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-4">
            <button
              className="inline-flex items-center gap-1.5 text-sm text-[var(--text-dim)] transition hover:text-white"
              onClick={() => {
                setSearch("");
                onClear();
              }}
              type="button"
            >
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
              <span>Limpar</span>
            </button>

            {multiple ? (
              <button
                className="lz-button-primary rounded-full px-4 py-2 text-sm font-semibold"
                onClick={handleClose}
                type="button"
              >
                Concluir
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
