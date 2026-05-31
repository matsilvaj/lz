CREATE TABLE IF NOT EXISTS procedimentos_bancas_aplicacoes (
  id BIGSERIAL PRIMARY KEY,
  procedimento_id BIGINT NOT NULL REFERENCES procedimentos_historico(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  base_id BIGINT NOT NULL,
  bookmaker_id BIGINT NOT NULL REFERENCES casas_de_apostas(id) ON DELETE CASCADE,
  saldo_delta DOUBLE PRECISION NOT NULL DEFAULT 0,
  saldo_anterior DOUBLE PRECISION NOT NULL DEFAULT 0,
  saldo_resultante DOUBLE PRECISION NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT procedimentos_bancas_aplicacoes_user_base_fkey
    FOREIGN KEY (user_id, base_id)
    REFERENCES bases_usuario(user_id, id)
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS procedimentos_bancas_aplicacoes_procedimento_bookmaker_idx
  ON procedimentos_bancas_aplicacoes (procedimento_id, bookmaker_id);

CREATE INDEX IF NOT EXISTS procedimentos_bancas_aplicacoes_user_base_idx
  ON procedimentos_bancas_aplicacoes (user_id, base_id);

ALTER TABLE IF EXISTS procedimentos_bancas_aplicacoes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE procedimentos_bancas_aplicacoes FROM anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lz_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE procedimentos_bancas_aplicacoes TO lz_runtime;
    GRANT USAGE, SELECT ON SEQUENCE procedimentos_bancas_aplicacoes_id_seq TO lz_runtime;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lz_runtime')
    AND NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'procedimentos_bancas_aplicacoes'
        AND policyname = 'lz_runtime_manage_procedimentos_bancas_aplicacoes'
    )
  THEN
    CREATE POLICY lz_runtime_manage_procedimentos_bancas_aplicacoes
      ON procedimentos_bancas_aplicacoes
      FOR ALL TO lz_runtime
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
