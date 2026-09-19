import "server-only";

import { createPostgresPool } from "@/core/server/database/createPostgresPool.js";
import { ProceduresPostgresRepository } from "@/core/server/database/postgresRepository.js";

const REPOSITORY_KEY = "__lzProceduresRepository";
const globalForDb = globalThis;

// Assinatura do código atual da classe (calculada uma vez por carga do módulo).
// Em desenvolvimento o módulo é recarregado a cada edição, mas a instância fica em
// globalThis: se ela veio de outra versão do código (método novo ou alterado), é recriada.
const REPOSITORY_SIGNATURE = (() => {
  const source = Object.getOwnPropertyNames(ProceduresPostgresRepository.prototype)
    .map((name) => `${name}:${String(ProceduresPostgresRepository.prototype[name])}`)
    .join("|");
  let hash = 5381;

  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) + hash + source.charCodeAt(index)) | 0;
  }

  return `${source.length}:${hash}`;
})();

function isRepositoryCompatible(repository) {
  return Boolean(repository) && repository.__lzSignature === REPOSITORY_SIGNATURE;
}

export function createProceduresRepository({
  poolOptions = {},
} = {}) {
  const db = createPostgresPool(poolOptions);
  return new ProceduresPostgresRepository(db);
}

export function getProceduresRepository() {
  if (!isRepositoryCompatible(globalForDb[REPOSITORY_KEY])) {
    if (globalForDb[REPOSITORY_KEY] && typeof globalForDb[REPOSITORY_KEY].close === "function") {
      void globalForDb[REPOSITORY_KEY].close();
    }

    globalForDb[REPOSITORY_KEY] = createProceduresRepository();
    globalForDb[REPOSITORY_KEY].__lzSignature = REPOSITORY_SIGNATURE;
  }

  return globalForDb[REPOSITORY_KEY];
}

export function resetProceduresRepository() {
  if (globalForDb[REPOSITORY_KEY]) {
    void globalForDb[REPOSITORY_KEY].close();
  }

  globalForDb[REPOSITORY_KEY] = null;
}

export async function closeProceduresRepository() {
  if (!globalForDb[REPOSITORY_KEY]) {
    return;
  }

  await globalForDb[REPOSITORY_KEY].close();
  globalForDb[REPOSITORY_KEY] = null;
}
