ALTER TABLE IF EXISTS casas_de_apostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS procedimentos_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS usuarios_bancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS usuarios_observacoes_bancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bases_usuario ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE casas_de_apostas FROM anon, authenticated;
REVOKE ALL ON TABLE procedimentos_historico FROM anon, authenticated;
REVOKE ALL ON TABLE usuarios_bancas FROM anon, authenticated;
REVOKE ALL ON TABLE usuarios_observacoes_bancas FROM anon, authenticated;
REVOKE ALL ON TABLE bases_usuario FROM anon, authenticated;

DO $$
BEGIN
  IF to_regclass('public.schema_migrations') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE public.schema_migrations FROM anon, authenticated';
  END IF;
END $$;

REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
