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

test("procedure status migration is additive and queryable", async () => {
  const migration = await readFile(
    projectFile(
      "core",
      "server",
      "database",
      "migrations",
      "010_procedure_status_filter.sql",
    ),
    "utf8",
  );
  const repositorySource = await readFile(
    projectFile("core", "server", "database", "postgresRepository.js"),
    "utf8",
  );

  assert.match(
    migration,
    /ALTER\s+TABLE\s+procedimentos_historico\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+status_procedimento\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'Concluído'/iu,
  );
  assert.match(
    migration,
    /CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+procedimentos_historico_user_base_status_procedimento_idx/iu,
  );
  assert.equal(/DROP\s+COLUMN|DROP\s+TABLE|TRUNCATE|DELETE\s+FROM/iu.test(migration), false);
  assert.match(repositorySource, /status_procedimento\s*=\s*ANY\(/u);
});

test("procedure entry details migration is additive and tenant scoped", async () => {
  const migration = await readFile(
    projectFile(
      "core",
      "server",
      "database",
      "migrations",
      "011_procedure_entry_details.sql",
    ),
    "utf8",
  );
  const repositorySource = await readFile(
    projectFile("core", "server", "database", "postgresRepository.js"),
    "utf8",
  );

  assert.match(migration, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+procedimentos_entradas/iu);
  assert.match(migration, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+procedimentos_resultados/iu);
  assert.match(
    migration,
    /FOREIGN\s+KEY\s*\(\s*user_id\s*,\s*base_id\s*\)\s+REFERENCES\s+bases_usuario\s*\(\s*user_id\s*,\s*id\s*\)/iu,
  );
  assert.equal(/DROP\s+COLUMN|DROP\s+TABLE|TRUNCATE|DELETE\s+FROM/iu.test(migration), false);
  assert.match(repositorySource, /replaceProcedureDetails/u);
  assert.match(repositorySource, /procedure_balances/u);
});

test("procedure result details require an explicit selected outcome", async () => {
  const repositorySource = await readFile(
    projectFile("core", "server", "database", "postgresRepository.js"),
    "utf8",
  );
  const actionSource = await readFile(
    projectFile("app", "(app)", "procedure-actions.ts"),
    "utf8",
  );

  assert.match(repositorySource, /normalizeSelectedProcedureResultKey/u);
  assert.match(repositorySource, /filter\(Boolean\)/u);
  assert.match(actionSource, /normalizeSelectedProcedureResultKey/u);
  assert.match(actionSource, /result is ProcedureResultInput/u);
  assert.doesNotMatch(
    repositorySource,
    /resultKey:\s*normalizeProcedureResultKey\(result\?\.resultKey\)/u,
  );
  assert.doesNotMatch(
    actionSource,
    /resultKey:\s*normalizeProcedureResultKey\(result\.resultKey\)/u,
  );
});

test("procedure entry detail permissions are granted to runtime role only", async () => {
  const migration = await readFile(
    projectFile(
      "core",
      "server",
      "database",
      "migrations",
      "012_procedure_detail_permissions.sql",
    ),
    "utf8",
  );

  assert.match(migration, /REVOKE\s+ALL\s+ON\s+TABLE\s+procedimentos_entradas\s+FROM\s+anon,\s*authenticated/iu);
  assert.match(migration, /REVOKE\s+ALL\s+ON\s+TABLE\s+procedimentos_resultados\s+FROM\s+anon,\s*authenticated/iu);
  assert.match(migration, /GRANT\s+SELECT,\s*INSERT,\s*UPDATE,\s*DELETE\s+ON\s+TABLE\s+procedimentos_entradas\s+TO\s+lz_runtime/iu);
  assert.match(migration, /GRANT\s+SELECT,\s*INSERT,\s*UPDATE,\s*DELETE\s+ON\s+TABLE\s+procedimentos_resultados\s+TO\s+lz_runtime/iu);
  assert.equal(/DROP\s+COLUMN|DROP\s+TABLE|TRUNCATE|DELETE\s+FROM/iu.test(migration), false);
});

test("procedure entry detail RLS policies are restricted to runtime role", async () => {
  const migration = await readFile(
    projectFile(
      "core",
      "server",
      "database",
      "migrations",
      "013_procedure_detail_runtime_policies.sql",
    ),
    "utf8",
  );

  assert.match(migration, /CREATE\s+POLICY\s+lz_runtime_manage_procedimentos_entradas/iu);
  assert.match(migration, /ON\s+procedimentos_entradas\s+FOR\s+ALL\s+TO\s+lz_runtime/iu);
  assert.match(migration, /CREATE\s+POLICY\s+lz_runtime_manage_procedimentos_resultados/iu);
  assert.match(migration, /ON\s+procedimentos_resultados\s+FOR\s+ALL\s+TO\s+lz_runtime/iu);
  assert.equal(/\bTO\s+(anon|authenticated)\b/iu.test(migration), false);
  assert.equal(/DROP\s+COLUMN|DROP\s+TABLE|TRUNCATE|DELETE\s+FROM/iu.test(migration), false);
});

test("procedure entry calculator adjustments migration is additive", async () => {
  const migration = await readFile(
    projectFile(
      "core",
      "server",
      "database",
      "migrations",
      "015_procedure_entry_calculator_adjustments.sql",
    ),
    "utf8",
  );
  const repositorySource = await readFile(
    projectFile("core", "server", "database", "postgresRepository.js"),
    "utf8",
  );

  assert.match(migration, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+aumento_percentual/iu);
  assert.match(migration, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+cashback_percentual/iu);
  assert.equal(/DROP\s+COLUMN|DROP\s+TABLE|TRUNCATE|DELETE\s+FROM/iu.test(migration), false);
  assert.match(repositorySource, /aumento_percentual/iu);
  assert.match(repositorySource, /cashback_percentual/iu);
});

test("procedure entry freebet flag migration is additive", async () => {
  const migration = await readFile(
    projectFile(
      "core",
      "server",
      "database",
      "migrations",
      "016_procedure_entry_freebet_flag.sql",
    ),
    "utf8",
  );
  const repositorySource = await readFile(
    projectFile("core", "server", "database", "postgresRepository.js"),
    "utf8",
  );

  assert.match(migration, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+freebet_somente_lucro/iu);
  assert.equal(/DROP\s+COLUMN|DROP\s+TABLE|TRUNCATE|DELETE\s+FROM/iu.test(migration), false);
  assert.match(repositorySource, /freebet_somente_lucro/iu);
});

test("procedure entry operation date migration is additive", async () => {
  const migration = await readFile(
    projectFile(
      "core",
      "server",
      "database",
      "migrations",
      "017_procedure_entry_operation_date.sql",
    ),
    "utf8",
  );
  const repositorySource = await readFile(
    projectFile("core", "server", "database", "postgresRepository.js"),
    "utf8",
  );

  assert.match(migration, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+data_operacao/iu);
  assert.equal(/DROP\s+COLUMN|DROP\s+TABLE|TRUNCATE|DELETE\s+FROM/iu.test(migration), false);
  assert.match(repositorySource, /entry\.data_operacao/iu);
});

test("freebet phase games migration is additive", async () => {
  const migration = await readFile(
    projectFile(
      "core",
      "server",
      "database",
      "migrations",
      "018_freebet_phase_games.sql",
    ),
    "utf8",
  );
  const repositorySource = await readFile(
    projectFile("core", "server", "database", "postgresRepository.js"),
    "utf8",
  );

  assert.match(migration, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+jogo_coleta_freebet/iu);
  assert.match(migration, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+jogo_conversao_freebet/iu);
  assert.equal(/DROP\s+COLUMN|DROP\s+TABLE|TRUNCATE|DELETE\s+FROM/iu.test(migration), false);
  assert.match(repositorySource, /jogo_coleta_freebet:\s*parseText\(data\.jogo_coleta_freebet\)/u);
  assert.match(repositorySource, /jogo_conversao_freebet:\s*parseText\(data\.jogo_conversao_freebet\)/u);
});

test("freebet conversion batch migration is additive", async () => {
  const migration = await readFile(
    projectFile(
      "core",
      "server",
      "database",
      "migrations",
      "019_freebet_conversion_batch.sql",
    ),
    "utf8",
  );
  const repositorySource = await readFile(
    projectFile("core", "server", "database", "postgresRepository.js"),
    "utf8",
  );

  assert.match(migration, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+lote_conversao_freebet/iu);
  assert.equal(/DROP\s+COLUMN|DROP\s+TABLE|TRUNCATE|DELETE\s+FROM/iu.test(migration), false);
  assert.match(repositorySource, /lote_conversao_freebet:\s*parseText\(data\.lote_conversao_freebet\)/u);
  assert.match(repositorySource, /createFreebetConversionBatchId\(\)/u);
});

test("freebet conversion updates can be applied to selected origin procedures", async () => {
  const actionSource = await readFile(
    projectFile("app", "(app)", "procedure-actions.ts"),
    "utf8",
  );
  const repositorySource = await readFile(
    projectFile("core", "server", "database", "postgresRepository.js"),
    "utf8",
  );
  const calculatorSource = await readFile(
    projectFile("app", "(app)", "calculadora", "calculator-workspace.tsx"),
    "utf8",
  );
  const freebetsWorkspaceSource = await readFile(
    projectFile("app", "(app)", "freebets", "freebets-workspace.tsx"),
    "utf8",
  );

  assert.match(actionSource, /const\s+originIds\s*=\s*parseOriginIds\(formData\)/u);
  assert.match(
    actionSource,
    /isFreebetProcedureType\(procedureType\)[\s\S]*originIds\.length\s*>\s*0[\s\S]*hasConversionDetails\(procedureDetails\)[\s\S]*repository\.saveFreebetConversion\(\s*payload,\s*originIds,/u,
  );
  assert.match(
    actionSource,
    /repository\.saveFreebetConversion\(\s*payload,\s*originIds,/u,
  );
  assert.match(calculatorSource, /searchParams\.get\("conversionBatchId"\)/u);
  assert.match(calculatorSource, /conversionBatchId:\s*conversionPreset\?\.conversionBatchId/u);
  assert.match(freebetsWorkspaceSource, /params\.set\("conversionBatchId",\s*conversionBatchId\)/u);
  assert.match(repositorySource, /scaleDetailInput\(entry,\s*ratio\)/u);
  assert.match(repositorySource, /jogo_conversao_freebet:\s*[\s\S]*parseText\(data\.jogo_conversao_freebet\)/u);
  assert.match(repositorySource, /lote_conversao_freebet:\s*conversionBatchId/u);
  assert.match(repositorySource, /jogo_time_pa:\s*origin\.jogo_time_pa/u);
});

test("bookmaker balances consolidate procedure entries by catalog house and hide empty balances", async () => {
  const repositorySource = await readFile(
    projectFile("core", "server", "database", "postgresRepository.js"),
    "utf8",
  );

  assert.match(repositorySource, /ca\.id\s+AS\s+bookmaker_id/iu);
  assert.match(repositorySource, /lower\(ca\.nome\)\s*=\s*lower\(btrim\(e\.casa\)\)/iu);
  assert.match(repositorySource, /pending_required/iu);
  assert.match(repositorySource, /WHERE\s+saldo\s+>\s+0\.005/iu);
  assert.match(repositorySource, /DO\s+UPDATE\s+SET\s+saldo\s*=\s*EXCLUDED\.saldo/iu);
  assert.match(repositorySource, /rebaseBookmakerApplications/u);
  assert.doesNotMatch(repositorySource, /manual_registered/u);
});

test("procedure bookmaker applications migration is additive and runtime scoped", async () => {
  const migration = await readFile(
    projectFile(
      "core",
      "server",
      "database",
      "migrations",
      "014_procedure_bookmaker_applications.sql",
    ),
    "utf8",
  );
  const repositorySource = await readFile(
    projectFile("core", "server", "database", "postgresRepository.js"),
    "utf8",
  );

  assert.match(migration, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+procedimentos_bancas_aplicacoes/iu);
  assert.match(migration, /procedimento_id\s+BIGINT\s+NOT\s+NULL\s+REFERENCES\s+procedimentos_historico\(id\)\s+ON\s+DELETE\s+CASCADE/iu);
  assert.match(migration, /FOREIGN\s+KEY\s*\(\s*user_id\s*,\s*base_id\s*\)\s+REFERENCES\s+bases_usuario\s*\(\s*user_id\s*,\s*id\s*\)/iu);
  assert.match(migration, /REVOKE\s+ALL\s+ON\s+TABLE\s+procedimentos_bancas_aplicacoes\s+FROM\s+anon,\s*authenticated/iu);
  assert.match(migration, /ON\s+procedimentos_bancas_aplicacoes\s+FOR\s+ALL\s+TO\s+lz_runtime/iu);
  assert.equal(/DROP\s+COLUMN|DROP\s+TABLE|TRUNCATE|DELETE\s+FROM/iu.test(migration), false);
  assert.match(repositorySource, /applyProcedureBookmakerApplications/u);
  assert.match(repositorySource, /reverseProcedureBookmakerApplications/u);
  assert.match(repositorySource, /reconcileProcedureBookmakerApplications/u);
});

test("manual bookmaker balance edits rebase procedure applications", async () => {
  const repositorySource = await readFile(
    projectFile("core", "server", "database", "postgresRepository.js"),
    "utf8",
  );

  assert.match(
    repositorySource,
    /async\s+rebaseBookmakerApplications[\s\S]+INSERT\s+INTO\s+procedimentos_bancas_aplicacoes[\s\S]+ON\s+CONFLICT\s*\(\s*procedimento_id,\s*bookmaker_id\s*\)[\s\S]+saldo_delta\s*=\s*0/iu,
  );
  assert.match(
    repositorySource,
    /async\s+applyProcedureBookmakerApplications[\s\S]+FROM\s+procedimentos_bancas_aplicacoes[\s\S]+FOR\s+UPDATE[\s\S]+if\s*\(\s*applicationResult\.rows\.length\s*>\s*0\s*\)\s*\{[\s\S]+continue/iu,
  );
  assert.match(
    repositorySource,
    /async\s+reconcileProcedureBookmakerApplications[\s\S]+a\.bookmaker_id\s*=\s*ca\.id/iu,
  );
  assert.match(
    repositorySource,
    /async\s+updateBookmakerBalance[\s\S]+await\s+this\.reconcileProcedureBookmakerApplications[\s\S]+await\s+this\.rebaseBookmakerApplications/iu,
  );
  assert.match(
    repositorySource,
    /async\s+addBookmaker[\s\S]+await\s+this\.reconcileProcedureBookmakerApplications[\s\S]+DO\s+UPDATE\s+SET\s+saldo\s*=\s*EXCLUDED\.saldo[\s\S]+await\s+this\.rebaseBookmakerApplications/iu,
  );
  assert.match(
    repositorySource,
    /async\s+deleteBookmaker[\s\S]+await\s+this\.reconcileProcedureBookmakerApplications[\s\S]+await\s+this\.rebaseBookmakerApplications/iu,
  );
});

test("bookmaker deletion is blocked while pending procedures use the house", async () => {
  const repositorySource = await readFile(
    projectFile("core", "server", "database", "postgresRepository.js"),
    "utf8",
  );
  const actionsSource = await readFile(
    projectFile("app", "(app)", "bancas", "actions.ts"),
    "utf8",
  );
  const workspaceSource = await readFile(
    projectFile("app", "(app)", "bancas", "bookmakers-workspace.tsx"),
    "utf8",
  );

  assert.match(repositorySource, /async\s+bookmakerHasPendingProcedures/u);
  assert.match(repositorySource, /p\.status_procedimento\s*=\s*\$4/u);
  assert.match(repositorySource, /NOT\s+EXISTS\s*\([\s\S]+FROM\s+procedimentos_resultados/iu);
  assert.match(repositorySource, /blockedByPending:\s*true/u);
  assert.match(actionsSource, /return\s+result/u);
  assert.match(workspaceSource, /Tem procedimentos pendentes nesta casa\./u);
  assert.doesNotMatch(workspaceSource, /disabled=\{isPending\s*\|\|\s*hasProcedureBalance\}/u);
});

test("bookmaker balance inputs accept only seven digits", async () => {
  const actionsSource = await readFile(
    projectFile("app", "(app)", "bancas", "actions.ts"),
    "utf8",
  );
  const workspaceSource = await readFile(
    projectFile("app", "(app)", "bancas", "bookmakers-workspace.tsx"),
    "utf8",
  );

  assert.match(actionsSource, /max:\s*9_999_999/u);
  assert.match(workspaceSource, /replace\(\s*\/\\D\/gu,\s*""\s*\)\.slice\(0,\s*7\)/u);
  assert.match(workspaceSource, /inputMode="numeric"/u);
  assert.match(workspaceSource, /maxLength=\{7\}/u);
});

test("active user sessions enforce one app session per account", async () => {
  const migration = await readFile(
    projectFile(
      "core",
      "server",
      "database",
      "migrations",
      "020_active_user_sessions.sql",
    ),
    "utf8",
  );
  const repositorySource = await readFile(
    projectFile("core", "server", "database", "postgresRepository.js"),
    "utf8",
  );
  const sessionSource = await readFile(
    projectFile("lib", "auth", "session.ts"),
    "utf8",
  );
  const authActionsSource = await readFile(
    projectFile("app", "auth", "actions.ts"),
    "utf8",
  );

  assert.match(migration, /CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+user_active_sessions/iu);
  assert.match(migration, /user_id\s+UUID\s+PRIMARY\s+KEY\s+REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+CASCADE/iu);
  assert.match(migration, /REVOKE\s+ALL\s+ON\s+TABLE\s+user_active_sessions\s+FROM\s+anon,\s*authenticated/iu);
  assert.match(migration, /FOR\s+ALL\s+TO\s+lz_runtime/iu);
  assert.equal(/DROP\s+COLUMN|DROP\s+TABLE|TRUNCATE/iu.test(migration), false);

  assert.match(repositorySource, /async\s+setActiveUserSession/u);
  assert.match(repositorySource, /ON\s+CONFLICT\s*\(\s*user_id\s*\)\s+DO\s+UPDATE/iu);
  assert.match(repositorySource, /async\s+isActiveUserSession/u);
  assert.match(repositorySource, /last_seen_at\s*<\s*NOW\(\)\s*-\s*INTERVAL\s+'2 minutes'/iu);
  assert.match(repositorySource, /async\s+clearActiveUserSession/u);

  assert.match(sessionSource, /getCurrentActiveSession/);
  assert.match(sessionSource, /repository\.isActiveUserSession/);
  assert.match(sessionSource, /signOut\(\{\s*scope:\s*"local"\s*\}\)/);
  assert.match(sessionSource, /authorizeActiveApiUser/);

  assert.match(authActionsSource, /registerActiveSessionFromAccessToken/);
  assert.match(authActionsSource, /signOut\(\{\s*scope:\s*"others"\s*\}\)/);
  assert.match(authActionsSource, /clearCurrentActiveSession/);
});

test("profile password verification does not replace the active browser session", async () => {
  const profileActionsSource = await readFile(
    projectFile("app", "(app)", "perfil", "actions.ts"),
    "utf8",
  );
  const ephemeralAuthSource = await readFile(
    projectFile("lib", "supabase", "auth.ts"),
    "utf8",
  );

  assert.match(ephemeralAuthSource, /persistSession:\s*false/u);
  assert.match(ephemeralAuthSource, /autoRefreshToken:\s*false/u);
  assert.match(profileActionsSource, /createEphemeralAuthClient/);
  assert.match(profileActionsSource, /auth\.auth\.signInWithPassword/);
  assert.doesNotMatch(
    profileActionsSource,
    /supabase\.auth\.signInWithPassword\(\{\s*email,\s*password:\s*currentPassword/su,
  );
});

test("route JSON bodies are size and content-type guarded before parsing", async () => {
  const requestSecuritySource = await readFile(
    projectFile("lib", "security", "request.ts"),
    "utf8",
  );
  const oddsRoute = await readFile(
    projectFile("app", "api", "monitor-odds", "odds", "route.ts"),
    "utf8",
  );

  assert.match(requestSecuritySource, /content-type/u);
  assert.match(requestSecuritySource, /unsupported_media_type/u);
  assert.match(requestSecuritySource, /content-length/u);
  assert.match(requestSecuritySource, /payload_too_large/u);
  assert.match(requestSecuritySource, /request\.text\(\)/u);
  assert.match(oddsRoute, /readLimitedJson<OddsRequestBody>/u);
  assert.doesNotMatch(oddsRoute, /request\.json\(\)/u);
});

test("freebet collection primary uses the freebet house for bookmaker balances", async () => {
  const modalSource = await readFile(
    projectFile("app", "(app)", "_components", "procedure-modal.tsx"),
    "utf8",
  );

  assert.match(
    modalSource,
    /scope:\s*"freebet_collection"[\s\S]+includePrimaryHouse:\s*true[\s\S]+houses:\s*\[\s*selectedFreebetHouse,\s*\.{3}collectionHouses\.slice\(1\)\s*\]/u,
  );
  assert.match(
    modalSource,
    /scope:\s*"freebet_conversion"[\s\S]+includePrimaryHouse:\s*false/u,
  );
});
