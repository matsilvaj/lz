ALTER TABLE IF EXISTS procedimentos_entradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS procedimentos_resultados ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE procedimentos_entradas FROM anon, authenticated;
REVOKE ALL ON TABLE procedimentos_resultados FROM anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lz_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE procedimentos_entradas TO lz_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE procedimentos_resultados TO lz_runtime;
    GRANT USAGE, SELECT ON SEQUENCE procedimentos_entradas_id_seq TO lz_runtime;
    GRANT USAGE, SELECT ON SEQUENCE procedimentos_resultados_id_seq TO lz_runtime;
  END IF;
END $$;
