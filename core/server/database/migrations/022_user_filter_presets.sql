-- Filtro padrão por tela, definido pelo usuário e válido em qualquer aparelho.
CREATE TABLE IF NOT EXISTS user_filter_presets (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tela TEXT NOT NULL,
  filtros JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, tela),
  CONSTRAINT user_filter_presets_tela_length CHECK (char_length(tela) BETWEEN 1 AND 60)
);

ALTER TABLE IF EXISTS user_filter_presets ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE user_filter_presets FROM anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lz_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_filter_presets TO lz_runtime;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lz_runtime') THEN
    CREATE POLICY lz_runtime_manage_user_filter_presets
      ON user_filter_presets
      FOR ALL
      TO lz_runtime
      USING (true)
      WITH CHECK (true);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
