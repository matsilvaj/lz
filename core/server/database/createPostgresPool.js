import "server-only";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const DATABASE_RUNTIME_URL_ENV = "DATABASE_URL";
let warnedAboutSupabasePooler = false;

function isSupabaseHost(hostname) {
  return /\.supabase\.(co|com)$/iu.test(hostname) || hostname.includes("pooler.supabase.com");
}

function assertSupabasePoolerUrl(connectionString) {
  let url;

  try {
    url = new URL(connectionString);
  } catch {
    return;
  }

  if (!isSupabaseHost(url.hostname) || url.port === "6543") {
    return;
  }

  const message =
    "DATABASE_URL parece apontar para o PostgreSQL direto do Supabase. " +
    "Use a URL do Connection Pooler em modo transaction, na porta 6543, para runtime serverless.";

  if (process.env.NODE_ENV === "production") {
    throw new Error(message);
  }

  if (!warnedAboutSupabasePooler) {
    console.warn(`WARN - ${message}`);
    warnedAboutSupabasePooler = true;
  }
}

function parsePoolMax(value) {
  const parsed = Number(value ?? 3);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 3;
}

function parsePositiveInteger(value, defaultValue) {
  const parsed = Number(value ?? defaultValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
}

export function createPostgresPool({
  connectionString = process.env[DATABASE_RUNTIME_URL_ENV],
  ssl,
  max = parsePoolMax(process.env.POSTGRES_POOL_MAX),
  idleTimeoutMillis = 10_000,
  connectionTimeoutMillis = 5_000,
  statementTimeoutMillis = process.env.POSTGRES_STATEMENT_TIMEOUT_MS,
  queryTimeoutMillis = process.env.POSTGRES_QUERY_TIMEOUT_MS,
  allowExitOnIdle = true,
} = {}) {
  if (!connectionString) {
    throw new Error(
      'Defina a variável de ambiente "DATABASE_URL" para o runtime do PostgreSQL.',
    );
  }

  assertSupabasePoolerUrl(connectionString);

  let Pool;

  try {
    ({ Pool } = require("pg"));
  } catch {
    throw new Error(
      'Instale a dependência "pg" antes de usar o repositório PostgreSQL.',
    );
  }

  const resolvedStatementTimeoutMillis = parsePositiveInteger(
    statementTimeoutMillis,
    8_000,
  );
  const resolvedQueryTimeoutMillis = parsePositiveInteger(
    queryTimeoutMillis,
    Math.max(resolvedStatementTimeoutMillis + 1_000, 10_000),
  );

  return new Pool({
    application_name: process.env.POSTGRES_APPLICATION_NAME?.trim() || "lz-runtime",
    connectionString,
    ssl,
    max,
    idleTimeoutMillis,
    connectionTimeoutMillis,
    statement_timeout: resolvedStatementTimeoutMillis,
    query_timeout: resolvedQueryTimeoutMillis,
    allowExitOnIdle,
  });
}
