import Image from "next/image";
import Link from "next/link";

const features = [
  {
    title: "Monitoramento de odds",
    description: "Acompanhe oportunidades e mantenha a leitura do mercado no mesmo fluxo.",
  },
  {
    title: "Dashboard",
    description: "Veja lucro, médias, volume diário e evolução mensal sem abrir planilhas.",
  },
  {
    title: "Procedimentos",
    description: "Registre entradas, duplos, freebets e cassino com histórico organizado.",
  },
  {
    title: "Calculadora",
    description: "Calcule stakes, lay, freebet e resultado antes de transformar em procedimento.",
  },
  {
    title: "Freebets",
    description: "Separe coletas, conversões e resultados em um fluxo claro.",
  },
  {
    title: "Bancas",
    description: "Controle casas usadas, saldos e observações por workspace.",
  },
];

export default function Home() {
  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden px-5 py-5 text-[var(--text-primary)] sm:px-6 sm:py-6">
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

        <div className="flex justify-end gap-2 sm:gap-3">
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

      <section className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 py-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="space-y-6">
          <div className="space-y-4">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Toda sua gestão em um só lugar.
            </h1>
            <p className="max-w-2xl text-base leading-8 text-[var(--text-muted)] sm:text-lg">
              Uma central para acompanhar odds, registrar procedimentos, calcular entradas,
              organizar freebets e controlar bancas.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              className="lz-button-primary rounded-full px-5 py-3 text-sm font-semibold"
              href="/cadastro"
            >
              Criar conta
            </Link>
            <Link
              className="lz-button-secondary rounded-full px-5 py-3 text-sm font-semibold"
              href="/login"
            >
              Entrar
            </Link>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {features.map((feature) => (
            <article
              className="rounded-[20px] border border-white/10 bg-white/4 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
              key={feature.title}
            >
              <h2 className="text-base font-semibold text-white">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
