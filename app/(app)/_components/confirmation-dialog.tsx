"use client";

import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { CloseIcon } from "./ui";

type ConfirmationDialogProps = {
  children: ReactNode;
  centered?: boolean;
  description?: string;
  icon?: ReactNode;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
};

export function ConfirmationDialog({
  centered = false,
  children,
  description,
  icon,
  onOpenChange,
  open,
  title,
}: ConfirmationDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onOpenChange, open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (!dialogRef.current?.contains(event.target as Node)) {
          onOpenChange(false);
        }
      }}
      role="presentation"
    >
      <div
        aria-modal="true"
        className="lz-panel max-h-[calc(100dvh-32px)] w-full max-w-md overflow-y-auto rounded-[28px] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.55)] sm:p-6"
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
      >
        {centered ? (
          <div className="relative flex flex-col items-center text-center">
            <button
              aria-label="Fechar"
              className="absolute -right-1 -top-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/4 text-[var(--text-secondary)] transition hover:bg-white/8 hover:text-white"
              onClick={() => onOpenChange(false)}
              type="button"
            >
              <CloseIcon />
            </button>
            {icon ? <div className="mt-2">{icon}</div> : null}
            <h2 className="mt-4 text-lg font-semibold tracking-tight text-white">{title}</h2>
            {description ? (
              <p className="mt-2 max-w-sm text-sm leading-6 text-[var(--text-muted)]">
                {description}
              </p>
            ) : null}
          </div>
        ) : (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
            {description ? (
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                {description}
              </p>
            ) : null}
          </div>

          <button
            aria-label="Fechar"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/4 text-[var(--text-secondary)] transition hover:bg-white/8 hover:text-white"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>
        )}

        <div className={centered ? "mt-6" : "mt-5"}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
