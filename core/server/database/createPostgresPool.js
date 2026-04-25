import "server-only";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const DATABASE_RUNTIME_URL_ENV = "DATABASE_URL";

export function createPostgresPool({
  connectionString = process.env[DATABASE_RUNTIME_URL_ENV],
  ssl,
  max = 10,
  idleTimeoutMillis = 30_000,
} = {}) {
  if (!connectionString) {
    throw new Error(
      'Defina a variavel de ambiente "DATABASE_URL" para o runtime do PostgreSQL.',
    );
  }

  let Pool;

  try {
    ({ Pool } = require("pg"));
  } catch {
    throw new Error(
      'Instale a dependencia "pg" antes de usar o repositorio PostgreSQL.',
    );
  }

  return new Pool({
    connectionString,
    ssl,
    max,
    idleTimeoutMillis,
  });
}
