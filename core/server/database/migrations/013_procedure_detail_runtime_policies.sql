DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lz_runtime') THEN
    CREATE POLICY lz_runtime_manage_procedimentos_entradas
      ON procedimentos_entradas
      FOR ALL
      TO lz_runtime
      USING (true)
      WITH CHECK (true);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lz_runtime') THEN
    CREATE POLICY lz_runtime_manage_procedimentos_resultados
      ON procedimentos_resultados
      FOR ALL
      TO lz_runtime
      USING (true)
      WITH CHECK (true);
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
