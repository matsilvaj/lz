CREATE TABLE IF NOT EXISTS procedimentos_entradas (
  id BIGSERIAL PRIMARY KEY,
  procedimento_id BIGINT NOT NULL REFERENCES procedimentos_historico(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  base_id BIGINT NOT NULL,
  escopo TEXT NOT NULL DEFAULT 'sports',
  tipo_entrada TEXT NOT NULL DEFAULT 'principal',
  ordem INTEGER NOT NULL DEFAULT 0,
  resultado_chave TEXT NOT NULL DEFAULT 'principal',
  casa TEXT NOT NULL DEFAULT '',
  valor DOUBLE PRECISION NOT NULL DEFAULT 0,
  odd DOUBLE PRECISION NOT NULL DEFAULT 0,
  lado TEXT NOT NULL DEFAULT 'back',
  odd_lay DOUBLE PRECISION NOT NULL DEFAULT 0,
  comissao_percentual DOUBLE PRECISION NOT NULL DEFAULT 0,
  aumento_percentual DOUBLE PRECISION NOT NULL DEFAULT 0,
  cashback_percentual DOUBLE PRECISION NOT NULL DEFAULT 0,
  freebet_somente_lucro BOOLEAN NOT NULL DEFAULT FALSE,
  data_operacao TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT procedimentos_entradas_user_base_fkey
    FOREIGN KEY (user_id, base_id)
    REFERENCES bases_usuario (user_id, id)
    ON DELETE CASCADE,
  CONSTRAINT procedimentos_entradas_lado_check
    CHECK (lado IN ('back', 'lay')),
  CONSTRAINT procedimentos_entradas_escopo_check
    CHECK (escopo IN ('sports', 'freebet_collection', 'freebet_conversion')),
  CONSTRAINT procedimentos_entradas_tipo_check
    CHECK (tipo_entrada IN ('principal', 'protecao'))
);

CREATE UNIQUE INDEX IF NOT EXISTS procedimentos_entradas_procedimento_escopo_resultado_idx
  ON procedimentos_entradas (procedimento_id, escopo, resultado_chave);

CREATE INDEX IF NOT EXISTS procedimentos_entradas_user_base_casa_idx
  ON procedimentos_entradas (user_id, base_id, casa);

CREATE INDEX IF NOT EXISTS procedimentos_entradas_user_base_procedimento_idx
  ON procedimentos_entradas (user_id, base_id, procedimento_id);

CREATE TABLE IF NOT EXISTS procedimentos_resultados (
  id BIGSERIAL PRIMARY KEY,
  procedimento_id BIGINT NOT NULL REFERENCES procedimentos_historico(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  base_id BIGINT NOT NULL,
  escopo TEXT NOT NULL DEFAULT 'sports',
  resultado_chave TEXT NOT NULL DEFAULT 'principal',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT procedimentos_resultados_user_base_fkey
    FOREIGN KEY (user_id, base_id)
    REFERENCES bases_usuario (user_id, id)
    ON DELETE CASCADE,
  CONSTRAINT procedimentos_resultados_escopo_check
    CHECK (escopo IN ('sports', 'freebet_collection', 'freebet_conversion'))
);

CREATE UNIQUE INDEX IF NOT EXISTS procedimentos_resultados_procedimento_escopo_resultado_idx
  ON procedimentos_resultados (procedimento_id, escopo, resultado_chave);

CREATE INDEX IF NOT EXISTS procedimentos_resultados_user_base_procedimento_idx
  ON procedimentos_resultados (user_id, base_id, procedimento_id);
