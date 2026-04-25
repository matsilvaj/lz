"use client";

import Link from "next/link";
import { useState } from "react";

import { EmptyState, formatCurrency, formatNumber } from "../_components/ui";
import { updateFreebetResultAction } from "../procedure-actions";

type FreebetsWorkspaceProps = {
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
  convertibleGroups,
  pendingConfirmation,
  convertedHistory,
}: FreebetsWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<"freebets" | "history">("freebets");
  const [activeSubtab, setActiveSubtab] = useState<"convertible" | "pending">("convertible");

  function buildConverterHref(item: {
    casa: string;
    ids: number[];
    valor_total: number;
    lucro_total: number;
  }) {
    const params = new URLSearchParams();
    params.set("mode", "convert-freebet");
    params.set("house", item.casa);
    params.set("freebetValue", String(item.valor_total));
    params.set("entryValue", String(item.lucro_total));

    for (const originId of item.ids) {
      params.append("originIds", String(originId));
    }

    return `/calculadora?${params.toString()}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
            activeTab === "freebets"
              ? "bg-neutral-950 text-white"
              : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
          }`}
          onClick={() => setActiveTab("freebets")}
          type="button"
        >
          Freebets
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

      {activeTab === "freebets" ? (
        <div className="space-y-0">
          <div className="flex flex-wrap items-end gap-2 px-1">
            <button
              className={`rounded-t-2xl border border-b-0 px-4 py-2 text-sm font-medium transition ${
                activeSubtab === "convertible"
                  ? "border-neutral-200 bg-white text-neutral-950"
                  : "border-transparent bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
              onClick={() => setActiveSubtab("convertible")}
              type="button"
            >
              Prontas para conversao
            </button>
            <button
              className={`rounded-t-2xl border border-b-0 px-4 py-2 text-sm font-medium transition ${
                activeSubtab === "pending"
                  ? "border-neutral-200 bg-white text-neutral-950"
                  : "border-transparent bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
              onClick={() => setActiveSubtab("pending")}
              type="button"
            >
              Aguardando resultado
            </button>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-4 md:p-6">
            {activeSubtab === "convertible" ? (
              convertibleGroups.length === 0 ? (
                <EmptyState
                  description="Quando houver freebets prontas para conversao, elas aparecerao aqui."
                  title="Nenhuma freebet pronta para conversao"
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full table-fixed text-center text-sm">
                    <colgroup>
                      <col className="w-[18%]" />
                      <col className="w-[24%]" />
                      <col className="w-[18%]" />
                      <col className="w-[18%]" />
                      <col className="w-[22%]" />
                    </colgroup>
                    <thead className="text-neutral-500">
                      <tr className="border-b border-neutral-200">
                        <th className="px-2 py-3 font-medium">Qtd</th>
                        <th className="px-2 py-3 font-medium">Casa</th>
                        <th className="px-2 py-3 font-medium">Valor FB</th>
                        <th className="px-2 py-3 font-medium">Lucro Base</th>
                        <th className="px-2 py-3 font-medium">Acao</th>
                      </tr>
                    </thead>
                    <tbody>
                      {convertibleGroups.map((item) => (
                        <tr className="border-b border-neutral-100 last:border-b-0" key={item.casa}>
                          <td className="px-2 py-4 text-neutral-700">
                            {formatNumber(item.quantidade)} item(ns)
                          </td>
                          <td className="px-2 py-4 font-medium text-neutral-900">{item.casa}</td>
                          <td className="px-2 py-4 text-neutral-700">
                            {formatCurrency(item.valor_total)}
                          </td>
                          <td className={`px-2 py-4 ${getProfitClass(item.lucro_total)}`}>
                            {formatCurrency(item.lucro_total)}
                          </td>
                          <td className="px-2 py-4">
                            <div className="flex justify-center">
                              <Link
                                className="rounded-xl bg-neutral-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-800"
                                href={buildConverterHref(item)}
                              >
                                Converter
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : pendingConfirmation.length === 0 ? (
              <EmptyState
                description="Quando alguma freebet depender do resultado da aposta, ela aparecera aqui."
                title="Nenhuma freebet aguardando resultado"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full table-fixed text-center text-sm">
                  <colgroup>
                    <col className="w-[16%]" />
                    <col className="w-[22%]" />
                    <col className="w-[18%]" />
                    <col className="w-[18%]" />
                    <col className="w-[26%]" />
                  </colgroup>
                  <thead className="text-neutral-500">
                    <tr className="border-b border-neutral-200">
                      <th className="px-2 py-3 font-medium">Data</th>
                      <th className="px-2 py-3 font-medium">Casa</th>
                      <th className="px-2 py-3 font-medium">Valor FB</th>
                      <th className="px-2 py-3 font-medium">Lucro Base</th>
                      <th className="px-2 py-3 font-medium">Ganhou?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingConfirmation.map((item) => (
                      <tr className="border-b border-neutral-100 last:border-b-0" key={item.id}>
                        <td className="px-2 py-4 text-neutral-700">{item.data}</td>
                        <td className="px-2 py-4 font-medium text-neutral-900">{item.casa}</td>
                        <td className="px-2 py-4 text-neutral-700">
                          {formatCurrency(item.valor_fb)}
                        </td>
                        <td className={`px-2 py-4 ${getProfitClass(item.lucro_real)}`}>
                          {formatCurrency(item.lucro_real)}
                        </td>
                        <td className="px-2 py-4">
                          <div className="flex flex-wrap justify-center gap-2">
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
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 md:p-6">
          {convertedHistory.length === 0 ? (
            <EmptyState
              description="Quando houver conversoes concluídas, o historico aparecera aqui."
              title="Nenhuma conversao registrada"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full table-fixed text-center text-sm">
                <colgroup>
                  <col className="w-[26%]" />
                  <col className="w-[20%]" />
                  <col className="w-[18%]" />
                  <col className="w-[18%]" />
                  <col className="w-[18%]" />
                </colgroup>
                <thead className="text-neutral-500">
                  <tr className="border-b border-neutral-200">
                    <th className="px-2 py-3 font-medium">Data (Col - Conv)</th>
                    <th className="px-2 py-3 font-medium">Casa</th>
                    <th className="px-2 py-3 font-medium">Valor FB</th>
                    <th className="px-2 py-3 font-medium">Lucro Base</th>
                    <th className="px-2 py-3 font-medium">Lucro Final</th>
                    <th className="px-2 py-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {convertedHistory.map((item) => (
                    <tr className="border-b border-neutral-100 last:border-b-0" key={item.texto_data}>
                      <td className="px-2 py-4 text-neutral-700">{item.texto_data}</td>
                      <td className="px-2 py-4 font-medium text-neutral-900">{item.casa}</td>
                      <td className="px-2 py-4 text-neutral-700">
                        {formatCurrency(item.valor_freebet)}
                      </td>
                      <td className={`px-2 py-4 ${getProfitClass(item.lucro_coleta)}`}>
                        {formatCurrency(item.lucro_coleta)}
                      </td>
                      <td className={`px-2 py-4 ${getProfitClass(item.lucro_conversao ?? 0)}`}>
                        {formatCurrency(item.lucro_conversao ?? 0)}
                      </td>
                      <td className={`px-2 py-4 font-medium ${getProfitClass(item.lucro_total)}`}>
                        {formatCurrency(item.lucro_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
