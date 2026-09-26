"use client";

// Formato único das janelas de filtros (Monitor, Procedimentos, Histórico).

import { Check, RotateCcw, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function FiltersDialog({
  applyLabel = "Aplicar",
  children,
  footerExtra,
  onClose,
  onReset,
  title,
}: {
  applyLabel?: string;
  children: ReactNode;
  // Ações próprias de cada tela no rodapé (ex.: salvar padrão no Monitor).
  footerExtra?: ReactNode;
  onClose: () => void;
  onReset: () => void;
  title: string;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[170] flex items-center justify-center overflow-hidden bg-black/65 p-3 backdrop-blur-md sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        aria-modal="true"
        className="lz-floating-panel flex max-h-[calc(100dvh-24px)] w-full min-w-0 max-w-3xl flex-col rounded-[24px] border border-white/10 bg-[rgba(18,5,13,0.96)] shadow-[0_28px_90px_rgba(0,0,0,0.48)] sm:max-h-[calc(100dvh-48px)] sm:rounded-[28px]"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 p-4 pb-0 sm:p-5 sm:pb-0">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-dim)]">
              Filtros
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white sm:text-xl">{title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              aria-label="Limpar filtros"
              className="inline-flex h-11 w-11 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] text-xs font-semibold text-[var(--text-secondary)] transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white sm:w-auto sm:px-4"
              onClick={onReset}
              type="button"
            >
              <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Limpar filtros</span>
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

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">{children}</div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/8 p-4 pt-3 text-xs font-semibold sm:p-5 sm:pt-3">
          <div className="flex flex-wrap items-center gap-3">{footerExtra}</div>
          <button
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[rgba(211,27,91,0.7)] bg-[linear-gradient(180deg,rgba(211,27,91,0.95),rgba(163,8,63,0.95))] px-6 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(211,27,91,0.2)] transition hover:brightness-110"
            onClick={onClose}
            type="button"
          >
            <Check aria-hidden="true" className="h-4 w-4" />
            <span>{applyLabel}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function FilterSection({
  action,
  children,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

// Opção de filtro em formato de pílula, usada nas seções acima.
export function FilterChip({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm transition ${
        active ? "lz-button-primary" : "lz-button-secondary"
      }`}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}
