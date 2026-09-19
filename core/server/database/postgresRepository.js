import "server-only";

import { monitorMethods } from "./repository/monitor-methods.js";
import { partnerMethods } from "./repository/partner-methods.js";
import { sessionMethods } from "./repository/session-methods.js";
import { bookmakerMethods } from "./repository/bookmaker-methods.js";
import { workspaceMethods } from "./repository/workspace-methods.js";
import { procedureMethods } from "./repository/procedure-methods.js";
import { freebetMethods } from "./repository/freebet-methods.js";
import { reportMethods } from "./repository/report-methods.js";

export class ProceduresPostgresRepository {
  constructor(db) {
    if (!db || typeof db.query !== "function") {
      throw new Error("Informe uma conexão PostgreSQL compatível com query().");
    }

    this.db = db;
  }

  async initialize() {}

  async runInTransaction(callback) {
    if (typeof this.db.connect !== "function") {
      return callback(this.db);
    }

    const client = await this.db.connect();

    try {
      await client.query("BEGIN");
      const result = await callback(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    if (typeof this.db.end === "function") {
      await this.db.end();
    }
  }
}

// Métodos separados por assunto em ./repository.
Object.assign(
  ProceduresPostgresRepository.prototype,
  monitorMethods,
  partnerMethods,
  sessionMethods,
  bookmakerMethods,
  workspaceMethods,
  procedureMethods,
  freebetMethods,
  reportMethods,
);
