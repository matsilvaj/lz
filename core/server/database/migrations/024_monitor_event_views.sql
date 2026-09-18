-- Acessos à página de cada jogo do monitor: uma linha por usuário e jogo, atualizada a cada abertura.
CREATE TABLE IF NOT EXISTS monitor_event_views (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fixture_id TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, fixture_id),
  CONSTRAINT monitor_event_views_fixture_length CHECK (char_length(fixture_id) BETWEEN 1 AND 200)
);

CREATE INDEX IF NOT EXISTS monitor_event_views_recent_idx
  ON monitor_event_views (viewed_at DESC, starts_at);

ALTER TABLE IF EXISTS monitor_event_views ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE monitor_event_views FROM anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lz_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE monitor_event_views TO lz_runtime;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lz_runtime') THEN
    CREATE POLICY lz_runtime_manage_monitor_event_views
      ON monitor_event_views
      FOR ALL
      TO lz_runtime
      USING (true)
      WITH CHECK (true);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
