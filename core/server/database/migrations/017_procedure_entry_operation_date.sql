ALTER TABLE IF EXISTS procedimentos_entradas
  ADD COLUMN IF NOT EXISTS data_operacao TEXT NOT NULL DEFAULT '';
