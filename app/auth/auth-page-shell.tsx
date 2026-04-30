import Image from "next/image";
import Link from "next/link";
import { type ReactNode } from "react";

import { ClearMessageSearchParams } from "@/app/_components/clear-message-search-params";

type AuthPageShellProps = {
  title: string;
  description: string;
  errorMessage?: string;
  successMessage?: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthPageShell({
  title,
  description,
  errorMessage,
  successMessage,
  children,
  footer,
}: AuthPageShellProps) {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden px-5 py-5 text-[var(--text-primary)] sm:px-6 sm:py-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8%] top-[-4%] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(216,31,89,0.26),transparent_70%)] blur-xl" />
        <div className="absolute bottom-[-10%] right-[-4%] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(255,119,163,0.18),transparent_72%)] blur-xl" />
      </div>

      <header className="relative z-10 flex items-center justify-between gap-4">
        <Link className="inline-flex items-center gap-3" href="/">
          <span className="flex items-center justify-center rounded-[18px] border border-white/10 bg-white/5 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <Image
              alt="LZ Community"
              className="h-auto w-16 sm:w-20"
              height={78}
              priority
              sizes="(max-width: 640px) 64px, 80px"
              src="/LOGO_1.png"
              width={120}
            />
          </span>
          <span className="flex min-h-12 items-center text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--text-dim)]">
            LZ Community
          </span>
        </Link>

        <Link
          className="rounded-full px-4 py-2 text-sm text-[var(--text-secondary)] transition hover:bg-white/5 hover:text-white"
          href="/"
        >
          Tela inicial
        </Link>
      </header>

      <section className="relative z-10 flex flex-1 items-center justify-center py-8">
        <div className="lz-panel mx-auto w-full max-w-md rounded-[28px] p-5 shadow-[0_28px_90px_rgba(0,0,0,0.45)] sm:p-6">
          <div className="mb-6 space-y-2">
            <h1 className="text-2xl font-semibold text-white">{title}</h1>
            <p className="text-sm leading-6 text-[var(--text-muted)]">
              {description}
            </p>
          </div>

          {errorMessage || successMessage ? <ClearMessageSearchParams /> : null}

          {errorMessage ? (
            <p className="mb-5 rounded-2xl border border-[rgba(255,107,133,0.24)] bg-[rgba(41,13,21,0.94)] px-4 py-3 text-sm text-[var(--negative)]">
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p className="mb-5 rounded-2xl border border-[rgba(73,212,166,0.24)] bg-[rgba(13,34,27,0.92)] px-4 py-3 text-sm text-[var(--positive)]">
              {successMessage}
            </p>
          ) : null}

          {children}

          <div className="mt-6 border-t border-white/10 pt-4 text-sm text-[var(--text-muted)]">
            {footer}
          </div>
        </div>
      </section>
    </main>
  );
}
