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
