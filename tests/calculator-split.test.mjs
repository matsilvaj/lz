import assert from "node:assert/strict";
import test from "node:test";

import { calculateSurebet } from "../core/domain/calculadora/calculadora.service.js";

function round(value) {
  return Math.round(value * 100) / 100;
}

test("surebet without child lines keeps the original result", () => {
  const result = calculateSurebet([
    { odd: 2, stake: 100 },
    { odd: 2.5, stake: 0 },
  ]);

  assert.equal(result.linhas[1].stake, 80);
  assert.equal(round(result.lucro_liquido), 20);
});

test("child line completes the protection when its odd changed", () => {
  const result = calculateSurebet([
    { odd: 2, stake: 100 },
    { odd: 2.5, stake: 40, filhas: [{ odd: 2.4, stake: 0 }] },
  ]);

  const protection = result.linhas[1];

  assert.equal(protection.stake, 40);
  assert.equal(protection.filhas[0].stake, 41.67);
  assert.equal(round(result.linhas[0].lucro_liquido), 18.33);
  assert.equal(round(result.lucro_liquido), 18.33);
});

test("base child stake is always typed and adds to the target return", () => {
  const result = calculateSurebet([
    { odd: 2, stake: 50, filhas: [{ odd: 1.9, stake: 50 }] },
    { odd: 2.5, stake: 0 },
  ]);

  assert.equal(result.linhas[0].retorno_grupo, 195);
  assert.equal(result.linhas[1].stake, 78);
});

test("percentage profit target keeps the base at a share of the other profit", () => {
  const result = calculateSurebet([
    { odd: 2, stake: 100, lucro_alvo: { modo: "percentual", valor: 50 } },
    { odd: 2.5, stake: 0 },
  ]);

  assert.equal(result.linhas[1].stake, 85.71);
  assert.equal(round(result.linhas[0].lucro_liquido), 14.29);
  assert.ok(Math.abs(result.linhas[1].lucro_liquido - 28.56) <= 0.01);
});

test("fixed and zero profit targets set the exact profit of that house", () => {
  const fixed = calculateSurebet([
    { odd: 2, stake: 100 },
    { odd: 2.5, stake: 0, lucro_alvo: { modo: "valor", valor: 10 } },
  ]);
  const zero = calculateSurebet([
    { odd: 2, stake: 100 },
    { odd: 2.5, stake: 0, lucro_alvo: { modo: "zerar" } },
  ]);

  assert.equal(round(fixed.linhas[1].lucro_liquido), 10);
  assert.equal(round(zero.linhas[1].lucro_liquido), 0);
  assert.ok(zero.linhas[0].lucro_liquido > 20);
});

test("normal profit target matches the original surebet", () => {
  const result = calculateSurebet([
    { odd: 2, stake: 100, lucro_alvo: { modo: "normal" } },
    { odd: 2.5, stake: 0, lucro_alvo: { modo: "percentual", valor: 100 } },
  ]);

  assert.equal(result.linhas[1].stake, 80);
  assert.equal(round(result.lucro_liquido), 20);
});

test("child lines are limited to five per house", () => {
  const result = calculateSurebet([
    { odd: 2, stake: 100 },
    {
      odd: 2.5,
      stake: 10,
      filhas: Array.from({ length: 7 }, () => ({ odd: 2.5, stake: 10 })),
    },
  ]);

  assert.equal(result.linhas[1].filhas.length, 5);
});
