import "server-only";

import { createPostgresPool } from "@/core/server/database/createPostgresPool.js";
import { ProceduresPostgresRepository } from "@/core/server/database/postgresRepository.js";

const REPOSITORY_KEY = "__lzProceduresRepository";
const globalForDb = globalThis;

// Em desenvolvimento o módulo é recarregado a cada edição, mas a instância fica em
// globalThis: se falta algum método da classe atual (ex.: método novo), é recriada.
function isRepositoryCompatible(repository) {
  if (!repository) {
    return false;
  }

  return Object.getOwnPropertyNames(ProceduresPostgresRepository.prototype).every(
    (name) => name === "constructor" || typeof repository[name] === "function",
  );
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
