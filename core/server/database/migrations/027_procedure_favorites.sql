-- Procedimentos favoritos do usuário (só acrescenta; nada existente muda).
CREATE TABLE IF NOT EXISTS procedimentos_favoritos (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  procedimento_id BIGINT NOT NULL REFERENCES procedimentos_historico(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, procedimento_id)
);

CREATE INDEX IF NOT EXISTS procedimentos_favoritos_procedimento_idx
  ON procedimentos_favoritos (procedimento_id);

ALTER TABLE IF EXISTS procedimentos_favoritos ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE procedimentos_favoritos FROM anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lz_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE procedimentos_favoritos TO lz_runtime;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lz_runtime') THEN
    CREATE POLICY lz_runtime_manage_procedimentos_favoritos
      ON procedimentos_favoritos
      FOR ALL
      TO lz_runtime
      USING (true)
      WITH CHECK (true);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
