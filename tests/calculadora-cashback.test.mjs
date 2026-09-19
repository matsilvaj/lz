import assert from "node:assert/strict";
import test from "node:test";

import { calculateSurebet } from "../core/domain/calculadora/calculadora.service.js";

function round(value) {
  return Math.round(value * 100) / 100;
}

// Cenario de referencia conferido a mao: casa 1 com odd 2, stake 100 e cashback
// de 10%; casa 2 com odd 2 e sem promocao.
function buildLines(cashbackLossOnly) {
  const cashbackLine = {
    odd: 2,
    stake: 100,
    tipo: "B",
    cashback_percentual: 10,
  };

  if (cashbackLossOnly !== undefined) {
    cashbackLine.cashback_apenas_perda = cashbackLossOnly;
  }

  return [cashbackLine, { odd: 2, stake: 0, tipo: "B" }];
}

test("cashback pago apenas na derrota fica fora da divisao dos stakes", () => {
  const withCashback = calculateSurebet(buildLines(true), 0);
  const withoutCashback = calculateSurebet(
    [
      { odd: 2, stake: 100, tipo: "B" },
      { odd: 2, stake: 0, tipo: "B" },
    ],
    0,
  );

  // O stake da casa 2 nao pode encolher por causa de uma promocao que some
  // justamente quando a casa 1 ganha.
  assert.deepEqual(
    withCashback.linhas.map((line) => round(line.stake)),
    withoutCashback.linhas.map((line) => round(line.stake)),
  );

  // Casa 1 ganha: recebe 200 contra 200 apostados, sem cashback nenhum.
  // Casa 2 ganha: recebe 200 mais os 10 de cashback da casa 1 que perdeu.
  assert.equal(round(withCashback.linhas[0].lucro_liquido), 0);
  assert.equal(round(withCashback.linhas[1].lucro_liquido), 10);
});

test("cashback pago em qualquer resultado vale tambem quando a propria casa ganha", () => {
  const result = calculateSurebet(buildLines(false), 0);

  assert.equal(round(result.linhas[0].lucro_liquido), 10);
  assert.equal(round(result.linhas[1].lucro_liquido), 10);
});

test("linha sem o campo cai no padrao de cashback pago em qualquer resultado", () => {
  const semCampo = calculateSurebet(buildLines(undefined), 0);
  const pagaSempre = calculateSurebet(buildLines(false), 0);

  assert.deepEqual(
    semCampo.linhas.map((line) => round(line.lucro_liquido)),
    pagaSempre.linhas.map((line) => round(line.lucro_liquido)),
  );
});

test("lucro de referencia usa o pior cenario quando o cashback so vale na derrota", () => {
  const result = calculateSurebet(buildLines(true), 0);

  // O cenario em que a casa promocional ganha nao pode ser vendido como lucro.
  assert.equal(round(result.lucro_liquido), 0);
  assert.equal(round(result.lucro_percentual), 0);
});

test("cashback de lay so entra no cenario em que a propria linha perde", () => {
  const lossOnly = calculateSurebet(
    [
      { odd: 2, stake: 100, tipo: "L", cashback_percentual: 10, cashback_apenas_perda: true },
      { odd: 2, stake: 0, tipo: "B" },
    ],
    0,
  );
  const always = calculateSurebet(
    [
      { odd: 2, stake: 100, tipo: "L", cashback_percentual: 10, cashback_apenas_perda: false },
      { odd: 2, stake: 0, tipo: "B" },
    ],
    0,
  );

  // O lay ganhando nao recebe o proprio cashback no regime "apenas se perder",
  // e recebe quando a casa paga de qualquer jeito.
  assert.equal(
    round(always.linhas[0].lucro_liquido - lossOnly.linhas[0].lucro_liquido),
    10,
  );
  // O cenario da outra casa recebe o credito nos dois regimes.
  assert.equal(round(always.linhas[1].lucro_liquido), round(lossOnly.linhas[1].lucro_liquido));
});

test("cashback nao altera o rateio quando as duas casas oferecem a promocao na derrota", () => {
  const result = calculateSurebet(
    [
      {
        odd: 2,
        stake: 100,
        tipo: "B",
        cashback_percentual: 10,
        cashback_apenas_perda: true,
      },
      {
        odd: 2,
        stake: 0,
        tipo: "B",
        cashback_percentual: 10,
        cashback_apenas_perda: true,
      },
    ],
    0,
  );

  // Cada cenario recebe apenas o cashback da casa que perdeu: 10 dos dois lados.
  assert.deepEqual(
    result.linhas.map((line) => round(line.stake)),
    [100, 100],
  );
  assert.deepEqual(
    result.linhas.map((line) => round(line.lucro_liquido)),
    [10, 10],
  );
});

test("odd ajustada aplica o aumento só sobre o lucro e é a mesma em todo o projeto", async () => {
  const { calculateAdjustedOdd } = await import("../core/domain/shared/odds.js");

  assert.equal(calculateAdjustedOdd(2, 0), 2);
  assert.equal(calculateAdjustedOdd(2, 10), 2.1);
  assert.equal(calculateAdjustedOdd(3.5, 20), 4);
  assert.equal(calculateAdjustedOdd(1, 50), 1);
  assert.equal(calculateAdjustedOdd(0.8, 50), 0.8);
});

test("tipo de procedimento digitado só aceita texto simples e até 60 caracteres", async () => {
  const { normalizeProcedureType, sanitizeProcedureTypeInput, PROCEDURE_TYPES } = await import(
    "../core/domain/shared/index.js"
  );

  for (const type of PROCEDURE_TYPES) {
    assert.equal(normalizeProcedureType(type), type);
  }

  assert.equal(normalizeProcedureType("  Reembolso   de   bônus "), "Reembolso de bônus");
  assert.equal(normalizeProcedureType('<script>alert("x")</script>'), "scriptalert(x)/script");
  assert.equal(normalizeProcedureType("Missão\u0000\n semanal"), "Missão semanal");
  assert.equal(normalizeProcedureType("=CMD|'/c calc'!A0"), "CMD'/c calc'A0");
  assert.equal(normalizeProcedureType("a".repeat(100)).length, 60);
  assert.equal(normalizeProcedureType("   "), "");
  // Enquanto digita, o espaço no fim é mantido para a próxima palavra.
  assert.equal(sanitizeProcedureTypeInput("Missão "), "Missão ");
});

test("nome de parceiro só aceita texto simples e até 60 caracteres", async () => {
  const { normalizePartnerName } = await import("../core/domain/shared/index.js");

  assert.equal(normalizePartnerName("  Maria   Silva "), "Maria Silva");
  assert.equal(normalizePartnerName("João D'Ávila"), "João D'Ávila");
  assert.equal(normalizePartnerName('<img src=x onerror="a()">'), "img srcx onerrora()");
  assert.equal(normalizePartnerName("=HYPERLINK(1)"), "HYPERLINK(1)");
  assert.equal(normalizePartnerName("Ana\u0000\nPaula"), "Ana Paula");
  assert.equal(normalizePartnerName("x".repeat(80)).length, 60);
  assert.equal(normalizePartnerName(" "), "");
});
