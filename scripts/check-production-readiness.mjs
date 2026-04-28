import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

await loadEnvironmentFiles([
  path.join(projectRoot, ".env"),
  path.join(projectRoot, ".env.local"),
]);

const errors = [];
const warnings = [];

for (const key of [
  "DATABASE_URL",
  "DATABASE_MIGRATION_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_APP_URL",
]) {
  requireEnv(key);
}

checkAppUrl();
checkDatabaseUrl();
checkUpstash();
checkSupabaseAdminKey();

console.log("Production readiness check");

if (errors.length === 0 && warnings.length === 0) {
  console.log("OK - no local issues found.");
}

for (const error of errors) {
  console.error(`ERROR - ${error}`);
}

for (const warning of warnings) {
  console.warn(`WARN - ${warning}`);
}

process.exitCode = errors.length > 0 ? 1 : 0;

function requireEnv(key) {
  if (!process.env[key]?.trim()) {
    errors.push(`Missing ${key}.`);
  }
}

function checkAppUrl() {
  const value = process.env.NEXT_PUBLIC_APP_URL?.trim();

  if (!value) {
    return;
  }

  let url;

  try {
    url = new URL(value);
  } catch {
    errors.push("NEXT_PUBLIC_APP_URL must be a valid URL.");
    return;
  }

  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);

  if (isLocalhost) {
    warnings.push(
      "NEXT_PUBLIC_APP_URL is local. Keep this for development, but set the Vercel production value to your https:// domain.",
    );
    return;
  }

  if (url.protocol !== "https:") {
    errors.push("NEXT_PUBLIC_APP_URL must use https outside local development.");
  }
}

function checkDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim();

  if (!value) {
    return;
  }

  let url;

  try {
    url = new URL(value);
  } catch {
    errors.push("DATABASE_URL must be a valid Postgres URL.");
    return;
  }

  const username = decodeURIComponent(url.username);

  if (/^postgres(?:\.|$)/iu.test(username)) {
    warnings.push(
      "DATABASE_URL appears to use the postgres/admin Supabase role. For launch, create a lower-privilege runtime role and keep DATABASE_MIGRATION_URL for migrations only.",
    );
  }
}

function checkUpstash() {
  const hasUpstashUrl =
    Boolean(process.env.UPSTASH_REDIS_REST_URL?.trim()) ||
    Boolean(process.env.KV_REST_API_URL?.trim());
  const hasUpstashToken =
    Boolean(process.env.UPSTASH_REDIS_REST_TOKEN?.trim()) ||
    Boolean(process.env.KV_REST_API_TOKEN?.trim());

  if (hasUpstashUrl !== hasUpstashToken) {
    errors.push("Configure both Upstash Redis URL and token, not just one.");
    return;
  }

  if (!hasUpstashUrl) {
    warnings.push(
      "Upstash Redis is not configured. Rate limit will work locally, but Vercel production should use Redis so all serverless instances share the same counters.",
    );
  }
}

function checkSupabaseAdminKey() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    warnings.push(
      "SUPABASE_SERVICE_ROLE_KEY is missing. Account deletion/admin-only flows that require Supabase Admin API will not work in production.",
    );
  }
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
