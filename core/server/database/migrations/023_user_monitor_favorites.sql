-- Jogos e campeonatos favoritos do monitor, por usuário.
CREATE TABLE IF NOT EXISTS user_monitor_favorites (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  chave TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, tipo, chave),
  CONSTRAINT user_monitor_favorites_tipo_check CHECK (tipo IN ('jogo', 'campeonato')),
  CONSTRAINT user_monitor_favorites_chave_length CHECK (char_length(chave) BETWEEN 1 AND 200)
);

ALTER TABLE IF EXISTS user_monitor_favorites ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE user_monitor_favorites FROM anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lz_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_monitor_favorites TO lz_runtime;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lz_runtime') THEN
    CREATE POLICY lz_runtime_manage_user_monitor_favorites
      ON user_monitor_favorites
      FOR ALL
      TO lz_runtime
      USING (true)
      WITH CHECK (true);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
