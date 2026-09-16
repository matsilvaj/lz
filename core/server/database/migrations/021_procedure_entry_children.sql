-- Linhas filhas: dividem a stake de uma entrada e compartilham a chave de resultado da mãe.
ALTER TABLE procedimentos_entradas
  DROP CONSTRAINT IF EXISTS procedimentos_entradas_tipo_check;

ALTER TABLE procedimentos_entradas
  ADD CONSTRAINT procedimentos_entradas_tipo_check
  CHECK (tipo_entrada IN ('principal', 'protecao', 'filha'));

DROP INDEX IF EXISTS procedimentos_entradas_procedimento_escopo_resultado_idx;

CREATE UNIQUE INDEX IF NOT EXISTS procedimentos_entradas_procedimento_escopo_resultado_ordem_idx
  ON procedimentos_entradas (procedimento_id, escopo, resultado_chave, tipo_entrada, ordem);
