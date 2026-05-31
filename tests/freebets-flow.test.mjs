import assert from "node:assert/strict";
import test from "node:test";

import {
  buildConvertedFreebetsHistory,
  collectionFinishedWithoutFreebet,
  groupActiveFreebets,
} from "../core/domain/freebets/freebets.service.js";

function buildFreebet(overrides = {}) {
  return {
    id: 1,
    data_operacao: "2026-05-29",
    tipo_procedimento: "Coletar Freebet",
    status_freebet: "Pendente",
    status_procedimento: "Pendente",
    casa_destino_freebet: "10Game",
    valor_da_freebet: 10,
    lucro_final: 0,
    ganhou_freebet: "Sim",
    condicao_freebet: "Freebet Garantida",
    entradas: [
      {
        escopo: "freebet_collection",
        tipo_entrada: "principal",
        resultado_chave: "principal",
        valor: 10,
        odd: 0,
      },
      {
        escopo: "freebet_conversion",
        tipo_entrada: "principal",
        resultado_chave: "principal",
        valor: 10,
        odd: 0,
      },
    ],
    resultados: [],
    ...overrides,
  };
}

test("scoped freebets wait for an explicit collection result", () => {
  const grouped = groupActiveFreebets([buildFreebet()]);

  assert.equal(grouped.agrupadas_convertiveis.length, 0);
  assert.equal(grouped.pendentes_confirmacao.length, 1);
  assert.equal(grouped.pendentes_confirmacao[0].acao, "resultado_coleta");
});

test("freebets wait for collection result regardless of condition", () => {
  const grouped = groupActiveFreebets([
    buildFreebet({
      condicao_freebet: "Apenas se perder a aposta",
      entradas: [],
      ganhou_freebet: "Sim",
    }),
  ]);

  assert.equal(grouped.agrupadas_convertiveis.length, 0);
  assert.equal(grouped.pendentes_confirmacao.length, 1);
  assert.equal(grouped.pendentes_confirmacao[0].acao, "resultado_coleta");
});

test("scoped freebets become convertible after collection result is selected", () => {
  const grouped = groupActiveFreebets([
    buildFreebet({
      resultados: [{ escopo: "freebet_collection", resultado_chave: "principal" }],
    }),
  ]);

  assert.equal(grouped.pendentes_confirmacao.length, 0);
  assert.equal(grouped.agrupadas_convertiveis.length, 1);
  assert.equal(grouped.agrupadas_convertiveis[0].casa, "10Game");
});

test("loss-only freebets finish without conversion when principal wins", () => {
  const freebet = buildFreebet({
    condicao_freebet: "Apenas se perder a aposta",
    resultados: [{ escopo: "freebet_collection", resultado_chave: "principal" }],
  });
  const grouped = groupActiveFreebets([freebet]);

  assert.equal(grouped.pendentes_confirmacao.length, 0);
  assert.equal(grouped.agrupadas_convertiveis.length, 0);
  assert.equal(collectionFinishedWithoutFreebet(freebet), true);
});

test("loss-only principal wins are represented in history without conversion", () => {
  const procedure = buildFreebet({
    status_freebet: "Finalizada",
    ganhou_freebet: "Não",
    condicao_freebet: "Apenas se perder a aposta",
    resultados: [{ escopo: "freebet_collection", resultado_chave: "principal" }],
  });
  const history = buildConvertedFreebetsHistory([
    {
      data_coleta: "30/05/2026",
      data_conversao: "",
      casa: "10Game",
      valor_freebet: 10,
      lucro_base_coleta: 0,
      lucro_base_conversao: 0,
      status_freebet: "Finalizada",
      ganhou_freebet: "Não",
      procedimento: procedure,
    },
  ]);

  assert.equal(history.length, 1);
  assert.equal(history[0].lucro_conversao, null);
  assert.equal(history[0].texto_data, "30/05/2026 -> Não ganhou");
});

test("freebets with started conversion wait for conversion result", () => {
  const grouped = groupActiveFreebets([
    buildFreebet({
      lote_conversao_freebet: "batch-1",
      jogo_conversao_freebet: "conversao teste",
      entradas: [
        {
          escopo: "freebet_collection",
          tipo_entrada: "principal",
          resultado_chave: "principal",
          valor: 10,
          odd: 0,
        },
        {
          escopo: "freebet_conversion",
          tipo_entrada: "principal",
          resultado_chave: "principal",
          casa: "22Bet",
          valor: 10,
          odd: 2,
        },
      ],
      resultados: [{ escopo: "freebet_collection", resultado_chave: "principal" }],
    }),
  ]);

  assert.equal(grouped.agrupadas_convertiveis.length, 0);
  assert.equal(grouped.pendentes_confirmacao.length, 1);
  assert.equal(grouped.pendentes_confirmacao[0].acao, "resultado_conversao");
  assert.equal(
    grouped.pendentes_confirmacao[0].procedimento.lote_conversao_freebet,
    "batch-1",
  );
  assert.equal(
    grouped.pendentes_confirmacao[0].procedimento.jogo_conversao_freebet,
    "conversao teste",
  );
});

test("conversion-only freebets skip collection and wait for conversion result", () => {
  const grouped = groupActiveFreebets([
    buildFreebet({
      condicao_freebet: "Converter freebet apenas",
      entradas: [
        {
          escopo: "freebet_conversion",
          tipo_entrada: "principal",
          resultado_chave: "principal",
          valor: 10,
          odd: 2,
        },
      ],
      resultados: [],
    }),
  ]);

  assert.equal(grouped.agrupadas_convertiveis.length, 0);
  assert.equal(grouped.pendentes_confirmacao.length, 1);
  assert.equal(grouped.pendentes_confirmacao[0].fase, "conversao");
  assert.equal(grouped.pendentes_confirmacao[0].acao, "resultado_conversao");
});

test("conversion-only history does not duplicate collection profit", () => {
  const procedure = buildFreebet({
    condicao_freebet: "Converter freebet apenas",
    resultados: [{ escopo: "freebet_conversion", resultado_chave: "principal" }],
  });
  const history = buildConvertedFreebetsHistory([
    {
      data_coleta: "",
      data_conversao: "30/05/2026",
      casa: "10Game",
      valor_freebet: 10,
      lucro_base_coleta: 999,
      lucro_base_conversao: 20,
      status_freebet: "Finalizada",
      ganhou_freebet: "Sim",
      procedimento_id: procedure.id,
      condicao_freebet: "Converter freebet apenas",
      procedimento: procedure,
    },
  ]);

  assert.equal(history.length, 1);
  assert.equal(history[0].lucro_coleta, 0);
  assert.equal(history[0].lucro_conversao, 20);
  assert.equal(history[0].lucro_total, 20);
  assert.equal(history[0].texto_data, "- -> 30/05/2026");
});

test("converted freebet history keeps the editable procedure payload", () => {
  const procedure = buildFreebet({
    status_freebet: "Finalizada",
    resultados: [
      { escopo: "freebet_collection", resultado_chave: "protection-0" },
      { escopo: "freebet_conversion", resultado_chave: "principal" },
    ],
  });
  const history = buildConvertedFreebetsHistory([
    {
      data_coleta: "29/05/2026",
      data_conversao: "30/05/2026",
      casa: "10Game",
      valor_freebet: 10,
      lucro_base_coleta: 2,
      lucro_base_conversao: 5,
      status_freebet: "Finalizada",
      ganhou_freebet: "Sim",
      procedimento_id: procedure.id,
      procedimento: procedure,
    },
  ]);

  assert.equal(history.length, 1);
  assert.equal(history[0].lucro_coleta, 2);
  assert.equal(history[0].lucro_conversao, 5);
  assert.equal(history[0].procedimento_id, procedure.id);
  assert.equal(history[0].procedimento.id, procedure.id);
});
