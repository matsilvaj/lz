import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden px-6 py-6 text-[var(--text-primary)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-4%] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(216,31,89,0.28),transparent_68%)] blur-xl" />
        <div className="absolute bottom-[-12%] right-[-4%] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,rgba(255,119,163,0.16),transparent_70%)] blur-xl" />
      </div>

      <header className="relative z-10 flex items-center justify-between gap-4">
        <Link className="inline-flex items-center gap-3" href="/">
          <span className="flex items-center justify-center rounded-[22px] border border-white/10 bg-white/5 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <Image
              alt="LZ Community"
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
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Interface premium para a operação</p>
          </div>
        </Link>

        <div className="flex justify-end gap-3">
          <Link
            className="lz-button-secondary rounded-full px-4 py-2 text-sm font-medium"
            href="/login"
          >
            Login
          </Link>
          <Link
            className="lz-button-primary rounded-full px-4 py-2 text-sm font-medium"
            href="/cadastro"
          >
            Cadastro
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 items-center py-10">
        <div className="grid w-full gap-8 xl:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] xl:items-center">
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-dim)]">
              Night mode by default
            </span>
            <div className="space-y-4">
              <h1 className="max-w-4xl text-5xl font-semibold tracking-tight text-white md:text-6xl">
                O centro de comando da LZ, agora com uma experiencia mais forte e memorável.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-[var(--text-muted)] md:text-lg">
                Gestão de procedimentos, freebets, bancas, histórico e calculadora em um fluxo
                visual limpo, responsivo e focado em velocidade de decisão.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                className="lz-button-primary rounded-full px-5 py-3 text-sm font-semibold"
                href="/cadastro"
              >
                Começar agora
              </Link>
              <Link
                className="lz-button-secondary rounded-full px-5 py-3 text-sm font-semibold"
                href="/login"
              >
                Entrar na plataforma
              </Link>
            </div>
          </div>

          <div className="lz-panel rounded-[38px] p-5 sm:p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                  Dashboard
                </p>
                <p className="mt-4 text-3xl font-semibold text-white">+R$ 3.480</p>
                <p className="mt-2 text-sm text-[var(--positive)]">Operação em tendencia positiva</p>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                  Freebets abertas
                </p>
                <p className="mt-4 text-3xl font-semibold text-white">12</p>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">Fluxo guiado para conversão</p>
              </div>
            </div>

            <div className="mt-4 rounded-[30px] border border-white/10 bg-[rgba(255,255,255,0.04)] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-white">Histórico e tabelas responsivas</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Leitura clara em desktop e mobile, com visual premium em modo escuro.
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[var(--text-secondary)]">
                  UI / UX
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {["Procedimentos", "Bancas", "Calculadora"].map((item) => (
                  <div className="rounded-[22px] border border-white/10 bg-white/4 px-4 py-4" key={item}>
                    <p className="text-sm font-medium text-white">{item}</p>
                    <div className="mt-3 h-2 rounded-full bg-white/8">
                      <div className="h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--accent-soft))]" style={{ width: "78%" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
