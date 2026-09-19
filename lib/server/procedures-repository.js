import "server-only";

import { createPostgresPool } from "@/core/server/database/createPostgresPool.js";
import { ProceduresPostgresRepository } from "@/core/server/database/postgresRepository.js";

const REPOSITORY_KEY = "__lzProceduresRepository";
const IS_DEVELOPMENT = process.env.NODE_ENV !== "production";
const globalForDb = globalThis;

// Em desenvolvimento o módulo é recarregado a cada edição e o Next compila o mesmo
// arquivo em mais de uma camada (páginas, ações…), com textos ligeiramente diferentes.
// Cada versão do código ganha a própria instância, guardada pela assinatura, e nenhuma
// fecha a conexão de outra. Em produção o código não muda: uma instância só.
function getRepositorySignature() {
  const source = Object.getOwnPropertyNames(ProceduresPostgresRepository.prototype)
    .map((name) => `${name}:${String(ProceduresPostgresRepository.prototype[name])}`)
    .join("|");
  let hash = 5381;

  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) + hash + source.charCodeAt(index)) | 0;
  }

  return `${source.length}:${hash}`;
}

const REPOSITORY_INSTANCE_KEY = IS_DEVELOPMENT
  ? `${REPOSITORY_KEY}:${getRepositorySignature()}`
  : REPOSITORY_KEY;

export function createProceduresRepository({
  poolOptions = {},
} = {}) {
  const db = createPostgresPool(poolOptions);
  return new ProceduresPostgresRepository(db);
}

export function getProceduresRepository() {
  if (!globalForDb[REPOSITORY_INSTANCE_KEY]) {
    globalForDb[REPOSITORY_INSTANCE_KEY] = createProceduresRepository();
  }

  return globalForDb[REPOSITORY_INSTANCE_KEY];
}

export function resetProceduresRepository() {
  if (globalForDb[REPOSITORY_INSTANCE_KEY]) {
    void globalForDb[REPOSITORY_INSTANCE_KEY].close();
  }

  globalForDb[REPOSITORY_INSTANCE_KEY] = null;
}

export async function closeProceduresRepository() {
  if (!globalForDb[REPOSITORY_INSTANCE_KEY]) {
    return;
  }

  await globalForDb[REPOSITORY_INSTANCE_KEY].close();
  globalForDb[REPOSITORY_INSTANCE_KEY] = null;
}
