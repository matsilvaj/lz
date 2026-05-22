ALTER TABLE procedimentos_historico
  ADD COLUMN IF NOT EXISTS status_procedimento TEXT NOT NULL DEFAULT 'Concluído';

UPDATE procedimentos_historico
SET status_procedimento = 'Concluído'
WHERE status_procedimento IS NULL
   OR btrim(status_procedimento) = '';

CREATE INDEX IF NOT EXISTS procedimentos_historico_user_base_status_procedimento_idx
  ON procedimentos_historico (user_id, base_id, status_procedimento, id DESC);
