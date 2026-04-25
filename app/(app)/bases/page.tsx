import { requireBaseContext } from "@/lib/auth/base-context";

import { PageHeader, SectionCard } from "../_components/ui";
import { createBaseAction, switchBaseAction } from "./actions";

export default async function BasesPage() {
  const { activeBase, bases } = await requireBaseContext();

  return (
    <div className="space-y-6">
      <PageHeader
        description="Separe sua operacao por bases diferentes para organizar procedimentos, bancas e observacoes sem misturar contextos."
        title="Bases"
      />

      <SectionCard title="Nova base" description="Crie uma nova base para trabalhar com outro conjunto de contas e operacoes.">
        <form action={createBaseAction} className="flex flex-col gap-3 md:flex-row">
          <input
            className="flex-1 rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm text-neutral-950 outline-none transition focus:border-neutral-950"
            name="name"
            placeholder="Ex.: Irmao, Parceiro, Projeto B"
            type="text"
          />
          <button
            className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-neutral-800"
            type="submit"
          >
            Criar base
          </button>
        </form>
      </SectionCard>

      <SectionCard title="Minhas bases" description="Escolha qual base fica ativa no sistema.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {bases.map((base) => {
            const isActive = base.id === activeBase.id;

            return (
              <div
                className={`rounded-2xl border p-5 ${
                  isActive
                    ? "border-neutral-950 bg-neutral-950 text-white"
                    : "border-neutral-200 bg-white text-neutral-950"
                }`}
                key={base.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">{base.nome}</p>
                    <p className={`mt-1 text-sm ${isActive ? "text-neutral-300" : "text-neutral-500"}`}>
                      {isActive ? "Base ativa" : "Base disponivel"}
                    </p>
                  </div>

                  {isActive ? (
                    <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium">
                      Ativa
                    </span>
                  ) : null}
                </div>

                {!isActive ? (
                  <form action={switchBaseAction.bind(null, base.id, "/bases")} className="mt-5">
                    <button
                      className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950"
                      type="submit"
                    >
                      Usar esta base
                    </button>
                  </form>
                ) : null}
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
