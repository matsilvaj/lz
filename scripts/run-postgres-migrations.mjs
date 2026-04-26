import { createRequire } from "node:module";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const DATABASE_MIGRATION_URL_ENV = "DATABASE_MIGRATION_URL";
const DATABASE_RUNTIME_URL_ENV = "DATABASE_URL";

let Pool;

try {
  ({ Pool } = require("pg"));
} catch {
  console.error('Instale a dependência "pg" antes de rodar as migrations.');
  process.exit(1);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const migrationsDir = path.resolve(__dirname, "../core/server/database/migrations");

await loadEnvironmentFiles([
  path.join(projectRoot, ".env"),
  path.join(projectRoot, ".env.local"),
]);

const connectionString =
  process.env[DATABASE_MIGRATION_URL_ENV] ?? process.env[DATABASE_RUNTIME_URL_ENV];

if (!connectionString) {
  console.error(
    'Defina "DATABASE_MIGRATION_URL" ou "DATABASE_URL" antes de rodar as migrations.',
  );
  process.exit(1);
}

const pool = new Pool({ connectionString });
const client = await pool.connect();

try {
  const migrationFiles = (await fs.readdir(migrationsDir))
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort((left, right) => left.localeCompare(right));

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const appliedResult = await client.query(
    "SELECT id FROM schema_migrations ORDER BY id ASC",
  );
  const applied = new Set(appliedResult.rows.map((row) => row.id));

  for (const fileName of migrationFiles) {
    if (applied.has(fileName)) {
      console.log(`skip ${fileName}`);
      continue;
    }

    const sql = await fs.readFile(path.join(migrationsDir, fileName), "utf8");

    await client.query("BEGIN");

    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [
        fileName,
      ]);
      await client.query("COMMIT");
      console.log(`applied ${fileName}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  client.release();
  await pool.end();
}

async function loadEnvironmentFiles(filePaths) {
  for (const filePath of filePaths) {
    let fileContents;

    try {
      fileContents = await fs.readFile(filePath, "utf8");
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        continue;
      }

      throw error;
    }

    for (const rawLine of fileContents.split(/\r?\n/u)) {
      const line = rawLine.trim();

      if (!line || line.startsWith("#")) {
        continue;
      }

      const separatorIndex = line.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      if (!key || process.env[key] !== undefined) {
        continue;
      }

      let value = line.slice(separatorIndex + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      process.env[key] = value;
    }
  }
}
