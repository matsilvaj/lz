CREATE TABLE IF NOT EXISTS casas_de_apostas (
  id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  saldo DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS procedimentos_historico (
  id BIGSERIAL PRIMARY KEY,
  data_operacao TEXT NOT NULL,
  tipo_procedimento TEXT NOT NULL,
  casas_envolvidas TEXT NOT NULL DEFAULT '',
  jogo_time_pa TEXT NOT NULL DEFAULT '',
  lucro_final DOUBLE PRECISION NOT NULL,
  bateu_duplo BOOLEAN NOT NULL DEFAULT FALSE,
  condicao_freebet TEXT NOT NULL DEFAULT '',
  valor_freebet_coletada DOUBLE PRECISION NOT NULL DEFAULT 0,
  observacao TEXT NOT NULL DEFAULT '',
  mes_referencia TEXT NOT NULL,
  casa_destino_freebet TEXT NOT NULL DEFAULT '',
  status_freebet TEXT NOT NULL DEFAULT 'N/A',
  id_freebet_origem BIGINT REFERENCES procedimentos_historico(id) ON DELETE SET NULL,
  valor_da_freebet DOUBLE PRECISION NOT NULL DEFAULT 0,
  ganhou_freebet TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS procedimentos_historico_mes_referencia_idx
  ON procedimentos_historico (mes_referencia);

CREATE INDEX IF NOT EXISTS procedimentos_historico_tipo_procedimento_idx
  ON procedimentos_historico (tipo_procedimento);

CREATE INDEX IF NOT EXISTS procedimentos_historico_status_freebet_idx
  ON procedimentos_historico (status_freebet);

CREATE INDEX IF NOT EXISTS procedimentos_historico_id_freebet_origem_idx
  ON procedimentos_historico (id_freebet_origem);
