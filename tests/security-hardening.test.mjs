import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function projectFile(...segments) {
  return path.join(projectRoot, ...segments);
}

test("tenant data tables enforce user/workspace ownership at the database layer", async () => {
  const migration = await readFile(
    projectFile(
      "core",
      "server",
      "database",
      "migrations",
      "009_enforce_workspace_tenant_integrity.sql",
    ),
    "utf8",
  );

  for (const tableName of [
    "procedimentos_historico",
    "usuarios_bancas",
    "usuarios_observacoes_bancas",
  ]) {
    assert.match(
      migration,
      new RegExp(
        [
          `ALTER\\s+TABLE\\s+${tableName}`,
          "ADD\\s+CONSTRAINT",
          "FOREIGN\\s+KEY\\s*\\(\\s*user_id\\s*,\\s*base_id\\s*\\)",
          "REFERENCES\\s+bases_usuario\\s*\\(\\s*user_id\\s*,\\s*id\\s*\\)",
        ].join("[\\s\\S]+"),
        "iu",
      ),
      `${tableName} must be tied to the owning bases_usuario row by both user_id and base_id.`,
    );
  }
});

test("bookmaker notes upsert never updates a row owned by a different user", async () => {
  const repositorySource = await readFile(
    projectFile("core", "server", "database", "postgresRepository.js"),
    "utf8",
  );

  assert.match(
    repositorySource,
    /ON\s+CONFLICT\s*\(\s*base_id\s*\)\s*DO\s+UPDATE\s+SET\s+texto\s*=\s*EXCLUDED\.texto\s+WHERE\s+usuarios_observacoes_bancas\.user_id\s*=\s*EXCLUDED\.user_id/iu,
  );
});
