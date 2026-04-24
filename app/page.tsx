export default function Home() {
  return (
    <main className="flex min-h-screen items-center bg-neutral-50 px-6 py-24 text-neutral-950">
      <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-3xl border border-neutral-200 bg-white p-10 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.32em] text-neutral-500">
          LZ
        </p>
        <div className="space-y-4">
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance">
            A base do projeto esta pronta para voce comecar a implementar as
            funcionalidades da tela.
          </h1>
          <p className="max-w-3xl text-base leading-7 text-neutral-600">
            O dominio foi separado da camada server, entao a UI pode crescer sem
            importar banco direto. Quando voce precisar persistir dados, use os
            modulos de `@/lib/server` dentro de Server Components, actions ou
            Route Handlers.
          </p>
        </div>
        <div className="grid gap-4 text-sm text-neutral-600 md:grid-cols-3">
          <article className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
            <h2 className="font-medium text-neutral-900">Regra de negocio</h2>
            <p className="mt-2 leading-6">
              Reaproveite calculos e normalizadores por `@/core`.
            </p>
          </article>
          <article className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
            <h2 className="font-medium text-neutral-900">Camada server</h2>
            <p className="mt-2 leading-6">
              Banco e repositorio ficam isolados em `@/core/server`.
            </p>
          </article>
          <article className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
            <h2 className="font-medium text-neutral-900">Entrada do Next</h2>
            <p className="mt-2 leading-6">
              Use `@/lib/server` como ponto oficial para carregar dados.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}
