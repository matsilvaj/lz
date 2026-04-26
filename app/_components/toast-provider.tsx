"use client";

import { Suspense, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

type ToastTone = "success" | "error" | "info";

type ToastItem = {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
};

type ToastInput = Omit<ToastItem, "id">;

const TOAST_TIMEOUT_MS = 4200;

const toneClasses: Record<ToastTone, string> = {
  success:
    "border-[rgba(73,212,166,0.28)] bg-[rgba(13,34,27,0.95)] text-[var(--text-primary)]",
  error:
    "border-[rgba(255,107,133,0.28)] bg-[rgba(41,13,21,0.96)] text-[var(--text-primary)]",
  info:
    "border-[rgba(255,122,164,0.24)] bg-[rgba(23,9,17,0.95)] text-[var(--text-primary)]",
};

const toneAccentClasses: Record<ToastTone, string> = {
  success: "bg-[var(--positive)]",
  error: "bg-[var(--negative)]",
  info: "bg-[var(--accent)]",
};

const ToastContext = createContext<{
  showToast: (input: ToastInput) => void;
} | null>(null);

function buildToastId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function ToastUrlSync({
  showToast,
}: {
  showToast: (input: ToastInput) => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const handledToastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const title = searchParams.get("toast");
    const tone = (searchParams.get("toastType") as ToastTone | null) ?? "info";
    const description = searchParams.get("toastDescription") ?? undefined;

    if (!title) {
      handledToastKeyRef.current = null;
      return;
    }

    const toastKey = [pathname, title, tone, description ?? ""].join("|");
    if (handledToastKeyRef.current === toastKey) {
      return;
    }

    handledToastKeyRef.current = toastKey;
    showToast({ title, tone, description });

    if (typeof window === "undefined") {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete("toast");
    nextParams.delete("toastType");
    nextParams.delete("toastDescription");

    const nextQuery = nextParams.toString();
    const nextUrl = `${pathname}${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [pathname, searchParams, showToast]);

  return null;
}

export function ToastProvider({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  const showToast = useCallback(
    ({ title, description, tone }: ToastInput) => {
      const id = buildToastId();
      setToasts((current) => [...current, { id, title, description, tone }]);

      window.setTimeout(() => {
        dismissToast(id);
      }, TOAST_TIMEOUT_MS);
    },
    [dismissToast],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        <ToastUrlSync showToast={showToast} />
      </Suspense>

      <div className="pointer-events-none fixed inset-x-0 top-4 z-[120] flex justify-center px-4 sm:justify-end">
        <div className="flex w-full max-w-sm flex-col gap-3">
          {toasts.map((toast) => (
            <div
              className={`pointer-events-auto animate-[lz-toast-in_360ms_cubic-bezier(0.16,1,0.3,1)] overflow-hidden rounded-[22px] border shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl ${toneClasses[toast.tone]}`}
              key={toast.id}
              role="status"
            >
              <div className="flex items-start gap-3 px-4 py-3.5">
                <span
                  aria-hidden="true"
                  className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${toneAccentClasses[toast.tone]}`}
                />

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{toast.title}</p>
                  {toast.description ? (
                    <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                      {toast.description}
                    </p>
                  ) : null}
                </div>

                <button
                  aria-label="Fechar notificação"
                  className="rounded-full p-1 text-[var(--text-dim)] transition hover:bg-white/5 hover:text-[var(--text-primary)]"
                  onClick={() => dismissToast(toast.id)}
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M6 6L18 18M18 6L6 18"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeWidth="1.8"
                    />
                  </svg>
                </button>
              </div>

              <div className="h-px w-full bg-white/8" />
              <div
                className={`h-1 animate-[lz-toast-progress_${TOAST_TIMEOUT_MS}ms_linear_forwards] ${toneAccentClasses[toast.tone]}`}
              />
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast precisa ser usado dentro de ToastProvider.");
  }

  return context;
}
