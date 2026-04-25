import "server-only";

import { ProceduresPostgresRepository, createPostgresPool } from "@/core/server";

let defaultRepository = null;

export function createProceduresRepository({
  poolOptions = {},
} = {}) {
  const db = createPostgresPool(poolOptions);
  return new ProceduresPostgresRepository(db);
}

export function getProceduresRepository() {
  if (!defaultRepository) {
    defaultRepository = createProceduresRepository();
  }

  return defaultRepository;
}

export function resetProceduresRepository() {
  if (defaultRepository) {
    void defaultRepository.close();
  }

  defaultRepository = null;
}

export async function closeProceduresRepository() {
  if (!defaultRepository) {
    return;
  }

  await defaultRepository.close();
  defaultRepository = null;
}
