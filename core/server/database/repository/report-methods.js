// Histórico, dashboard e resumos.
// Os métodos entram em ProceduresPostgresRepository (this.db, this.runInTransaction…).

import "server-only";
import {
  enrichProcedure,
} from "../../../domain/procedimentos/procedimentos.service.js";
import {
  PROCEDURE_STATUS_PENDING,
} from "../../../domain/shared/constants.js";
import {
  parseNumber,
  parseText,
} from "../../../domain/shared/normalizers.js";

import {
  buildPartnerFilterCondition,
  buildRealProfitSql,
  normalizePartnerFilter,
  normalizeUserId,
} from "./helpers.js";

export const reportMethods = {
  async getMonthData(referenceMonth, userId, workspaceId, executor = this.db) {
    const { rows } = await executor.query(
      `
        SELECT *
        FROM procedimentos_historico
        WHERE mes_referencia = $1
          AND user_id = $2
          AND base_id = $3
        ORDER BY id DESC
      `,
      [referenceMonth, normalizeUserId(userId), parseNumber(workspaceId)],
    );

    const rowsWithDetails = await this.attachProcedureDetails(rows, executor);
    return rowsWithDetails.map((row) => enrichProcedure(row));
  },

  async listHistoryMonths(userId, workspaceId, partners = [], executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (!normalizedUserId || normalizedWorkspaceId <= 0) {
      return [];
    }

    const realProfitSql = buildRealProfitSql();
    const monthParams = [normalizedUserId, normalizedWorkspaceId];
    const monthPartnerCondition = buildPartnerFilterCondition(
      "procedimentos_historico",
      normalizePartnerFilter(partners),
      (value) => { monthParams.push(value); return `$${monthParams.length}`; },
    );
    const { rows } = await executor.query(
      `
        WITH scoped AS (
          SELECT
            CASE
              WHEN NULLIF(mes_referencia, '') IS NOT NULL THEN mes_referencia
              WHEN data_operacao ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
                THEN substring(data_operacao FROM 4 FOR 7)
              ELSE ''
            END AS reference_month,
            ${realProfitSql} AS lucro_real_calculado
          FROM procedimentos_historico
          WHERE user_id = $1
            AND base_id = $2
            ${monthPartnerCondition ? `AND ${monthPartnerCondition}` : ""}
        )
        SELECT
          reference_month,
          COALESCE(SUM(lucro_real_calculado), 0) AS profit,
          COUNT(*)::integer AS count
        FROM scoped
        GROUP BY reference_month
      `,
      monthParams,
    );

    return rows.map((row) => ({
      value: parseText(row.reference_month),
      profit: parseNumber(row.profit),
      count: parseNumber(row.count),
    }));
  },

  async listHistoryOperationsByMonth(
    referenceMonth,
    userId,
    workspaceId,
    partners = [],
    executor = this.db,
  ) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);
    const normalizedReferenceMonth = parseText(referenceMonth).trim();

    if (!normalizedUserId || normalizedWorkspaceId <= 0) {
      return [];
    }

    if (!normalizedReferenceMonth) {
      return this.listProcedures(normalizedUserId, normalizedWorkspaceId, executor);
    }

    const operationParams = [normalizedUserId, normalizedWorkspaceId, normalizedReferenceMonth];
    const operationPartnerCondition = buildPartnerFilterCondition(
      "procedimentos_historico",
      normalizePartnerFilter(partners),
      (value) => { operationParams.push(value); return `$${operationParams.length}`; },
    );
    const { rows } = await executor.query(
      `
        SELECT *
        FROM procedimentos_historico
        WHERE user_id = $1
          AND base_id = $2
          ${operationPartnerCondition ? `AND ${operationPartnerCondition}` : ""}
          AND (
            mes_referencia = $3
            OR (
              (mes_referencia IS NULL OR mes_referencia = '')
              AND data_operacao ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
              AND substring(data_operacao FROM 4 FOR 7) = $3
            )
          )
        ORDER BY id DESC
      `,
      operationParams,
    );

    const rowsWithDetails = await this.attachProcedureDetails(rows, executor);
    return rowsWithDetails.map((row) => enrichProcedure(row));
  },

  async getDashboardProcedureStats(referenceMonth, todayLabel, userId, workspaceId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (!referenceMonth || !normalizedUserId || normalizedWorkspaceId <= 0) {
      return {
        metrics: [],
        daily: [],
      };
    }

    const realProfitSql = buildRealProfitSql();
    const params = [referenceMonth, normalizedUserId, normalizedWorkspaceId, todayLabel];
    const [metricsResult, dailyResult] = await Promise.all([
      executor.query(
        `
          WITH month_rows AS (
            SELECT
              data_operacao,
              tipo_procedimento,
              ${realProfitSql} AS lucro_real_calculado
            FROM procedimentos_historico
            WHERE mes_referencia = $1
              AND user_id = $2
              AND base_id = $3
          )
          SELECT
            CASE
              WHEN GROUPING(tipo_procedimento) = 1 THEN 'Todos'
              ELSE tipo_procedimento
            END AS filtro,
            COALESCE(SUM(lucro_real_calculado), 0) AS monthly_profit,
            COUNT(*)::integer AS monthly_procedure_count,
            COUNT(DISTINCT NULLIF(data_operacao, ''))::integer AS active_days,
            COALESCE(SUM(lucro_real_calculado) FILTER (WHERE data_operacao = $4), 0) AS today_profit,
            (COUNT(*) FILTER (WHERE data_operacao = $4))::integer AS procedures_today
          FROM month_rows
          GROUP BY GROUPING SETS ((tipo_procedimento), ())
        `,
        params,
      ),
      executor.query(
        `
          WITH month_rows AS (
            SELECT
              data_operacao,
              tipo_procedimento,
              ${realProfitSql} AS lucro_real_calculado
            FROM procedimentos_historico
            WHERE mes_referencia = $1
              AND user_id = $2
              AND base_id = $3
              AND NULLIF(data_operacao, '') IS NOT NULL
          )
          SELECT
            CASE
              WHEN GROUPING(tipo_procedimento) = 1 THEN 'Todos'
              ELSE tipo_procedimento
            END AS filtro,
            data_operacao,
            COALESCE(SUM(lucro_real_calculado), 0) AS profit,
            COUNT(*)::integer AS volume
          FROM month_rows
          GROUP BY GROUPING SETS ((tipo_procedimento, data_operacao), (data_operacao))
          ORDER BY data_operacao ASC
        `,
        params.slice(0, 3),
      ),
    ]);

    return {
      metrics: metricsResult.rows,
      daily: dailyResult.rows,
    };
  },

  async getDashboardPeriodProcedureStats(
    period,
    todayLabel,
    userId,
    workspaceId,
    partners = [],
    executor = this.db,
  ) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);
    const periodType = parseText(period?.type);
    const periodValue = parseText(period?.value);

    if (
      !normalizedUserId ||
      normalizedWorkspaceId <= 0 ||
      !["day", "days", "range", "month", "year", "all"].includes(periodType) ||
      (periodType !== "all" && !periodValue)
    ) {
      return {
        metrics: [],
        series: [],
      };
    }

    const realProfitSql = buildRealProfitSql("p");
    const metricsParams = [normalizedUserId, normalizedWorkspaceId, todayLabel];
    const metricsFilters = ["reference_month <> ''"];
    const seriesParams = [normalizedUserId, normalizedWorkspaceId];
    const seriesFilters = ["reference_month <> ''"];
    const isDailyPeriod = ["day", "days", "range", "month"].includes(periodType);
    const bucketLabelSql = isDailyPeriod ? "data_operacao" : "reference_month";
    const bucketKeySql = isDailyPeriod
      ? `
        CASE
          WHEN data_operacao ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
            THEN substring(data_operacao FROM 7 FOR 4) || substring(data_operacao FROM 4 FOR 2) || substring(data_operacao FROM 1 FOR 2)
          ELSE ''
        END
      `
      : `
        CASE
          WHEN reference_month ~ '^[0-9]{2}/[0-9]{4}$'
            THEN substring(reference_month FROM 4 FOR 4) || substring(reference_month FROM 1 FOR 2)
          ELSE ''
        END
      `;

    if (["day", "days", "range"].includes(periodType)) {
      const startKey = parseText(period?.startKey);
      const endKey = parseText(period?.endKey);

      if (!startKey || !endKey) {
        return {
          metrics: [],
          series: [],
        };
      }

      metricsParams.push(startKey, endKey);
      metricsFilters.push(
        `NULLIF(data_operacao, '') IS NOT NULL`,
        `${bucketKeySql} BETWEEN $${metricsParams.length - 1} AND $${metricsParams.length}`,
      );
      seriesParams.push(startKey, endKey);
      seriesFilters.push(
        `NULLIF(data_operacao, '') IS NOT NULL`,
        `${bucketKeySql} BETWEEN $${seriesParams.length - 1} AND $${seriesParams.length}`,
      );
    } else if (periodType === "month") {
      metricsParams.push(periodValue);
      metricsFilters.push(`reference_month = $${metricsParams.length}`);
      seriesParams.push(periodValue);
      seriesFilters.push(`reference_month = $${seriesParams.length}`);
    } else if (periodType === "year") {
      metricsParams.push(periodValue);
      metricsFilters.push(
        `substring(reference_month FROM 4 FOR 4) = $${metricsParams.length}`,
      );
      seriesParams.push(periodValue);
      seriesFilters.push(
        `substring(reference_month FROM 4 FOR 4) = $${seriesParams.length}`,
      );
    }

    const partnerFilter = normalizePartnerFilter(partners);
    const metricsPartnerCondition = buildPartnerFilterCondition("p", partnerFilter, (value) => { metricsParams.push(value); return `$${metricsParams.length}`; });
    const seriesPartnerCondition = buildPartnerFilterCondition("p", partnerFilter, (value) => { seriesParams.push(value); return `$${seriesParams.length}`; });
    const buildPeriodRowsCte = (filters, partnerCondition) => `
      WITH base_rows AS (
        SELECT
          p.data_operacao,
          p.tipo_procedimento,
          CASE
            WHEN NULLIF(p.mes_referencia, '') IS NOT NULL THEN p.mes_referencia
            WHEN p.data_operacao ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
              THEN substring(p.data_operacao FROM 4 FOR 7)
            ELSE ''
          END AS reference_month,
          ${realProfitSql} AS lucro_real_calculado
        FROM procedimentos_historico p
        WHERE p.user_id = $1
          AND p.base_id = $2
          ${partnerCondition ? `AND ${partnerCondition}` : ""}
      ),
      period_rows AS (
        SELECT
          *,
          ${bucketLabelSql} AS bucket_label,
          ${bucketKeySql} AS bucket_key
        FROM base_rows
        WHERE ${filters.join("\n          AND ")}
      )
    `;

    const [metricsResult, seriesResult] = await Promise.all([
      executor.query(
        `
          ${buildPeriodRowsCte(metricsFilters, metricsPartnerCondition)}
          SELECT
            CASE
              WHEN GROUPING(tipo_procedimento) = 1 THEN 'Todos'
              ELSE tipo_procedimento
            END AS filtro,
            COALESCE(SUM(lucro_real_calculado), 0) AS period_profit,
            COUNT(*)::integer AS procedure_count,
            COUNT(DISTINCT NULLIF(bucket_label, ''))::integer AS active_buckets,
            COALESCE(SUM(lucro_real_calculado) FILTER (WHERE data_operacao = $3), 0) AS today_profit,
            (COUNT(*) FILTER (WHERE data_operacao = $3))::integer AS procedures_today
          FROM period_rows
          GROUP BY GROUPING SETS ((tipo_procedimento), ())
        `,
        metricsParams,
      ),
      executor.query(
        `
          ${buildPeriodRowsCte(seriesFilters, seriesPartnerCondition)}
          SELECT
            CASE
              WHEN GROUPING(tipo_procedimento) = 1 THEN 'Todos'
              ELSE tipo_procedimento
            END AS filtro,
            bucket_label,
            bucket_key,
            COALESCE(SUM(lucro_real_calculado), 0) AS profit,
            COUNT(*)::integer AS volume
          FROM period_rows
          WHERE NULLIF(bucket_label, '') IS NOT NULL
          GROUP BY GROUPING SETS (
            (tipo_procedimento, bucket_label, bucket_key),
            (bucket_label, bucket_key)
          )
          ORDER BY bucket_key ASC
        `,
        seriesParams,
      ),
    ]);

    return {
      metrics: metricsResult.rows,
      series: seriesResult.rows,
    };
  },

  async getConvertedFreebetDailyProfit(referenceMonth, userId, workspaceId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (!referenceMonth || !normalizedUserId || normalizedWorkspaceId <= 0) {
      return [];
    }

    const collectionProfitSql = buildRealProfitSql("c");
    const conversionProfitSql = buildRealProfitSql("v");
    const { rows } = await executor.query(
      `
        SELECT
          v.data_operacao,
          COALESCE(SUM((${collectionProfitSql}) + (${conversionProfitSql})), 0) AS value,
          COUNT(*)::integer AS count
        FROM procedimentos_historico c
        INNER JOIN procedimentos_historico v
          ON v.id_freebet_origem = c.id
         AND v.tipo_procedimento = 'Converter Freebet'
         AND v.user_id = c.user_id
         AND v.base_id = c.base_id
        WHERE c.tipo_procedimento = 'Coletar Freebet'
          AND c.status_freebet IN ('Usada', 'Finalizada')
          AND v.mes_referencia = $1
          AND c.user_id = $2
          AND c.base_id = $3
        GROUP BY v.data_operacao
        ORDER BY v.data_operacao ASC
      `,
      [referenceMonth, normalizedUserId, normalizedWorkspaceId],
    );

    return rows;
  },

  async getConvertedFreebetProfitByPeriod(period, userId, workspaceId, partners = [], executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);
    const periodType = parseText(period?.type);
    const periodValue = parseText(period?.value);

    if (
      !normalizedUserId ||
      normalizedWorkspaceId <= 0 ||
      !["day", "days", "range", "month", "year", "all"].includes(periodType) ||
      (periodType !== "all" && !periodValue)
    ) {
      return [];
    }

    const collectionProfitSql = buildRealProfitSql("c");
    const conversionProfitSql = buildRealProfitSql("v");
    const params = [normalizedUserId, normalizedWorkspaceId];
    const filters = ["reference_month <> ''"];
    const isDailyPeriod = ["day", "days", "range", "month"].includes(periodType);
    const bucketLabelSql = isDailyPeriod ? "data_operacao" : "reference_month";
    const bucketKeySql = isDailyPeriod
      ? `
        CASE
          WHEN data_operacao ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
            THEN substring(data_operacao FROM 7 FOR 4) || substring(data_operacao FROM 4 FOR 2) || substring(data_operacao FROM 1 FOR 2)
          ELSE ''
        END
      `
      : `
        CASE
          WHEN reference_month ~ '^[0-9]{2}/[0-9]{4}$'
            THEN substring(reference_month FROM 4 FOR 4) || substring(reference_month FROM 1 FOR 2)
          ELSE ''
        END
      `;

    if (["day", "days", "range"].includes(periodType)) {
      const startKey = parseText(period?.startKey);
      const endKey = parseText(period?.endKey);

      if (!startKey || !endKey) {
        return [];
      }

      params.push(startKey, endKey);
      filters.push(`bucket_key BETWEEN $${params.length - 1} AND $${params.length}`);
    } else if (periodType === "month") {
      params.push(periodValue);
      filters.push(`reference_month = $${params.length}`);
    } else if (periodType === "year") {
      params.push(periodValue);
      filters.push(`substring(reference_month FROM 4 FOR 4) = $${params.length}`);
    }

    const convertedPartnerFilter = normalizePartnerFilter(partners);
    const collectionPartnerCondition = buildPartnerFilterCondition("c", convertedPartnerFilter, (value) => { params.push(value); return `$${params.length}`; });
    const conversionPartnerCondition = buildPartnerFilterCondition("v", convertedPartnerFilter, (value) => { params.push(value); return `$${params.length}`; });
    const { rows } = await executor.query(
      `
        WITH base_converted_rows AS (
          SELECT
            v.data_operacao,
            CASE
              WHEN NULLIF(v.mes_referencia, '') IS NOT NULL THEN v.mes_referencia
              WHEN v.data_operacao ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
                THEN substring(v.data_operacao FROM 4 FOR 7)
              ELSE ''
            END AS reference_month,
            (${collectionProfitSql}) + (${conversionProfitSql}) AS lucro_total
          FROM procedimentos_historico c
          INNER JOIN procedimentos_historico v
            ON v.id_freebet_origem = c.id
           AND v.tipo_procedimento = 'Converter Freebet'
           AND v.user_id = c.user_id
           AND v.base_id = c.base_id
          WHERE c.tipo_procedimento = 'Coletar Freebet'
            AND c.status_freebet IN ('Usada', 'Finalizada')
            AND c.user_id = $1
            AND c.base_id = $2
            ${collectionPartnerCondition ? `AND (${collectionPartnerCondition} OR ${conversionPartnerCondition})` : ""}
        ),
        converted_rows AS (
          SELECT
            *,
            ${bucketLabelSql} AS bucket_label,
            ${bucketKeySql} AS bucket_key
          FROM base_converted_rows
        )
        SELECT
          bucket_label,
          bucket_key,
          COALESCE(SUM(lucro_total), 0) AS value,
          COUNT(*)::integer AS count
        FROM converted_rows
        WHERE ${filters.join("\n          AND ")}
          AND NULLIF(bucket_label, '') IS NOT NULL
        GROUP BY bucket_label, bucket_key
        ORDER BY bucket_key ASC
      `,
      params,
    );

    return rows;
  },

  async getPendingProceduresSummary(userId, workspaceId, partners = [], executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (!normalizedUserId || normalizedWorkspaceId <= 0) {
      return {
        pendingAmount: 0,
        pendingCount: 0,
      };
    }

    const pendingParams = [normalizedUserId, normalizedWorkspaceId, PROCEDURE_STATUS_PENDING];
    const pendingPartnerCondition = buildPartnerFilterCondition(
      "p",
      normalizePartnerFilter(partners),
      (value) => { pendingParams.push(value); return `$${pendingParams.length}`; },
    );
    const { rows } = await executor.query(
      `
        SELECT
          COUNT(DISTINCT p.id)::integer AS pending_count,
          COALESCE(SUM(
            CASE
              WHEN e.id IS NULL OR COALESCE(e.freebet_somente_lucro, false) THEN 0
              WHEN EXISTS (
                SELECT 1
                FROM procedimentos_resultados r
                WHERE r.procedimento_id = p.id
                  AND r.user_id = p.user_id
                  AND r.base_id = p.base_id
                  AND r.escopo = e.escopo
              ) THEN 0
              ELSE GREATEST(COALESCE(e.valor, 0), 0)
            END
          ), 0) AS pending_amount
        FROM procedimentos_historico p
        LEFT JOIN procedimentos_entradas e
          ON e.procedimento_id = p.id
         AND e.user_id = p.user_id
         AND e.base_id = p.base_id
        WHERE p.user_id = $1
          AND p.base_id = $2
          AND p.status_procedimento = $3
          ${pendingPartnerCondition ? `AND ${pendingPartnerCondition}` : ""}
      `,
      pendingParams,
    );

    const row = rows[0] ?? {};

    return {
      pendingAmount: parseNumber(row.pending_amount),
      pendingCount: parseNumber(row.pending_count),
    };
  },
};
