DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM procedimentos_historico
    WHERE user_id IS NULL
  ) AND EXISTS (
    SELECT 1
    FROM auth.users
    LIMIT 1
  ) THEN
    UPDATE procedimentos_historico
    SET user_id = (
      SELECT id
      FROM auth.users
      ORDER BY created_at ASC
      LIMIT 1
    )
    WHERE user_id IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM procedimentos_historico
    WHERE user_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Existem procedimentos sem user_id. Corrija os dados antes de continuar.';
  END IF;
END $$;

ALTER TABLE procedimentos_historico
  ALTER COLUMN user_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS procedimentos_historico_user_id_id_desc_idx
  ON procedimentos_historico (user_id, id DESC);

CREATE INDEX IF NOT EXISTS procedimentos_historico_user_id_tipo_status_idx
  ON procedimentos_historico (user_id, tipo_procedimento, status_freebet);

CREATE INDEX IF NOT EXISTS procedimentos_historico_user_id_id_freebet_origem_idx
  ON procedimentos_historico (user_id, id_freebet_origem);

DROP INDEX IF EXISTS procedimentos_historico_mes_referencia_idx;
DROP INDEX IF EXISTS procedimentos_historico_tipo_procedimento_idx;
DROP INDEX IF EXISTS procedimentos_historico_status_freebet_idx;
DROP INDEX IF EXISTS procedimentos_historico_id_freebet_origem_idx;

ALTER TABLE casas_de_apostas
  DROP COLUMN IF EXISTS saldo;
