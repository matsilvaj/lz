ALTER TABLE procedimentos_historico
  ADD COLUMN IF NOT EXISTS user_id UUID;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users LIMIT 1) THEN
    UPDATE procedimentos_historico
    SET user_id = (
      SELECT id
      FROM auth.users
      ORDER BY created_at ASC
      LIMIT 1
    )
    WHERE user_id IS NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'procedimentos_historico'
      AND constraint_name = 'procedimentos_historico_user_id_fkey'
  ) THEN
    ALTER TABLE procedimentos_historico
      ADD CONSTRAINT procedimentos_historico_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS procedimentos_historico_user_id_idx
  ON procedimentos_historico (user_id);

CREATE INDEX IF NOT EXISTS procedimentos_historico_user_id_mes_referencia_idx
  ON procedimentos_historico (user_id, mes_referencia);

CREATE INDEX IF NOT EXISTS procedimentos_historico_user_id_status_freebet_idx
  ON procedimentos_historico (user_id, status_freebet);

CREATE TABLE IF NOT EXISTS usuarios_bancas (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmaker_id BIGINT NOT NULL REFERENCES casas_de_apostas(id) ON DELETE CASCADE,
  saldo DOUBLE PRECISION NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, bookmaker_id)
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users LIMIT 1) THEN
    INSERT INTO usuarios_bancas (user_id, bookmaker_id, saldo)
    SELECT
      (
        SELECT id
        FROM auth.users
        ORDER BY created_at ASC
        LIMIT 1
      ),
      id,
      saldo
    FROM casas_de_apostas
    WHERE saldo <> 0
    ON CONFLICT (user_id, bookmaker_id) DO NOTHING;
  END IF;
END $$;
