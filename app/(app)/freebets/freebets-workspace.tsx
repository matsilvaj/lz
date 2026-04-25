"use client";

import Link from "next/link";
import { useState } from "react";

import { ProcedureModal } from "../_components/procedure-modal";
import { SectionCard, formatCurrency, formatNumber } from "../_components/ui";
import { updateFreebetResultAction } from "../procedure-actions";

type FreebetsWorkspaceProps = {
  bookmakers: string[];
  convertibleGroups: Array<{
    casa: string;
    ids: number[];
    quantidade: number;
    valor_total: number;
    lucro_total: number;
  }>;
  pendingConfirmation: Array<{
    id: number;
    data: string;
    casa: string;
    valor_fb: number;
    lucro_real: number;
    ganhou: string;
  }>;
  convertedHistory: Array<{
    texto_data: string;
    casa: string;
    valor_freebet: number;
    lucro_coleta: number;
    lucro_conversao: number | null;
    lucro_total: number;
  }>;
};

function getProfitClass(value: number) {
  return value >= 0 ? "text-emerald-600" : "text-red-500";
}

export function FreebetsWorkspace({
  bookmakers,
  convertibleGroups,
  pendingConfirmation,
  convertedHistory,
}: FreebetsWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<"available" | "history">("available");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
            activeTab === "available"
              ? "bg-neutral-950 text-white"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
          onClick={() => setActiveTab("available")}
          type="button"
        >
          Disponiveis
        </button>
        <button
          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
            activeTab === "history"
              ? "bg-neutral-950 text-white"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
          onClick={() => setActiveTab("history")}
          type="button"
        >
          Historico
        </button>
      </div>

      {activeTab === "available" ? (
        <div className="space-y-4">
          <SectionCard
            title="Prontas para conversao"
            description="Essas freebets ja podem virar um procedimento de conversao. Se precisar, revise o valor final na calculadora antes de salvar."
          >
            {convertibleGroups.length === 0 ? (
              <p className="text-sm leading-6 text-neutral-500">
                Nenhuma freebet pronta para conversao agora.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-neutral-500">
                    <tr className="border-b border-neutral-200">
                      <th className="px-0 py-3 font-medium">Qtd</th>
                      <th className="px-0 py-3 font-medium">Casa</th>
                      <th className="px-0 py-3 font-medium">Valor FB</th>
                      <th className="px-0 py-3 font-medium">Lucro Base</th>
                      <th className="px-0 py-3 font-medium">Acao</th>
                    </tr>
                  </thead>
                  <tbody>
                    {convertibleGroups.map((item) => (
                      <tr className="border-b border-neutral-100 last:border-b-0" key={item.casa}>
                        <td className="px-0 py-3 text-neutral-700">
                          {formatNumber(item.quantidade)} item(ns)
                        </td>
                        <td className="px-0 py-3 font-medium text-neutral-900">{item.casa}</td>
                        <td className="px-0 py-3 text-neutral-700">
                          {formatCurrency(item.valor_total)}
                        </td>
                        <td className={`px-0 py-3 ${getProfitClass(item.lucro_total)}`}>
                          {formatCurrency(item.lucro_total)}
                        </td>
                        <td className="px-0 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <ProcedureModal
                              bookmakers={bookmakers}
                              defaultValues={{
                                procedureType: "Converter Freebet",
                                houses: item.casa,
                                freebetHouse: item.casa,
                                freebetValue: item.valor_total,
                                entryValue: item.lucro_total,
                                originIds: item.ids,
                              }}
                              returnTo="/freebets"
                              submitLabel="Salvar conversao"
                              title={`Converter Freebet - ${item.casa}`}
                              triggerClassName="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
                              triggerLabel="Converter"
                              typeOptions={["Converter Freebet"]}
                            />
                            <Link
                              className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950"
                              href="/calculadora"
                            >
                              Calculadora
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Aguardando resultado"
            description="Use estas acoes para confirmar se a freebet foi ativada quando a condicao depender da aposta."
          >
            {pendingConfirmation.length === 0 ? (
              <p className="text-sm leading-6 text-neutral-500">
                Nenhuma freebet aguardando confirmacao no momento.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-neutral-500">
                    <tr className="border-b border-neutral-200">
                      <th className="px-0 py-3 font-medium">Data</th>
                      <th className="px-0 py-3 font-medium">Casa</th>
                      <th className="px-0 py-3 font-medium">Valor FB</th>
                      <th className="px-0 py-3 font-medium">Lucro Base</th>
                      <th className="px-0 py-3 font-medium">Ganhou?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingConfirmation.map((item) => (
                      <tr className="border-b border-neutral-100 last:border-b-0" key={item.id}>
                        <td className="px-0 py-3 text-neutral-700">{item.data}</td>
                        <td className="px-0 py-3 font-medium text-neutral-900">{item.casa}</td>
                        <td className="px-0 py-3 text-neutral-700">
                          {formatCurrency(item.valor_fb)}
                        </td>
                        <td className={`px-0 py-3 ${getProfitClass(item.lucro_real)}`}>
                          {formatCurrency(item.lucro_real)}
                        </td>
                        <td className="px-0 py-3">
                          <div className="flex flex-wrap gap-2">
                            <form action={updateFreebetResultAction}>
                              <input name="procedureId" type="hidden" value={item.id} />
                              <input name="result" type="hidden" value="Sim" />
                              <input name="returnTo" type="hidden" value="/freebets" />
                              <button className="rounded-xl bg-neutral-950 px-3 py-2 text-sm font-medium text-white transition hover:bg-neutral-800">
                                Sim
                              </button>
                            </form>
                            <form action={updateFreebetResultAction}>
                              <input name="procedureId" type="hidden" value={item.id} />
                              <input name="result" type="hidden" value="Nao" />
                              <input name="returnTo" type="hidden" value="/freebets" />
                              <button className="rounded-xl border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950">
                                Nao
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      ) : (
        <SectionCard
          title="Historico"
          description="Freebets coletadas e convertidas, com leitura da etapa de coleta e da etapa final."
        >
          {convertedHistory.length === 0 ? (
            <p className="text-sm leading-6 text-neutral-500">
              Nenhuma conversao registrada ainda.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-neutral-500">
                  <tr className="border-b border-neutral-200">
                    <th className="px-0 py-3 font-medium">Data (Col - Conv)</th>
                    <th className="px-0 py-3 font-medium">Casa</th>
                    <th className="px-0 py-3 font-medium">Valor FB</th>
                    <th className="px-0 py-3 font-medium">Lucro Base</th>
                    <th className="px-0 py-3 font-medium">Lucro Final</th>
                    <th className="px-0 py-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {convertedHistory.map((item) => (
                    <tr className="border-b border-neutral-100 last:border-b-0" key={item.texto_data}>
                      <td className="px-0 py-3 text-neutral-700">{item.texto_data}</td>
                      <td className="px-0 py-3 font-medium text-neutral-900">{item.casa}</td>
                      <td className="px-0 py-3 text-neutral-700">
                        {formatCurrency(item.valor_freebet)}
                      </td>
                      <td className={`px-0 py-3 ${getProfitClass(item.lucro_coleta)}`}>
                        {formatCurrency(item.lucro_coleta)}
                      </td>
                      <td
                        className={`px-0 py-3 ${getProfitClass(item.lucro_conversao ?? 0)}`}
                      >
                        {formatCurrency(item.lucro_conversao ?? 0)}
                      </td>
                      <td className={`px-0 py-3 font-medium ${getProfitClass(item.lucro_total)}`}>
                        {formatCurrency(item.lucro_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      )}
    </div>
  );
}
