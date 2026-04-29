CREATE INDEX IF NOT EXISTS procedimentos_historico_user_base_mes_id_idx
  ON procedimentos_historico (user_id, base_id, mes_referencia, id DESC);

CREATE INDEX IF NOT EXISTS procedimentos_historico_user_base_mes_tipo_idx
  ON procedimentos_historico (user_id, base_id, mes_referencia, tipo_procedimento);

CREATE INDEX IF NOT EXISTS procedimentos_historico_user_base_data_idx
  ON procedimentos_historico (user_id, base_id, data_operacao);

CREATE INDEX IF NOT EXISTS procedimentos_historico_user_base_tipo_id_idx
  ON procedimentos_historico (user_id, base_id, tipo_procedimento, id DESC);
