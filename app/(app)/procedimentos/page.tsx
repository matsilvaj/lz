import { getProceduresPageData } from "@/lib/server/app-data";

import { ProcedureModal } from "../_components/procedure-modal";
import { PageHeader, SectionCard, formatCurrency } from "../_components/ui";

export default async function ProceduresPage() {
  const data = await getProceduresPageData();

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.heading}
        description="Abra o popup para cadastrar um novo procedimento e acompanhe a lista completa logo abaixo."
        action={
          <ProcedureModal
            bookmakers={data.bookmakers}
            returnTo="/procedimentos"
            triggerLabel="Novo Procedimento"
          />
        }
      />

      <SectionCard
        title="Lista de procedimentos"
        description="Colunas principais para leitura rapida da operacao."
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-neutral-500">
              <tr className="border-b border-neutral-200">
                <th className="px-0 py-3 font-medium">Data</th>
                <th className="px-0 py-3 font-medium">Tipo</th>
                <th className="px-0 py-3 font-medium">Jogo</th>
                <th className="px-0 py-3 font-medium">Casas</th>
                <th className="px-0 py-3 font-medium">Lucro base</th>
                <th className="px-0 py-3 font-medium">Duplo?</th>
                <th className="px-0 py-3 font-medium">Lucro final</th>
              </tr>
            </thead>
            <tbody>
              {data.procedures.map((procedure) => (
                <tr className="border-b border-neutral-100 last:border-b-0" key={procedure.id}>
                  <td className="px-0 py-3 text-neutral-700">{procedure.data_operacao}</td>
                  <td className="px-0 py-3 font-medium text-neutral-900">
                    {procedure.tipo_procedimento}
                  </td>
                  <td className="px-0 py-3 text-neutral-700">
                    {procedure.jogo_time_pa || "-"}
                  </td>
                  <td className="px-0 py-3 text-neutral-700">
                    {procedure.casas_envolvidas || "-"}
                  </td>
                  <td
                    className={`px-0 py-3 ${
                      procedure.lucro_final >= 0 ? "text-emerald-600" : "text-red-500"
                    }`}
                  >
                    {formatCurrency(procedure.lucro_final)}
                  </td>
                  <td className="px-0 py-3 text-neutral-700">
                    {procedure.bateu_duplo ? "Sim" : "Nao"}
                  </td>
                  <td
                    className={`px-0 py-3 font-medium ${
                      procedure.lucro_real >= 0 ? "text-emerald-600" : "text-red-500"
                    }`}
                  >
                    {formatCurrency(procedure.lucro_real)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}
