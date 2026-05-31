ALTER TABLE IF EXISTS procedimentos_historico
  ADD COLUMN IF NOT EXISTS jogo_coleta_freebet TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS jogo_conversao_freebet TEXT NOT NULL DEFAULT '';
