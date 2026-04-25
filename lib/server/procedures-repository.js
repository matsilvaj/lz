import "server-only";

import { ProceduresPostgresRepository, createPostgresPool } from "@/core/server";

const REPOSITORY_KEY = "__lzProceduresRepository";
const globalForDb = globalThis;

export function createProceduresRepository({
  poolOptions = {},
} = {}) {
  const db = createPostgresPool(poolOptions);
  return new ProceduresPostgresRepository(db);
}

export function getProceduresRepository() {
  if (!globalForDb[REPOSITORY_KEY]) {
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
