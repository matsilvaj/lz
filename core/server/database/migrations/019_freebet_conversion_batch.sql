ALTER TABLE IF EXISTS procedimentos_historico
  ADD COLUMN IF NOT EXISTS lote_conversao_freebet TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS procedimentos_historico_user_base_lote_conversao_freebet_idx
  ON procedimentos_historico (user_id, base_id, lote_conversao_freebet)
  WHERE lote_conversao_freebet <> '';
