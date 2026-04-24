import "server-only";
import { createRequire } from "node:module";
import { DB_NAME } from "../../domain/shared/constants.js";

const require = createRequire(import.meta.url);

export function createBetterSqliteDb(dbPath = DB_NAME, options = {}) {
  let BetterSqlite3;

  try {
    BetterSqlite3 = require("better-sqlite3");
  } catch {
    throw new Error(
      'Instale a dependencia "better-sqlite3" antes de usar o repositorio SQLite.',
    );
  }

  return new BetterSqlite3(dbPath, {
    fileMustExist: false,
    ...options,
  });
}
