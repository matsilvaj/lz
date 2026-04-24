import "server-only";

import { DB_NAME } from "@/core";
import { ProceduresSqliteRepository, createBetterSqliteDb } from "@/core/server";

let defaultRepository = null;

export function createProceduresRepository({
  dbPath = DB_NAME,
  dbOptions = {},
} = {}) {
  const db = createBetterSqliteDb(dbPath, dbOptions);
  const repository = new ProceduresSqliteRepository(db);

  repository.initialize();

  return repository;
}

export function getProceduresRepository() {
  if (!defaultRepository) {
    defaultRepository = createProceduresRepository();
  }

  return defaultRepository;
}

export function resetProceduresRepository() {
  defaultRepository = null;
}
