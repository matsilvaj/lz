// Procedimentos, detalhes das entradas, status e aplicações nas bancas.
// Os métodos entram em ProceduresPostgresRepository (this.db, this.runInTransaction…).

import "server-only";
import {
  enrichProcedure,
} from "../../../domain/procedimentos/procedimentos.service.js";
import {
  CASINO_PROCEDURE_TYPES,
  PROCEDURE_STATUSES,
} from "../../../domain/shared/constants.js";
import {
  parseBoolean,
  parseNumber,
  parseText,
} from "../../../domain/shared/normalizers.js";

import {
  buildPartnerFilterCondition,
  buildProcedureBookmakerSettlements,
  clamp,
  isUndefinedTableError,
  normalizeDatabaseData,
  normalizeEntryPartnerId,
  normalizeIsoDate,
  normalizePartnerFilter,
  normalizePositiveInteger,
  normalizeProcedureDetailEntries,
  normalizeProcedureDetailResults,
  normalizeProcedureDetailSide,
  normalizeTextArray,
  normalizeUserId,
} from "./helpers.js";

export const procedureMethods = {
  async saveProcedure(data, userId, workspaceId, executor = this.db) {
    const normalized = normalizeDatabaseData(data);
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);
    const { rows } = await executor.query(
      `
        INSERT INTO procedimentos_historico (
          user_id,
          base_id,
          data_operacao,
          tipo_procedimento,
          casas_envolvidas,
          jogo_time_pa,
          jogo_coleta_freebet,
          jogo_conversao_freebet,
          lote_conversao_freebet,
          lucro_final,
          bateu_duplo,
          condicao_freebet,
          valor_freebet_coletada,
          observacao,
          mes_referencia,
          casa_destino_freebet,
          status_freebet,
          status_procedimento,
          id_freebet_origem,
          valor_da_freebet,
          ganhou_freebet
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
        )
        RETURNING id
      `,
      [
        normalizedUserId,
        normalizedWorkspaceId,
        normalized.data_operacao,
        normalized.tipo_procedimento,
        normalized.casas_envolvidas,
        normalized.jogo_time_pa,
        normalized.jogo_coleta_freebet,
        normalized.jogo_conversao_freebet,
        normalized.lote_conversao_freebet,
        normalized.lucro_final,
        normalized.bateu_duplo,
        normalized.condicao_freebet,
        normalized.valor_freebet_coletada,
        normalized.observacao,
        normalized.mes_referencia,
        normalized.casa_destino_freebet,
        normalized.status_freebet,
        normalized.status_procedimento,
        normalized.id_freebet_origem,
        normalized.valor_da_freebet,
        normalized.ganhou_freebet,
      ],
    );

    return Number(rows[0]?.id);
  },

  async saveProcedureWithDetails(data, details, userId, workspaceId) {
    let procedureId = null;

    await this.runInTransaction(async (executor) => {
      procedureId = await this.saveProcedure(data, userId, workspaceId, executor);
      await this.replaceProcedureDetails(
        procedureId,
        details,
        userId,
        workspaceId,
        executor,
      );
      await this.applyProcedureBookmakerApplications(
        procedureId,
        details,
        userId,
        workspaceId,
        executor,
      );
    });

    return procedureId;
  },

  async replaceProcedureDetails(
    procedureId,
    details,
    userId,
    workspaceId,
    executor = this.db,
  ) {
    const normalizedProcedureId = parseNumber(procedureId);
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (
      !Number.isInteger(normalizedProcedureId) ||
      normalizedProcedureId <= 0 ||
      !normalizedUserId ||
      normalizedWorkspaceId <= 0
    ) {
      return;
    }

    const entries = normalizeProcedureDetailEntries(details?.entries);
    const results = normalizeProcedureDetailResults(details?.results);

    await executor.query(
      `
        DELETE FROM procedimentos_resultados
        WHERE procedimento_id = $1
          AND user_id = $2
          AND base_id = $3
      `,
      [normalizedProcedureId, normalizedUserId, normalizedWorkspaceId],
    );
    await executor.query(
      `
        DELETE FROM procedimentos_entradas
        WHERE procedimento_id = $1
          AND user_id = $2
          AND base_id = $3
      `,
      [normalizedProcedureId, normalizedUserId, normalizedWorkspaceId],
    );

    if (entries.length > 0) {
      await executor.query(
        `
          INSERT INTO procedimentos_entradas (
            procedimento_id,
            user_id,
            base_id,
            escopo,
            tipo_entrada,
            ordem,
            resultado_chave,
            casa,
            valor,
            odd,
            lado,
            odd_lay,
            comissao_percentual,
            aumento_percentual,
            cashback_percentual,
            cashback_apenas_perda,
            freebet_somente_lucro,
            data_operacao,
            parceiro_id
          )
          SELECT
            $1,
            $2,
            $3,
            entry.escopo,
            entry.tipo_entrada,
            entry.ordem,
            entry.resultado_chave,
            entry.casa,
            entry.valor,
            entry.odd,
            entry.lado,
            entry.odd_lay,
            entry.comissao_percentual,
            entry.aumento_percentual,
            entry.cashback_percentual,
            entry.cashback_apenas_perda,
            entry.freebet_somente_lucro,
            entry.data_operacao,
            entry.parceiro_id
          FROM unnest(
            $4::text[],
            $5::text[],
            $6::integer[],
            $7::text[],
            $8::text[],
            $9::double precision[],
            $10::double precision[],
            $11::text[],
            $12::double precision[],
            $13::double precision[],
            $14::double precision[],
            $15::double precision[],
            $16::boolean[],
            $17::boolean[],
            $18::text[],
            $19::bigint[]
          ) AS entry(
            escopo,
            tipo_entrada,
            ordem,
            resultado_chave,
            casa,
            valor,
            odd,
            lado,
            odd_lay,
            comissao_percentual,
            aumento_percentual,
            cashback_percentual,
            cashback_apenas_perda,
            freebet_somente_lucro,
            data_operacao,
            parceiro_id
          )
        `,
        [
          normalizedProcedureId,
          normalizedUserId,
          normalizedWorkspaceId,
          entries.map((entry) => entry.scope),
          entries.map((entry) => entry.role),
          entries.map((entry) => entry.order),
          entries.map((entry) => entry.resultKey),
          entries.map((entry) => entry.house),
          entries.map((entry) => entry.value),
          entries.map((entry) => entry.odd),
          entries.map((entry) => entry.side),
          entries.map((entry) => entry.layOdd),
          entries.map((entry) => entry.commission),
          entries.map((entry) => entry.increase),
          entries.map((entry) => entry.cashback),
          entries.map((entry) => entry.cashbackLossOnly),
          entries.map((entry) => entry.freebet),
          entries.map((entry) => entry.operationDate),
          entries.map((entry) => entry.partnerId),
        ],
      );
    }

    if (results.length > 0) {
      await executor.query(
        `
          INSERT INTO procedimentos_resultados (
            procedimento_id,
            user_id,
            base_id,
            escopo,
            resultado_chave
          )
          SELECT
            $1,
            $2,
            $3,
            result.escopo,
            result.resultado_chave
          FROM unnest(
            $4::text[],
            $5::text[]
          ) AS result(escopo, resultado_chave)
          ON CONFLICT (procedimento_id, escopo, resultado_chave) DO NOTHING
        `,
        [
          normalizedProcedureId,
          normalizedUserId,
          normalizedWorkspaceId,
          results.map((result) => result.scope),
          results.map((result) => result.resultKey),
        ],
      );
    }
  },

  async reverseProcedureBookmakerApplications(
    procedureId,
    userId,
    workspaceId,
    executor = this.db,
  ) {
    const normalizedProcedureId = parseNumber(procedureId);
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (
      !Number.isInteger(normalizedProcedureId) ||
      normalizedProcedureId <= 0 ||
      !normalizedUserId ||
      normalizedWorkspaceId <= 0
    ) {
      return false;
    }

    try {
      const { rows } = await executor.query(
        `
          SELECT bookmaker_id, SUM(saldo_delta) AS saldo_delta
          FROM procedimentos_bancas_aplicacoes
          WHERE procedimento_id = $1
            AND user_id = $2
            AND base_id = $3
          GROUP BY bookmaker_id
        `,
        [normalizedProcedureId, normalizedUserId, normalizedWorkspaceId],
      );

      if (rows.length > 0) {
        await executor.query(
          `
            UPDATE usuarios_bancas AS ub
            SET saldo = GREATEST(ub.saldo - applied.saldo_delta, 0)
            FROM (
              SELECT *
              FROM unnest($3::bigint[], $4::double precision[])
                AS item(bookmaker_id, saldo_delta)
            ) AS applied
            WHERE ub.user_id = $1
              AND ub.base_id = $2
              AND ub.bookmaker_id = applied.bookmaker_id
          `,
          [
            normalizedUserId,
            normalizedWorkspaceId,
            rows.map((row) => parseNumber(row.bookmaker_id)),
            rows.map((row) => parseNumber(row.saldo_delta)),
          ],
        );
      }

      await executor.query(
        `
          DELETE FROM procedimentos_bancas_aplicacoes
          WHERE procedimento_id = $1
            AND user_id = $2
            AND base_id = $3
        `,
        [normalizedProcedureId, normalizedUserId, normalizedWorkspaceId],
      );

      await this.reversePartnerApplications(
        normalizedProcedureId,
        normalizedUserId,
        normalizedWorkspaceId,
        executor,
      );

      return true;
    } catch (error) {
      if (isUndefinedTableError(error)) {
        return false;
      }

      throw error;
    }
  },

  async applyProcedureBookmakerApplications(
    procedureId,
    details,
    userId,
    workspaceId,
    executor = this.db,
  ) {
    const normalizedProcedureId = parseNumber(procedureId);
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (
      !Number.isInteger(normalizedProcedureId) ||
      normalizedProcedureId <= 0 ||
      !normalizedUserId ||
      normalizedWorkspaceId <= 0
    ) {
      return;
    }

    const settlements = buildProcedureBookmakerSettlements(details);
    if (settlements.length === 0) {
      return;
    }

    try {
      const bookmakerResult = await executor.query(
        `
          SELECT id, lower(nome) AS chave
          FROM casas_de_apostas
          WHERE lower(nome) = ANY($1::text[])
        `,
        [settlements.map((settlement) => settlement.house.toLowerCase())],
      );
      const bookmakerIdsByHouse = new Map(
        bookmakerResult.rows.map((row) => [
          parseText(row.chave),
          parseNumber(row.id),
        ]),
      );

      for (const settlement of settlements) {
        const bookmakerId = bookmakerIdsByHouse.get(settlement.house.toLowerCase());

        if (!bookmakerId) {
          continue;
        }

        if (settlement.partnerId) {
          await this.applyPartnerSettlement(
            normalizedProcedureId,
            settlement,
            bookmakerId,
            normalizedUserId,
            normalizedWorkspaceId,
            executor,
          );
          continue;
        }

        const applicationResult = await executor.query(
          `
            SELECT 1
            FROM procedimentos_bancas_aplicacoes
            WHERE procedimento_id = $1
              AND user_id = $2
              AND base_id = $3
              AND bookmaker_id = $4
            FOR UPDATE
          `,
          [
            normalizedProcedureId,
            normalizedUserId,
            normalizedWorkspaceId,
            bookmakerId,
          ],
        );

        if (applicationResult.rows.length > 0) {
          continue;
        }

        const balanceResult = await executor.query(
          `
            SELECT saldo
            FROM usuarios_bancas
            WHERE user_id = $1
              AND base_id = $2
              AND bookmaker_id = $3
            FOR UPDATE
          `,
          [normalizedUserId, normalizedWorkspaceId, bookmakerId],
        );
        const previousBalance = parseNumber(balanceResult.rows[0]?.saldo);
        const nextBalance = Math.max(
          Math.max(previousBalance, settlement.stake) -
            settlement.stake +
            settlement.payout,
          0,
        );
        const delta = nextBalance - previousBalance;

        if (Math.abs(delta) >= 0.005) {
          await executor.query(
            `
              INSERT INTO usuarios_bancas (user_id, base_id, bookmaker_id, saldo)
              VALUES ($1, $2, $3, $4)
              ON CONFLICT (base_id, bookmaker_id)
              DO UPDATE SET saldo = EXCLUDED.saldo
              WHERE usuarios_bancas.user_id = EXCLUDED.user_id
            `,
            [normalizedUserId, normalizedWorkspaceId, bookmakerId, nextBalance],
          );
        }

        await executor.query(
          `
            INSERT INTO procedimentos_bancas_aplicacoes (
              procedimento_id,
              user_id,
              base_id,
              bookmaker_id,
              saldo_delta,
              saldo_anterior,
              saldo_resultante
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (procedimento_id, bookmaker_id)
            DO UPDATE SET
              saldo_delta = EXCLUDED.saldo_delta,
              saldo_anterior = EXCLUDED.saldo_anterior,
              saldo_resultante = EXCLUDED.saldo_resultante,
              atualizado_em = now()
          `,
          [
            normalizedProcedureId,
            normalizedUserId,
            normalizedWorkspaceId,
            bookmakerId,
            delta,
            previousBalance,
            nextBalance,
          ],
        );
      }
    } catch (error) {
      if (isUndefinedTableError(error)) {
        return;
      }

      throw error;
    }
  },

  async reconcileProcedureBookmakerApplications(
    userId,
    workspaceId,
    executor = this.db,
  ) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (!normalizedUserId || normalizedWorkspaceId <= 0) {
      return;
    }

    try {
      const reconcile = async (transaction) => {
        const { rows } = await transaction.query(
          `
            SELECT p.*
            FROM procedimentos_historico p
            WHERE p.user_id = $1
              AND p.base_id = $2
              AND EXISTS (
                SELECT 1
                FROM procedimentos_entradas e
                WHERE e.procedimento_id = p.id
                  AND e.user_id = p.user_id
                  AND e.base_id = p.base_id
              )
              AND EXISTS (
                SELECT 1
                FROM procedimentos_resultados r
                WHERE r.procedimento_id = p.id
                  AND r.user_id = p.user_id
                  AND r.base_id = p.base_id
              )
              AND EXISTS (
                SELECT 1
                FROM procedimentos_entradas e
                INNER JOIN casas_de_apostas ca
                  ON lower(ca.nome) = lower(btrim(e.casa))
                WHERE e.procedimento_id = p.id
                  AND e.user_id = p.user_id
                  AND e.base_id = p.base_id
                  AND btrim(e.casa) <> ''
                  AND EXISTS (
                    SELECT 1
                    FROM procedimentos_resultados r
                    WHERE r.procedimento_id = e.procedimento_id
                      AND r.user_id = e.user_id
                      AND r.base_id = e.base_id
                      AND r.escopo = e.escopo
                  )
                  AND (
                    (
                      e.parceiro_id IS NULL
                      AND NOT EXISTS (
                        SELECT 1
                        FROM procedimentos_bancas_aplicacoes a
                        WHERE a.procedimento_id = e.procedimento_id
                          AND a.user_id = e.user_id
                          AND a.base_id = e.base_id
                          AND a.bookmaker_id = ca.id
                      )
                    )
                    OR (
                      e.parceiro_id IS NOT NULL
                      AND NOT EXISTS (
                        SELECT 1
                        FROM procedimentos_parceiros_aplicacoes pa
                        WHERE pa.procedimento_id = e.procedimento_id
                          AND pa.user_id = e.user_id
                          AND pa.base_id = e.base_id
                          AND pa.parceiro_id = e.parceiro_id
                          AND pa.bookmaker_id = ca.id
                      )
                    )
                  )
              )
            ORDER BY p.id ASC
          `,
          [normalizedUserId, normalizedWorkspaceId],
        );

        const rowsWithDetails = await this.attachProcedureDetails(rows, transaction);

        for (const procedure of rowsWithDetails) {
          await this.applyProcedureBookmakerApplications(
            procedure.id,
            {
              entries: (procedure.entradas ?? []).map((entry) => ({
                scope: entry.escopo,
                role: entry.tipo_entrada,
                order: entry.ordem,
                resultKey: entry.resultado_chave,
                house: entry.casa,
                value: entry.valor,
                odd: entry.odd,
                side: entry.lado,
                layOdd: entry.odd_lay,
                commission: entry.comissao_percentual,
                increase: entry.aumento_percentual,
                cashback: entry.cashback_percentual,
                cashbackLossOnly: entry.cashback_apenas_perda,
                freebet: entry.freebet_somente_lucro,
                partnerId: entry.parceiro_id,
              })),
              results: (procedure.resultados ?? []).map((result) => ({
                scope: result.escopo,
                resultKey: result.resultado_chave,
              })),
            },
            normalizedUserId,
            normalizedWorkspaceId,
            transaction,
          );
        }
      };

      if (executor === this.db && typeof this.db.connect === "function") {
        await this.runInTransaction(reconcile);
      } else {
        await reconcile(executor);
      }
    } catch (error) {
      if (isUndefinedTableError(error)) {
        return;
      }

      throw error;
    }
  },

  // Favoritos do usuário; o procedimento continua valendo por base.
  async setProcedureFavorite(userId, procedureId, favorite, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedProcedureId = parseNumber(procedureId);

    if (!normalizedUserId || normalizedProcedureId <= 0) {
      return false;
    }

    if (parseBoolean(favorite)) {
      const { rowCount } = await executor.query(
        `
          INSERT INTO procedimentos_favoritos (user_id, procedimento_id)
          SELECT $1, ph.id
          FROM procedimentos_historico ph
          WHERE ph.id = $2
            AND ph.user_id = $1
          ON CONFLICT DO NOTHING
        `,
        [normalizedUserId, normalizedProcedureId],
      );

      return rowCount > 0;
    }

    await executor.query(
      "DELETE FROM procedimentos_favoritos WHERE user_id = $1 AND procedimento_id = $2",
      [normalizedUserId, normalizedProcedureId],
    );

    return true;
  },

  async listFavoriteProcedureIds(userId, procedureIds = [], executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const ids = [
      ...new Set(
        (Array.isArray(procedureIds) ? procedureIds : [])
          .map((id) => parseNumber(id))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    ];

    if (!normalizedUserId || ids.length === 0) {
      return [];
    }

    const { rows } = await executor.query(
      `
        SELECT procedimento_id
        FROM procedimentos_favoritos
        WHERE user_id = $1
          AND procedimento_id = ANY($2::bigint[])
      `,
      [normalizedUserId, ids],
    );

    return rows.map((row) => parseNumber(row.procedimento_id));
  },

  async attachProcedureDetails(rows, executor = this.db) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    const procedureIds = sourceRows
      .map((row) => parseNumber(row?.id))
      .filter((id) => Number.isInteger(id) && id > 0);

    if (procedureIds.length === 0) {
      return sourceRows;
    }

    let entriesResult;
    let resultsResult;

    try {
      entriesResult = await executor.query(
        `
          SELECT
            procedimento_id,
            escopo,
            tipo_entrada,
            ordem,
            resultado_chave,
            casa,
            valor,
            odd,
            lado,
            odd_lay,
            comissao_percentual,
            aumento_percentual,
            cashback_percentual,
            cashback_apenas_perda,
            freebet_somente_lucro,
            data_operacao,
            parceiro_id,
            (
              SELECT pa.nome
              FROM parceiros pa
              WHERE pa.id = procedimentos_entradas.parceiro_id
                AND pa.user_id = procedimentos_entradas.user_id
            ) AS parceiro_nome
          FROM procedimentos_entradas
          WHERE procedimento_id = ANY($1::bigint[])
          ORDER BY procedimento_id ASC, escopo ASC, ordem ASC, id ASC
        `,
        [procedureIds],
      );
      resultsResult = await executor.query(
        `
          SELECT procedimento_id, escopo, resultado_chave
          FROM procedimentos_resultados
          WHERE procedimento_id = ANY($1::bigint[])
          ORDER BY procedimento_id ASC, escopo ASC, id ASC
        `,
        [procedureIds],
      );
    } catch (error) {
      if (isUndefinedTableError(error)) {
        return sourceRows;
      }

      throw error;
    }

    const entriesByProcedure = new Map();
    const resultsByProcedure = new Map();

    for (const entry of entriesResult.rows) {
      const procedureId = parseNumber(entry.procedimento_id);
      const current = entriesByProcedure.get(procedureId) ?? [];
      current.push({
        escopo: parseText(entry.escopo),
        tipo_entrada: parseText(entry.tipo_entrada),
        ordem: parseNumber(entry.ordem),
        resultado_chave: parseText(entry.resultado_chave),
        casa: parseText(entry.casa),
        valor: parseNumber(entry.valor),
        odd: parseNumber(entry.odd),
        lado: normalizeProcedureDetailSide(entry.lado),
        odd_lay: parseNumber(entry.odd_lay),
        comissao_percentual: parseNumber(entry.comissao_percentual),
        aumento_percentual: parseNumber(entry.aumento_percentual),
        cashback_percentual: parseNumber(entry.cashback_percentual),
        cashback_apenas_perda: parseBoolean(entry.cashback_apenas_perda),
        freebet_somente_lucro: parseBoolean(entry.freebet_somente_lucro),
        data_operacao: parseText(entry.data_operacao).trim(),
        // Sem isso a reconciliação trataria a casa do parceiro como do usuário.
        parceiro_id: normalizeEntryPartnerId(entry.parceiro_id),
        parceiro_nome: entry.parceiro_nome ? parseText(entry.parceiro_nome) : null,
      });
      entriesByProcedure.set(procedureId, current);
    }

    for (const result of resultsResult.rows) {
      const procedureId = parseNumber(result.procedimento_id);
      const current = resultsByProcedure.get(procedureId) ?? [];
      current.push({
        escopo: parseText(result.escopo),
        resultado_chave: parseText(result.resultado_chave),
      });
      resultsByProcedure.set(procedureId, current);
    }

    return sourceRows.map((row) => {
      const procedureId = parseNumber(row?.id);

      return {
        ...row,
        entradas: entriesByProcedure.get(procedureId) ?? [],
        resultados: resultsByProcedure.get(procedureId) ?? [],
      };
    });
  },

  async getProcedureById(procedureId, userId, workspaceId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);
    const { rows } = await executor.query(
      "SELECT * FROM procedimentos_historico WHERE id = $1 AND user_id = $2 AND base_id = $3",
      [procedureId, normalizedUserId, normalizedWorkspaceId],
    );

    const row = (await this.attachProcedureDetails(rows, executor))[0];
    return row ? { ...row } : null;
  },

  async listProcedures(userId, workspaceId, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (!normalizedUserId || normalizedWorkspaceId <= 0) {
      return [];
    }

    const { rows } = await executor.query(
      "SELECT * FROM procedimentos_historico WHERE user_id = $1 AND base_id = $2 ORDER BY id DESC",
      [normalizedUserId, normalizedWorkspaceId],
    );

    const rowsWithDetails = await this.attachProcedureDetails(rows, executor);
    return rowsWithDetails.map((row) => enrichProcedure(row));
  },

  async listFilteredProcedures(userId, workspaceId, filters = {}, executor = this.db) {
    const normalizedUserId = normalizeUserId(userId);
    const normalizedWorkspaceId = parseNumber(workspaceId);

    if (!normalizedUserId || normalizedWorkspaceId <= 0) {
      return {
        items: [],
        page: 1,
        pageSize: 30,
        pageCount: 1,
        totalItems: 0,
      };
    }

    const searchText = parseText(filters.searchText).trim();
    const types = [
      ...new Set(
        normalizeTextArray(filters.types).flatMap((type) =>
          type === "Cassino" ? CASINO_PROCEDURE_TYPES : [type],
        ),
      ),
    ];
    const houses = normalizeTextArray(filters.houses);
    const statuses = normalizeTextArray(filters.statuses).filter((status) =>
      PROCEDURE_STATUSES.includes(status),
    );
    const dateFrom = normalizeIsoDate(filters.dateFrom);
    const dateTo = normalizeIsoDate(filters.dateTo);
    const pageSize = clamp(normalizePositiveInteger(filters.pageSize, 30), 20, 50);
    const requestedPage = normalizePositiveInteger(filters.page, 1);
    const params = [normalizedUserId, normalizedWorkspaceId];
    const conditions = ["user_id = $1", "base_id = $2"];
    const addParam = (value) => {
      params.push(value);
      return `$${params.length}`;
    };
    const buildDateCondition = (operator, placeholder) => `
      (
        (
          data_operacao ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
          AND to_date(data_operacao, 'DD/MM/YYYY') ${operator} ${placeholder}::date
        )
        OR EXISTS (
          SELECT 1
          FROM procedimentos_entradas pe
          WHERE pe.procedimento_id = procedimentos_historico.id
            AND pe.user_id = $1
            AND pe.base_id = $2
            AND pe.data_operacao ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}$'
            AND to_date(pe.data_operacao, 'DD/MM/YYYY') ${operator} ${placeholder}::date
        )
      )
    `;

    if (searchText) {
      const placeholder = addParam(`%${searchText}%`);
      conditions.push(`
        (
          tipo_procedimento ILIKE ${placeholder}
          OR jogo_time_pa ILIKE ${placeholder}
          OR jogo_coleta_freebet ILIKE ${placeholder}
          OR jogo_conversao_freebet ILIKE ${placeholder}
          OR casas_envolvidas ILIKE ${placeholder}
        )
      `);
    }

    if (types.length > 0) {
      conditions.push(`tipo_procedimento = ANY(${addParam(types)}::text[])`);
    }

    if (houses.length > 0) {
      conditions.push(
        `casas_envolvidas ILIKE ANY(${addParam(houses.map((house) => `%${house}%`))}::text[])`,
      );
    }

    if (statuses.length > 0) {
      conditions.push(`status_procedimento = ANY(${addParam(statuses)}::text[])`);
    }

    const multiples = [
      ...new Set(
        normalizeTextArray(filters.multiples)
          .map((value) => Number(value))
          .filter((value) => value >= 2 && value <= 4),
      ),
    ];

    if (multiples.length > 0) {
      conditions.push(`
        EXISTS (
          SELECT 1
          FROM procedimentos_resultados pr
          WHERE pr.procedimento_id = procedimentos_historico.id
            AND pr.user_id = $1
            AND pr.base_id = $2
            AND pr.resultado_chave <> 'defeat'
          GROUP BY pr.escopo
          HAVING LEAST(COUNT(*), 4) = ANY(${addParam(multiples)}::int[])
        )
      `);
    }

    const partnerCondition = buildPartnerFilterCondition(
      "procedimentos_historico",
      normalizePartnerFilter(filters.partners),
      addParam,
    );

    if (partnerCondition) {
      conditions.push(partnerCondition);
    }

    if (parseBoolean(filters.onlyFavorites)) {
      conditions.push(`EXISTS (
          SELECT 1
          FROM procedimentos_favoritos pf
          WHERE pf.procedimento_id = procedimentos_historico.id
            AND pf.user_id = $1
        )`);
    }

    if (dateFrom) {
      conditions.push(buildDateCondition(">=", addParam(dateFrom)));
    }

    if (dateTo) {
      conditions.push(buildDateCondition("<=", addParam(dateTo)));
    }

    const whereClause = conditions.join(" AND ");
    const countResult = await executor.query(
      `
        SELECT COUNT(*)::integer AS total
        FROM procedimentos_historico
        WHERE ${whereClause}
      `,
      params,
    );
    const totalItems = parseNumber(countResult.rows[0]?.total);
    const pageCount = Math.max(Math.ceil(totalItems / pageSize), 1);
    const page = clamp(requestedPage, 1, pageCount);
    const rowParams = [...params, pageSize, (page - 1) * pageSize];
    const limitPlaceholder = `$${rowParams.length - 1}`;
    const offsetPlaceholder = `$${rowParams.length}`;
    const { rows } = await executor.query(
      `
        SELECT
          procedimentos_historico.*,
          EXISTS (
          SELECT 1
          FROM procedimentos_favoritos pf
          WHERE pf.procedimento_id = procedimentos_historico.id
            AND pf.user_id = $1
        ) AS favorito
        FROM procedimentos_historico
        WHERE ${whereClause}
        ORDER BY favorito DESC, id DESC
        LIMIT ${limitPlaceholder}
        OFFSET ${offsetPlaceholder}
      `,
      rowParams,
    );

    const rowsWithDetails = await this.attachProcedureDetails(rows, executor);

    return {
      items: rowsWithDetails.map((row) => enrichProcedure(row)),
      page,
      pageSize,
      pageCount,
      totalItems,
    };
  },

  async updateProcedure(procedureId, data, userId, workspaceId, executor = this.db) {
    const current = await this.getProcedureById(procedureId, userId, workspaceId, executor);
    if (!current) {
      throw new Error(`Procedimento ${procedureId} nao encontrado.`);
    }

    const normalized = normalizeDatabaseData({
      ...current,
      ...data,
    });

    await executor.query(
      `
        UPDATE procedimentos_historico SET
          data_operacao = $1,
          tipo_procedimento = $2,
          casas_envolvidas = $3,
          jogo_time_pa = $4,
          jogo_coleta_freebet = $5,
          jogo_conversao_freebet = $6,
          lote_conversao_freebet = $7,
          lucro_final = $8,
          bateu_duplo = $9,
          condicao_freebet = $10,
          valor_freebet_coletada = $11,
          observacao = $12,
          mes_referencia = $13,
          casa_destino_freebet = $14,
          status_freebet = $15,
          status_procedimento = $16,
          id_freebet_origem = $17,
          valor_da_freebet = $18,
          ganhou_freebet = $19
        WHERE id = $20
          AND user_id = $21
          AND base_id = $22
      `,
      [
        normalized.data_operacao,
        normalized.tipo_procedimento,
        normalized.casas_envolvidas,
        normalized.jogo_time_pa,
        normalized.jogo_coleta_freebet,
        normalized.jogo_conversao_freebet,
        normalized.lote_conversao_freebet,
        normalized.lucro_final,
        normalized.bateu_duplo,
        normalized.condicao_freebet,
        normalized.valor_freebet_coletada,
        normalized.observacao,
        normalized.mes_referencia,
        normalized.casa_destino_freebet,
        normalized.status_freebet,
        normalized.status_procedimento,
        normalized.id_freebet_origem,
        normalized.valor_da_freebet,
        normalized.ganhou_freebet,
        procedureId,
        normalizeUserId(userId),
        parseNumber(workspaceId),
      ],
    );
  },

  async updateProcedureWithDetails(procedureId, data, details, userId, workspaceId) {
    await this.runInTransaction(async (executor) => {
      await this.reverseProcedureBookmakerApplications(
        procedureId,
        userId,
        workspaceId,
        executor,
      );
      await this.updateProcedure(procedureId, data, userId, workspaceId, executor);
      await this.replaceProcedureDetails(
        procedureId,
        details,
        userId,
        workspaceId,
        executor,
      );
      await this.applyProcedureBookmakerApplications(
        procedureId,
        details,
        userId,
        workspaceId,
        executor,
      );
    });
  },

  async deleteProcedure(procedureId, userId, workspaceId, executor = this.db) {
    await this.reverseProcedureBookmakerApplications(
      procedureId,
      userId,
      workspaceId,
      executor,
    );
    await executor.query(
      "DELETE FROM procedimentos_historico WHERE id = $1 AND user_id = $2 AND base_id = $3",
      [procedureId, normalizeUserId(userId), parseNumber(workspaceId)],
    );
  },

  async captureAndDeleteProcedure(procedureId, userId, workspaceId, executor = this.db) {
    const procedure = await this.getProcedureById(procedureId, userId, workspaceId, executor);
    if (procedure) {
      await this.deleteProcedure(procedureId, userId, workspaceId, executor);
    }

    return procedure;
  },

  async restoreProcedure(data, userId, workspaceId, executor = this.db) {
    return this.saveProcedure(data, userId, workspaceId, executor);
  },

  async updateDoubleStatus(procedureId, hitDouble, userId, workspaceId, executor = this.db) {
    await executor.query(
      `
        UPDATE procedimentos_historico
        SET bateu_duplo = $1
        WHERE id = $2
          AND user_id = $3
          AND base_id = $4
      `,
      [parseBoolean(hitDouble), procedureId, normalizeUserId(userId), parseNumber(workspaceId)],
    );
  },

  async updateProcedureStatus(procedureId, status, userId, workspaceId, executor = this.db) {
    await executor.query(
      `
        UPDATE procedimentos_historico
        SET status_procedimento = $1
        WHERE id = $2
          AND user_id = $3
          AND base_id = $4
      `,
      [status, procedureId, normalizeUserId(userId), parseNumber(workspaceId)],
    );
  },
};
