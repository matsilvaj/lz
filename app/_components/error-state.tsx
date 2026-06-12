"use client";

import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { useEffect } from "react";

type AppErrorStateProps = {
  description: string;
  error?: Error & { digest?: string };
  homeHref?: string;
  reset?: () => void;
  title: string;
};

export function AppErrorState({
  description,
  error,
  homeHref = "/dashboard",
  reset,
  title,
}: AppErrorStateProps) {
  useEffect(() => {
    if (error) {
      console.error(error);
    }
  }, [error]);

  return (
    <section className="lz-panel rounded-[28px] p-5 md:p-8">
      <div className="relative mx-auto flex max-w-2xl flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[rgba(255,190,115,0.22)] bg-[rgba(255,190,115,0.12)] text-[var(--warning)]">
          <AlertTriangle aria-hidden="true" className="h-6 w-6" />
        </div>

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-dim)]">
          Falha temporaria
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">
          {title}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-[var(--text-muted)] md:text-base">
          {description}
        </p>

        {error?.digest ? (
          <p className="mt-4 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-xs text-[var(--text-dim)]">
            Codigo: {error.digest}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {reset ? (
            <button
              className="lz-button-primary inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
              onClick={reset}
              type="button"
            >
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              Tentar novamente
            </button>
          ) : null}
          <Link
            className="lz-button-secondary inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
            href={homeHref}
          >
            <Home aria-hidden="true" className="h-4 w-4" />
            Ir para o inicio
          </Link>
        </div>
      </div>
    </section>
  );
}
