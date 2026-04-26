"use client";

import Link from "next/link";
import { useState } from "react";

import { FormSubmitButton } from "@/app/_components/form-submit-button";

import { AddFreebetModal } from "./add-freebet-modal";
import {
  EmptyState,
  StatusTag,
  formatCurrency,
  formatNumber,
} from "../_components/ui";
import { updateFreebetResultAction } from "../procedure-actions";

type FreebetsWorkspaceProps = {
  convertibleGroups: Array<{
    data: string;
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
  bookmakers: string[];
};

function getProfitClass(value: number) {
  return value >= 0 ? "text-[var(--positive)]" : "text-[var(--negative)]";
}

export function FreebetsWorkspace({
  bookmakers,
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
    <div className="space-y-5">
      <div className="lz-panel flex flex-wrap items-center justify-between gap-3 rounded-[28px] p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${
              activeTab === "freebets" ? "lz-button-primary" : "lz-button-secondary"
            }`}
            onClick={() => setActiveTab("freebets")}
            type="button"
          >
            Freebets
          </button>
          <button
            className={`rounded-full px-4 py-2.5 text-sm font-medium transition ${
              activeTab === "history" ? "lz-button-primary" : "lz-button-secondary"
            }`}
            onClick={() => setActiveTab("history")}
            type="button"
          >
            Histórico
          </button>
        </div>

        <AddFreebetModal bookmakers={bookmakers} />
      </div>

      {activeTab === "freebets" ? (
        <div className="space-y-0">
          <div className="flex flex-wrap items-end gap-2 pl-4 pr-1 md:pl-5">
            <button
              className={`rounded-t-[24px] px-4 py-2 text-sm font-medium transition ${
                activeSubtab === "convertible"
                  ? "border border-b-0 border-white/10 bg-[rgba(255,255,255,0.05)] text-white"
                  : "text-[var(--text-dim)] hover:text-white"
              }`}
              onClick={() => setActiveSubtab("convertible")}
              type="button"
            >
              Prontas para conversão
            </button>
            <button
              className={`rounded-t-[24px] px-4 py-2 text-sm font-medium transition ${
                activeSubtab === "pending"
                  ? "border border-b-0 border-white/10 bg-[rgba(255,255,255,0.05)] text-white"
                  : "text-[var(--text-dim)] hover:text-white"
              }`}
              onClick={() => setActiveSubtab("pending")}
              type="button"
            >
              Aguardando resultado
            </button>
          </div>

          <div className="lz-panel rounded-[30px] p-4 md:p-6">
            {activeSubtab === "convertible" ? (
              convertibleGroups.length === 0 ? (
                <EmptyState
                  action={
                    <Link
                      className="lz-button-secondary inline-flex rounded-full px-4 py-3 text-sm font-semibold"
                      href="/procedimentos"
                    >
                      Ver procedimentos
                    </Link>
                  }
                  description="Quando houver freebets prontas para conversão, esta fila vai destacar tudo o que precisa de ação."
                  eyebrow="Fila vazia"
                  title="Nenhuma freebet pronta para conversão"
                />
              ) : (
                <>
                  <div className="grid gap-4 p-4 md:hidden">
                    {convertibleGroups.map((item) => (
                      <article
                        className="rounded-[26px] border border-white/10 bg-white/5 p-4"
                        key={item.casa}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                              {item.data}
                            </p>
                            <p className="mt-2 text-lg font-semibold text-white">{item.casa}</p>
                            <p className="mt-1 text-sm text-[var(--text-secondary)]">
                              {formatNumber(item.quantidade)} item(ns)
                            </p>
                          </div>
                          <StatusTag tone="positive">Pronta</StatusTag>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-[22px] border border-white/10 bg-white/4 p-3">
                            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">
                              Valor FB
                            </p>
                            <p className="mt-2 text-lg font-semibold text-white">
                              {formatCurrency(item.valor_total)}
                            </p>
                          </div>
                          <div className="rounded-[22px] border border-white/10 bg-white/4 p-3">
                            <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">
                              Lucro base
                            </p>
                            <p
                              className={`mt-2 text-lg font-semibold ${getProfitClass(item.lucro_total)}`}
                            >
                              {formatCurrency(item.lucro_total)}
                            </p>
                          </div>
                        </div>

                        <Link
                          className="lz-button-primary mt-4 inline-flex rounded-full px-4 py-3 text-sm font-semibold"
                          href={buildConverterHref(item)}
                        >
                          Converter agora
                        </Link>
                      </article>
                    ))}
                  </div>

                  <div className="hidden overflow-x-auto md:block">
                    <table className="min-w-full text-sm">
                      <thead className="text-[var(--text-dim)]">
                        <tr className="border-b border-white/10">
                          <th className="px-3 py-3 text-center font-medium">Data</th>
                          <th className="px-3 py-3 text-center font-medium">Qtd</th>
                          <th className="px-3 py-3 text-center font-medium">Casa</th>
                          <th className="px-3 py-3 text-center font-medium">Valor FB</th>
                          <th className="px-3 py-3 text-center font-medium">Lucro Base</th>
                          <th className="px-3 py-3 text-center font-medium">AÃ§Ã£o</th>
                        </tr>
                      </thead>
                      <tbody>
                        {convertibleGroups.map((item) => (
                          <tr
                            className="border-b border-white/8 align-middle transition hover:bg-white/4"
                            key={item.casa}
                          >
                            <td className="px-3 py-4 text-center text-[var(--text-secondary)]">
                              {item.data}
                            </td>
                            <td className="px-3 py-4 text-center text-[var(--text-secondary)]">
                              {formatNumber(item.quantidade)} item(ns)
                            </td>
                            <td className="px-3 py-4 text-center font-semibold text-white">
                              {item.casa}
                            </td>
                            <td className="px-3 py-4 text-center text-[var(--text-secondary)]">
                              {formatCurrency(item.valor_total)}
                            </td>
                            <td
                              className={`px-3 py-4 text-center font-medium ${getProfitClass(item.lucro_total)}`}
                            >
                              {formatCurrency(item.lucro_total)}
                            </td>
                            <td className="px-3 py-4">
                              <div className="flex justify-center">
                                <Link
                                  className="lz-button-primary inline-flex rounded-full px-4 py-2.5 text-sm font-semibold"
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
                </>
              )
            ) : pendingConfirmation.length === 0 ? (
              <EmptyState
                description="Quando alguma freebet depender do resultado da aposta, ela aparecera aqui com a aÃ§Ã£o certa."
                eyebrow="Sem pendências"
                title="Nenhuma freebet aguardando resultado"
              />
            ) : (
              <>
                <div className="grid gap-4 p-4 md:hidden">
                  {pendingConfirmation.map((item) => (
                    <article
                      className="rounded-[26px] border border-white/10 bg-white/5 p-4"
                      key={item.id}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                            {item.data}
                          </p>
                          <p className="mt-2 text-lg font-semibold text-white">{item.casa}</p>
                        </div>
                        <StatusTag tone="warning">Aguardando</StatusTag>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[22px] border border-white/10 bg-white/4 p-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">
                            Valor FB
                          </p>
                          <p className="mt-2 text-lg font-semibold text-white">
                            {formatCurrency(item.valor_fb)}
                          </p>
                        </div>
                        <div className="rounded-[22px] border border-white/10 bg-white/4 p-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">
                            Lucro base
                          </p>
                          <p className={`mt-2 text-lg font-semibold ${getProfitClass(item.lucro_real)}`}>
                            {formatCurrency(item.lucro_real)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <form action={updateFreebetResultAction}>
                          <input name="procedureId" type="hidden" value={item.id} />
                          <input name="result" type="hidden" value="Sim" />
                          <input name="returnTo" type="hidden" value="/freebets" />
                          <FormSubmitButton
                            className="lz-button-primary rounded-full px-4 py-3 text-sm font-semibold"
                            pendingLabel="Salvando..."
                          >
                            Confirmar como ganha
                          </FormSubmitButton>
                        </form>
                        <form action={updateFreebetResultAction}>
                          <input name="procedureId" type="hidden" value={item.id} />
                          <input name="result" type="hidden" value="Nao" />
                          <input name="returnTo" type="hidden" value="/freebets" />
                          <FormSubmitButton
                            className="lz-button-secondary rounded-full px-4 py-3 text-sm font-semibold"
                            pendingLabel="Salvando..."
                          >
                            Confirmar como perdida
                          </FormSubmitButton>
                        </form>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="hidden overflow-x-auto md:block">
                  <table className="min-w-full text-sm">
                    <thead className="text-[var(--text-dim)]">
                      <tr className="border-b border-white/10">
                        <th className="px-3 py-3 text-center font-medium">Data</th>
                        <th className="px-3 py-3 text-center font-medium">Casa</th>
                        <th className="px-3 py-3 text-center font-medium">Valor FB</th>
                        <th className="px-3 py-3 text-center font-medium">Lucro Base</th>
                        <th className="px-3 py-3 text-center font-medium">Ganhou?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingConfirmation.map((item) => (
                        <tr
                          className="border-b border-white/8 align-middle transition hover:bg-white/4"
                          key={item.id}
                        >
                          <td className="px-3 py-4 text-center text-[var(--text-secondary)]">
                            {item.data}
                          </td>
                          <td className="px-3 py-4 text-center font-semibold text-white">
                            {item.casa}
                          </td>
                          <td className="px-3 py-4 text-center text-[var(--text-secondary)]">
                            {formatCurrency(item.valor_fb)}
                          </td>
                          <td
                            className={`px-3 py-4 text-center font-medium ${getProfitClass(item.lucro_real)}`}
                          >
                            {formatCurrency(item.lucro_real)}
                          </td>
                          <td className="px-3 py-4">
                            <div className="flex flex-wrap justify-center gap-2">
                              <form action={updateFreebetResultAction}>
                                <input name="procedureId" type="hidden" value={item.id} />
                                <input name="result" type="hidden" value="Sim" />
                                <input name="returnTo" type="hidden" value="/freebets" />
                                <FormSubmitButton
                                  className="lz-button-primary rounded-full px-4 py-2.5 text-sm font-semibold"
                                  pendingLabel="Salvando..."
                                >
                                  Sim
                                </FormSubmitButton>
                              </form>
                              <form action={updateFreebetResultAction}>
                                <input name="procedureId" type="hidden" value={item.id} />
                                <input name="result" type="hidden" value="Nao" />
                                <input name="returnTo" type="hidden" value="/freebets" />
                                <FormSubmitButton
                                  className="lz-button-secondary rounded-full px-4 py-2.5 text-sm font-semibold"
                                  pendingLabel="Salvando..."
                                >
                                  Nao
                                </FormSubmitButton>
                              </form>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="lz-panel rounded-[30px] p-4 md:p-6">
          {convertedHistory.length === 0 ? (
            <EmptyState
              description="Quando houver conversões concluídas, o histórico vai organizar o desempenho por casa e lucro."
              eyebrow="Ainda sem histórico"
              title="Nenhuma conversão registrada"
            />
          ) : (
            <>
              <div className="grid gap-4 md:hidden">
                {convertedHistory.map((item) => (
                  <article
                    className="rounded-[26px] border border-white/10 bg-white/5 p-4"
                    key={item.texto_data}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-dim)]">
                          {item.texto_data}
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">{item.casa}</p>
                      </div>
                      <StatusTag tone="positive">Concluída</StatusTag>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[22px] border border-white/10 bg-white/4 p-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">
                          Valor FB
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          {formatCurrency(item.valor_freebet)}
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-white/10 bg-white/4 p-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-[var(--text-dim)]">
                          Lucro total
                        </p>
                        <p className={`mt-2 text-lg font-semibold ${getProfitClass(item.lucro_total)}`}>
                          {formatCurrency(item.lucro_total)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 text-sm text-[var(--text-secondary)]">
                      <p>
                        Coleta:{" "}
                        <span className={getProfitClass(item.lucro_coleta)}>
                          {formatCurrency(item.lucro_coleta)}
                        </span>
                      </p>
                      <p>
                        Conversão:{" "}
                        <span className={getProfitClass(item.lucro_conversao ?? 0)}>
                          {formatCurrency(item.lucro_conversao ?? 0)}
                        </span>
                      </p>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <table className="min-w-full text-sm">
                  <thead className="text-[var(--text-dim)]">
                    <tr className="border-b border-white/10">
                      <th className="px-3 py-3 text-center font-medium">Data (Col - Conv)</th>
                      <th className="px-3 py-3 text-center font-medium">Casa</th>
                      <th className="px-3 py-3 text-center font-medium">Valor FB</th>
                      <th className="px-3 py-3 text-center font-medium">Lucro Base</th>
                      <th className="px-3 py-3 text-center font-medium">Lucro Final</th>
                      <th className="px-3 py-3 text-center font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {convertedHistory.map((item) => (
                      <tr
                        className="border-b border-white/8 align-middle transition hover:bg-white/4"
                        key={item.texto_data}
                      >
                        <td className="px-3 py-4 text-center text-[var(--text-secondary)]">
                          {item.texto_data}
                        </td>
                        <td className="px-3 py-4 text-center font-semibold text-white">
                          {item.casa}
                        </td>
                        <td className="px-3 py-4 text-center text-[var(--text-secondary)]">
                          {formatCurrency(item.valor_freebet)}
                        </td>
                        <td className={`px-3 py-4 text-center ${getProfitClass(item.lucro_coleta)}`}>
                          {formatCurrency(item.lucro_coleta)}
                        </td>
                        <td
                          className={`px-3 py-4 text-center ${getProfitClass(item.lucro_conversao ?? 0)}`}
                        >
                          {formatCurrency(item.lucro_conversao ?? 0)}
                        </td>
                        <td
                          className={`px-3 py-4 text-center font-semibold ${getProfitClass(item.lucro_total)}`}
                        >
                          {formatCurrency(item.lucro_total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
