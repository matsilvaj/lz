import assert from "node:assert/strict";
import test from "node:test";

import {
  createBookmakerResolver,
  getBookmakerKey,
} from "../core/domain/shared/bookmaker-name.js";

const catalog = ["Aposta Bet", "Bet7k", "Bolsa de Aposta", "Jogo de Ouro", "Mc Games"];

test("chave ignora maiúsculas, acentos, espaços e pontuação", () => {
  assert.equal(getBookmakerKey("Aposta Bet"), getBookmakerKey("apostabet"));
  assert.equal(getBookmakerKey("Mc-Games"), getBookmakerKey("McGames"));
  assert.equal(getBookmakerKey("Jogo de ouro"), getBookmakerKey("JOGO DE OURO"));
  assert.equal(getBookmakerKey("Estrelá Bet"), "estrelabet");
});

test("apelidos de casas unificadas", () => {
  assert.equal(getBookmakerKey("7k Bet"), getBookmakerKey("Bet7k"));
  assert.equal(getBookmakerKey("Bolsa de Apostas"), getBookmakerKey("Bolsa de Aposta"));
});

test("resolve para o nome do catálogo", () => {
  const resolve = createBookmakerResolver(catalog);

  assert.equal(resolve("Apostabet"), "Aposta Bet");
  assert.equal(resolve("7k Bet"), "Bet7k");
  assert.equal(resolve("Bolsa de Apostas"), "Bolsa de Aposta");
  assert.equal(resolve("McGames"), "Mc Games");
  assert.equal(resolve("jogo de ouro"), "Jogo de Ouro");
  assert.equal(resolve("Casa Inexistente"), "");
  assert.equal(resolve(""), "");
  assert.equal(resolve(null), "");
});
