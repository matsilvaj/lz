type ComingSoonPageProps = {
  title: string;
  description: string;
};

export function ComingSoonPage({ title, description }: ComingSoonPageProps) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-neutral-200 bg-white p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              Em breve
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-950">
              {title}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-neutral-600">
              {description}
            </p>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
            Estrutura em desenvolvimento
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-neutral-950">Painel reservado</h2>
            <p className="text-sm text-neutral-600">
              O modulo ja tem espaco separado no projeto, mas a leitura final ainda nao esta liberada.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="h-3 w-20 rounded-full bg-neutral-200" />
              <div className="mt-4 h-8 w-24 rounded-lg bg-neutral-200" />
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="h-3 w-24 rounded-full bg-neutral-200" />
              <div className="mt-4 h-8 w-16 rounded-lg bg-neutral-200" />
            </div>
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="h-3 w-16 rounded-full bg-neutral-200" />
              <div className="mt-4 h-8 w-28 rounded-lg bg-neutral-200" />
            </div>
          </div>

          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <div className="flex h-44 items-end gap-2">
              <div className="h-16 w-full rounded-lg bg-neutral-200" />
              <div className="h-28 w-full rounded-lg bg-neutral-200" />
              <div className="h-20 w-full rounded-lg bg-neutral-200" />
              <div className="h-36 w-full rounded-lg bg-neutral-200" />
              <div className="h-24 w-full rounded-lg bg-neutral-200" />
              <div className="h-12 w-full rounded-lg bg-neutral-200" />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-neutral-950">Etapa atual</h2>
            <p className="text-sm text-neutral-600">
              Base visual e ponto de entrada prontos para receber a implementacao completa.
            </p>
          </div>

          <div className="space-y-3">
            {[
              "Estrutura de tela reservada",
              "Area de navegacao publicada",
              "Conteudo final protegido ate a proxima etapa",
            ].map((item) => (
              <div
                className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3"
                key={item}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-neutral-400" />
                <span className="text-sm text-neutral-700">{item}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
