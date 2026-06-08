CREATE TABLE IF NOT EXISTS user_active_sessions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_active_sessions_session_id_length
    CHECK (char_length(session_id) BETWEEN 1 AND 128)
);

CREATE INDEX IF NOT EXISTS user_active_sessions_session_id_idx
  ON user_active_sessions (session_id);

ALTER TABLE IF EXISTS user_active_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE user_active_sessions FROM anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lz_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_active_sessions TO lz_runtime;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lz_runtime') THEN
    CREATE POLICY lz_runtime_manage_user_active_sessions
      ON user_active_sessions
      FOR ALL
      TO lz_runtime
      USING (true)
      WITH CHECK (true);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
