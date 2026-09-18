// Freebets: estados, conversões e listagens.
// Os métodos entram em ProceduresPostgresRepository (this.db, this.runInTransaction…).

import "server-only";
import {
  buildConvertedFreebetsHistory,
  collectionFinishedWithoutFreebet,
  groupActiveFreebets,
} from "../../../domain/freebets/freebets.service.js";
import {
  FREEBET_CONDITION_CONVERSION_ONLY,
  FREEBET_RESULT_NO,
  FREEBET_STATUS_FINISHED,
  FREEBET_STATUS_NA,
  FREEBET_STATUS_PENDING,
  FREEBET_STATUS_USED,
  PROCEDURE_STATUS_DONE,
  PROCEDURE_STATUS_PENDING,
} from "../../../domain/shared/constants.js";
import {
  parseBoolean,
  parseNumber,
  parseText,
} from "../../../domain/shared/normalizers.js";

import {
  buildRealProfitSql,
  calculateScopeProfit,
  createFreebetConversionBatchId,
  getProcedureScopeDate,
  getProcedureScopeProfit,
  hasProcedureScopeEntries,
  hasProcedureScopeResults,
  normalizePositiveInteger,
  normalizeProcedureDetailEntries,
  normalizeProcedureDetailResults,
  normalizeUserId,
  scaleDetailInput,
  toDetailInput,
  toResultInput,
} from "./helpers.js";

export const freebetMethods = {
  async saveFreebetConversion(data, originIds, userId, workspaceId, details = null) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);
    const ids = (Array.isArray(originIds) ? originIds : [originIds])
      .map((id) => parseNumber(id))
      .filter((id) => Number.isInteger(id) && id > 0);
    const conversionEntries = normalizeProcedureDetailEntries(details?.entries)
      .filter((entry) => entry.scope === "freebet_conversion");
    const conversionResults = normalizeProcedureDetailResults(details?.results)
      .filter((result) => result.scope === "freebet_conversion");

    if (ids.length === 0) {
      return null;
    }

    await this.runInTransaction(async (executor) => {
      const { rows } = await executor.query(
        `
          SELECT *
          FROM procedimentos_historico
          WHERE id = ANY($1::bigint[])
            AND tipo_procedimento = 'Coletar Freebet'
            AND user_id = $2
            AND base_id = $3
          ORDER BY id ASC
        `,
        [ids, normalizedUserId, normalizedWorkspaceId],
      );
      const origins = await this.attachProcedureDetails(rows, executor);

      if (origins.length === 0) {
        return;
      }

      const totalFreebetValue = origins.reduce(
        (sum, origin) => sum + Math.max(parseNumber(origin.valor_da_freebet), 0),
        0,
      );
      const hasConversionResult = conversionResults.length > 0;
      const conversionBatchId =
        parseText(data.lote_conversao_freebet) ||
        origins
          .map((origin) => parseText(origin.lote_conversao_freebet))
          .find(Boolean) ||
        createFreebetConversionBatchId();

      for (const origin of origins) {
        const originId = parseNumber(origin.id);
        const originFreebetValue = Math.max(parseNumber(origin.valor_da_freebet), 0);
        const ratio = totalFreebetValue > 0
          ? originFreebetValue / totalFreebetValue
          : 1 / origins.length;
        const preservedEntries = (origin.entradas ?? [])
          .map(toDetailInput)
          .filter((entry) => entry.scope !== "freebet_conversion");
        const preservedResults = (origin.resultados ?? [])
          .map(toResultInput)
          .filter((result) => result.scope !== "freebet_conversion");
        const scaledConversionEntries = conversionEntries.map((entry) =>
          scaleDetailInput(entry, ratio),
        );
        const nextDetails = {
          entries: [...preservedEntries, ...scaledConversionEntries],
          results: [...preservedResults, ...conversionResults],
        };
        const hasCollectionResult = preservedResults.some(
          (result) => result.scope === "freebet_collection",
        );
        const collectionProfit = hasCollectionResult
          ? calculateScopeProfit(nextDetails.entries, nextDetails.results, "freebet_collection")
          : parseNumber(origin.lucro_final);
        const conversionProfit = hasConversionResult
          ? calculateScopeProfit(nextDetails.entries, nextDetails.results, "freebet_conversion")
          : 0;
        const nextPayload = {
          ...origin,
          data_operacao: parseText(data.data_operacao) || origin.data_operacao,
          casas_envolvidas: parseText(data.casas_envolvidas) || origin.casas_envolvidas,
          jogo_time_pa: origin.jogo_time_pa,
          jogo_coleta_freebet:
            parseText(origin.jogo_coleta_freebet) ||
            parseText(data.jogo_coleta_freebet) ||
            origin.jogo_time_pa,
          jogo_conversao_freebet:
            parseText(data.jogo_conversao_freebet) ||
            parseText(data.jogo_time_pa) ||
            parseText(origin.jogo_conversao_freebet),
          lote_conversao_freebet: conversionBatchId,
          observacao: parseText(data.observacao) || origin.observacao,
          condicao_freebet: parseText(data.condicao_freebet) || origin.condicao_freebet,
          lucro_final: Number((collectionProfit + conversionProfit).toFixed(2)),
          status_freebet: hasConversionResult
            ? FREEBET_STATUS_FINISHED
            : FREEBET_STATUS_USED,
          status_procedimento: hasConversionResult
            ? PROCEDURE_STATUS_DONE
            : PROCEDURE_STATUS_PENDING,
        };

        await this.reverseProcedureBookmakerApplications(
          originId,
          normalizedUserId,
          normalizedWorkspaceId,
          executor,
        );
        await this.updateProcedure(
          originId,
          nextPayload,
          normalizedUserId,
          normalizedWorkspaceId,
          executor,
        );
        await this.replaceProcedureDetails(
          originId,
          nextDetails,
          normalizedUserId,
          normalizedWorkspaceId,
          executor,
        );
        await this.applyProcedureBookmakerApplications(
          originId,
          nextDetails,
          normalizedUserId,
          normalizedWorkspaceId,
          executor,
        );
      }
    });

    return ids[0] ?? null;
  },

  async getFreebetState(procedureId, userId, workspaceId, executor = this.db) {
    const { rows } = await executor.query(
      `
        SELECT id, ganhou_freebet, status_freebet
        FROM procedimentos_historico
        WHERE id = $1
          AND user_id = $2
          AND base_id = $3
      `,
      [procedureId, normalizeUserId(userId), parseNumber(workspaceId)],
    );

    const row = rows[0];
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      ganhou_freebet: parseText(row.ganhou_freebet),
      status_freebet: parseText(row.status_freebet, FREEBET_STATUS_NA),
    };
  },

  async getFreebetStates(procedureIds, userId, workspaceId) {
    const ids = (Array.isArray(procedureIds) ? procedureIds : [procedureIds])
      .map((id) => parseNumber(id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (ids.length === 0) {
      return [];
    }

    const { rows } = await this.db.query(
      `
        SELECT id, ganhou_freebet, status_freebet
        FROM procedimentos_historico
        WHERE id = ANY($1::bigint[])
          AND user_id = $2
          AND base_id = $3
        ORDER BY id ASC
      `,
      [ids, normalizeUserId(userId), parseNumber(workspaceId)],
    );

    return rows.map((row) => ({
      id: row.id,
      ganhou_freebet: parseText(row.ganhou_freebet),
      status_freebet: parseText(row.status_freebet, FREEBET_STATUS_NA),
    }));
  },

  async restoreFreebetState(
    procedureId,
    freebetResult,
    freebetStatus,
    userId,
    workspaceId,
    executor = this.db,
  ) {
    await executor.query(
      `
        UPDATE procedimentos_historico
        SET ganhou_freebet = $1, status_freebet = $2
        WHERE id = $3
          AND user_id = $4
          AND base_id = $5
      `,
      [
        freebetResult,
        freebetStatus,
        procedureId,
        normalizeUserId(userId),
        parseNumber(workspaceId),
      ],
    );
  },

  async restoreFreebetStates(originStates, userId, workspaceId, executor = this.db) {
    const states = (originStates ?? [])
      .map((state) => ({
        id: parseNumber(state?.id),
        ganhou_freebet: parseText(state?.ganhou_freebet),
        status_freebet: parseText(state?.status_freebet, FREEBET_STATUS_PENDING),
      }))
      .filter((state) => Number.isInteger(state.id) && state.id > 0);

    if (states.length === 0) {
      return;
    }

    await executor.query(
      `
        UPDATE procedimentos_historico AS p
        SET ganhou_freebet = state.ganhou_freebet,
            status_freebet = state.status_freebet
        FROM (
          SELECT *
          FROM unnest($1::bigint[], $2::text[], $3::text[])
            AS state(id, ganhou_freebet, status_freebet)
        ) AS state
        WHERE p.id = state.id
          AND p.user_id = $4
          AND p.base_id = $5
      `,
      [
        states.map((state) => state.id),
        states.map((state) => state.ganhou_freebet),
        states.map((state) => state.status_freebet),
        normalizeUserId(userId),
        parseNumber(workspaceId),
      ],
    );
  },

  async undoFreebetConversion(conversionId, originStates, userId, workspaceId) {
    await this.runInTransaction(async (executor) => {
      await this.deleteProcedure(conversionId, userId, workspaceId, executor);
      await this.restoreFreebetStates(originStates, userId, workspaceId, executor);
    });
  },

  async listActiveFreebets(userId, workspaceId, executor = this.db) {
    const { rows } = await executor.query(
      `
        SELECT
          *
        FROM procedimentos_historico
        WHERE tipo_procedimento = 'Coletar Freebet'
          AND status_freebet IN ('Pendente', 'Usada')
          AND user_id = $1
          AND base_id = $2
        ORDER BY id DESC
      `,
      [normalizeUserId(userId), parseNumber(workspaceId)],
    );

    const rowsWithDetails = await this.attachProcedureDetails(rows, executor);
    return groupActiveFreebets(rowsWithDetails);
  },

  async listConvertedFreebets(userId, workspaceId, options = {}, executor = this.db) {
    if (options && typeof options.query === "function") {
      executor = options;
      options = {};
    }

    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);
    const params = [normalizedUserId, normalizedWorkspaceId];
    const limit = normalizePositiveInteger(options?.limit, 0);
    const { rows } = await executor.query(
      `
        SELECT *
        FROM procedimentos_historico c
        WHERE c.tipo_procedimento = 'Coletar Freebet'
          AND c.status_freebet IN ('Pendente', 'Usada', 'Finalizada')
          AND c.user_id = $1
          AND c.base_id = $2
        ORDER BY c.id DESC
      `,
      params,
    );

    const collections = await this.attachProcedureDetails(rows, executor);
    const collectionIds = collections
      .map((collection) => parseNumber(collection.id))
      .filter((id) => Number.isInteger(id) && id > 0);
    let legacyConversions = [];

    if (collectionIds.length > 0) {
      const legacyResult = await executor.query(
        `
          SELECT *
          FROM procedimentos_historico
          WHERE id_freebet_origem = ANY($1::bigint[])
            AND tipo_procedimento = 'Converter Freebet'
            AND user_id = $2
            AND base_id = $3
          ORDER BY id DESC
        `,
        [collectionIds, normalizedUserId, normalizedWorkspaceId],
      );
      legacyConversions = await this.attachProcedureDetails(legacyResult.rows, executor);
    }

    const legacyByOrigin = new Map();
    for (const conversion of legacyConversions) {
      const originId = parseNumber(conversion.id_freebet_origem);
      if (!legacyByOrigin.has(originId)) {
        legacyByOrigin.set(originId, conversion);
      }
    }

    const historyRows = [];
    for (const collection of collections) {
      const collectionId = parseNumber(collection.id);
      const legacyConversion = legacyByOrigin.get(collectionId);
      const conversionOnly =
        parseText(collection.condicao_freebet) ===
        FREEBET_CONDITION_CONVERSION_ONLY;
      const hasSyncedConversion =
        hasProcedureScopeEntries(collection, "freebet_conversion") ||
        hasProcedureScopeResults(collection, "freebet_conversion");
      const conversionResolved = hasProcedureScopeResults(
        collection,
        "freebet_conversion",
      );
      const finishedWithoutFreebet =
        !conversionOnly &&
        ((
          parseText(collection.status_freebet) === FREEBET_STATUS_FINISHED &&
          parseText(collection.ganhou_freebet) === FREEBET_RESULT_NO
        ) ||
          collectionFinishedWithoutFreebet(collection));
      const onlyCollectionFinished =
        finishedWithoutFreebet &&
        !hasSyncedConversion &&
        !legacyConversion;

      if (!onlyCollectionFinished && !legacyConversion && !conversionResolved) {
        continue;
      }

      const hasCollectionDetails = hasProcedureScopeResults(
        collection,
        "freebet_collection",
      );
      const collectionProfit = conversionOnly
        ? 0
        : hasCollectionDetails
          ? getProcedureScopeProfit(collection, "freebet_collection")
          : parseNumber(collection.lucro_final);
      const conversionProfit = hasSyncedConversion
        ? getProcedureScopeProfit(collection, "freebet_conversion")
        : parseNumber(legacyConversion?.lucro_final);

      historyRows.push({
        procedimento_id: collectionId,
        data_coleta: conversionOnly
          ? ""
          : getProcedureScopeDate(
              collection,
              "freebet_collection",
              collection.data_operacao,
            ),
        data_conversao: hasSyncedConversion
          ? getProcedureScopeDate(collection, "freebet_conversion")
          : parseText(legacyConversion?.data_operacao),
        casa: parseText(collection.casa_destino_freebet, "Desconhecida") || "Desconhecida",
        valor_freebet: parseNumber(collection.valor_da_freebet),
        lucro_base_coleta: collectionProfit,
        bateu_duplo_coleta: hasCollectionDetails
          ? false
          : parseBoolean(collection.bateu_duplo),
        valor_duplo_coleta: hasCollectionDetails
          ? 0
          : parseNumber(collection.valor_freebet_coletada),
        lucro_base_conversao: conversionProfit,
        bateu_duplo_conversao: hasSyncedConversion
          ? false
          : parseBoolean(legacyConversion?.bateu_duplo),
        valor_duplo_conversao: hasSyncedConversion
          ? 0
          : parseNumber(legacyConversion?.valor_freebet_coletada),
        status_freebet: parseText(collection.status_freebet),
        condicao_freebet: parseText(collection.condicao_freebet),
        ganhou_freebet: finishedWithoutFreebet
          ? FREEBET_RESULT_NO
          : parseText(collection.ganhou_freebet),
        procedimento: collection,
      });
    }

    const history = buildConvertedFreebetsHistory(historyRows);
    return limit > 0 ? history.slice(0, limit) : history;
  },

  async getFreebetsSummary(userId, workspaceId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (!normalizedUserId || normalizedWorkspaceId <= 0) {
      return {
        pendingConfirmationCount: 0,
        convertibleCount: 0,
        convertibleValue: 0,
        convertedCount: 0,
        convertedProfit: 0,
        activeProfit: 0,
      };
    }

    const realProfitSql = buildRealProfitSql();
    const { rows } = await executor.query(
      `
        WITH scoped AS (
          SELECT
            *,
            ${realProfitSql} AS lucro_real_calculado
          FROM procedimentos_historico
          WHERE user_id = $1
            AND base_id = $2
        ),
        collection_state AS (
          SELECT
            scoped.*,
            EXISTS (
              SELECT 1
              FROM procedimentos_resultados r
              WHERE r.procedimento_id = scoped.id
                AND r.escopo = 'freebet_collection'
            ) AS coleta_resolvida,
            EXISTS (
              SELECT 1
              FROM procedimentos_resultados r
              WHERE r.procedimento_id = scoped.id
                AND r.escopo = 'freebet_collection'
                AND r.resultado_chave = 'principal'
            ) AS coleta_principal
          FROM scoped
        ),
        converted AS (
          SELECT
            c.id,
            c.lucro_real_calculado + COALESCE(v.lucro_real_calculado, 0) AS lucro_total
          FROM collection_state c
          LEFT JOIN collection_state v
            ON v.id_freebet_origem = c.id
           AND v.tipo_procedimento = 'Converter Freebet'
          WHERE c.tipo_procedimento = 'Coletar Freebet'
            AND (
              c.status_freebet IN ('Usada', 'Finalizada')
              OR (
                c.status_freebet = 'Pendente'
                AND c.condicao_freebet = 'Apenas se perder a aposta'
                AND c.coleta_principal
              )
            )
        )
        SELECT
          (COUNT(*) FILTER (
            WHERE tipo_procedimento = 'Coletar Freebet'
              AND status_freebet = 'Pendente'
              AND NOT coleta_resolvida
          ))::integer AS pending_confirmation_count,
          (COUNT(*) FILTER (
            WHERE tipo_procedimento = 'Coletar Freebet'
              AND status_freebet = 'Pendente'
              AND coleta_resolvida
              AND NOT (
                condicao_freebet = 'Apenas se perder a aposta'
                AND coleta_principal
              )
          ))::integer AS convertible_count,
          COALESCE(SUM(valor_da_freebet) FILTER (
            WHERE tipo_procedimento = 'Coletar Freebet'
              AND status_freebet = 'Pendente'
              AND coleta_resolvida
              AND NOT (
                condicao_freebet = 'Apenas se perder a aposta'
                AND coleta_principal
              )
          ), 0) AS convertible_value,
          COALESCE(SUM(lucro_real_calculado) FILTER (
            WHERE tipo_procedimento = 'Coletar Freebet'
              AND status_freebet = 'Pendente'
              AND NOT (
                condicao_freebet = 'Apenas se perder a aposta'
                AND coleta_principal
              )
          ), 0) AS active_profit,
          (SELECT COUNT(*)::integer FROM converted) AS converted_count,
          (SELECT COALESCE(SUM(lucro_total), 0) FROM converted) AS converted_profit
        FROM collection_state
      `,
      [normalizedUserId, normalizedWorkspaceId],
    );

    const row = rows[0] ?? {};

    return {
      pendingConfirmationCount: parseNumber(row.pending_confirmation_count),
      convertibleCount: parseNumber(row.convertible_count),
      convertibleValue: parseNumber(row.convertible_value),
      convertedCount: parseNumber(row.converted_count),
      convertedProfit: parseNumber(row.converted_profit),
      activeProfit: parseNumber(row.active_profit),
    };
  },
};
