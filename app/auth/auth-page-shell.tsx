import Image from "next/image";
import Link from "next/link";
import { type ReactNode } from "react";

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
    <main className="relative flex min-h-screen flex-col overflow-hidden px-6 py-6 text-[var(--text-primary)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8%] top-[-4%] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(216,31,89,0.26),transparent_70%)] blur-xl" />
        <div className="absolute bottom-[-10%] right-[-4%] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(255,119,163,0.18),transparent_72%)] blur-xl" />
      </div>

      <header className="relative z-10 flex items-center justify-between gap-4">
        <Link className="inline-flex items-center gap-3" href="/">
          <span className="flex items-center justify-center rounded-[22px] border border-white/10 bg-white/5 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <Image
              alt="LZ"
              className="h-auto w-20 md:w-24"
              height={78}
              priority
              sizes="(max-width: 768px) 80px, 96px"
              src="/LOGO_1.png"
              width={120}
            />
          </span>
          <div className="hidden sm:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-[var(--text-dim)]">
              LZ Community
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Área segura da operação</p>
          </div>
        </Link>

        <Link className="rounded-full px-4 py-2 text-sm text-[var(--text-secondary)] transition hover:bg-white/5 hover:text-white" href="/">
          Tela inicial
        </Link>
      </header>

      <section className="relative z-10 flex flex-1 items-center py-10">
        <div className="mx-auto grid w-full max-w-6xl gap-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(380px,0.85fr)] xl:items-center">
          <div className="hidden xl:block">
            <div className="lz-panel rounded-[36px] p-8">
              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-dim)]">
                Premium Operations Hub
              </span>

              <h1 className="mt-6 max-w-xl text-5xl font-semibold tracking-tight text-white">
                Controle as suas operações com clareza, ritmo e elegância.
              </h1>

              <p className="mt-5 max-w-2xl text-base leading-8 text-[var(--text-muted)]">
                Dashboard, freebets, bancas, histórico e procedimentos em uma experiência noturna,
                profissional e desenhada para uso intenso no dia a dia.
              </p>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {[
                  { label: "Visão diária", value: "Tempo real" },
                  { label: "Fluxo de freebets", value: "Ação guiada" },
                  { label: "Histórico", value: "Leitura limpa" },
                ].map((item) => (
                  <div
                    className="rounded-[24px] border border-white/10 bg-white/4 p-4"
                    key={item.label}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                      {item.label}
                    </p>
                    <p className="mt-3 text-lg font-semibold text-white">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lz-panel mx-auto w-full max-w-md rounded-[34px] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.45)] sm:p-7">
            <div className="space-y-2">
              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-dim)]">
                {title}
              </span>
              <h1 className="text-3xl font-semibold tracking-tight text-white">{title}</h1>
              <p className="text-sm leading-7 text-[var(--text-muted)]">{description}</p>
            </div>

            {errorMessage ? (
              <p className="rounded-2xl border border-[rgba(255,107,133,0.24)] bg-[rgba(41,13,21,0.94)] px-4 py-3 text-sm text-[var(--negative)]">
                {errorMessage}
              </p>
            ) : null}

            {successMessage ? (
              <p className="rounded-2xl border border-[rgba(73,212,166,0.24)] bg-[rgba(13,34,27,0.92)] px-4 py-3 text-sm text-[var(--positive)]">
                {successMessage}
              </p>
            ) : null}

            <div className="mt-6">{children}</div>

            <div className="mt-6 border-t border-white/10 pt-4 text-sm text-[var(--text-muted)]">
              {footer}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
