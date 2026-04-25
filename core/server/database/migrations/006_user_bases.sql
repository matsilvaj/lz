CREATE TABLE IF NOT EXISTS bases_usuario (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bases_usuario_user_id_idx
  ON bases_usuario (user_id, created_at, id);

CREATE UNIQUE INDEX IF NOT EXISTS bases_usuario_user_id_nome_lower_idx
  ON bases_usuario (user_id, lower(nome));

INSERT INTO bases_usuario (user_id, nome)
SELECT auth_user.id, 'Minha base'
FROM auth.users auth_user
ON CONFLICT DO NOTHING;

ALTER TABLE procedimentos_historico
  ADD COLUMN IF NOT EXISTS base_id BIGINT;

UPDATE procedimentos_historico ph
SET base_id = (
  SELECT bu.id
  FROM bases_usuario bu
  WHERE bu.user_id = ph.user_id
  ORDER BY bu.created_at ASC, bu.id ASC
  LIMIT 1
)
WHERE ph.base_id IS NULL;

ALTER TABLE procedimentos_historico
  ALTER COLUMN base_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'procedimentos_historico'
      AND constraint_name = 'procedimentos_historico_base_id_fkey'
  ) THEN
    ALTER TABLE procedimentos_historico
      ADD CONSTRAINT procedimentos_historico_base_id_fkey
      FOREIGN KEY (base_id) REFERENCES bases_usuario(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS procedimentos_historico_user_id_base_id_idx
  ON procedimentos_historico (user_id, base_id, id DESC);

CREATE INDEX IF NOT EXISTS procedimentos_historico_user_id_base_id_mes_referencia_idx
  ON procedimentos_historico (user_id, base_id, mes_referencia);

CREATE INDEX IF NOT EXISTS procedimentos_historico_user_id_base_id_status_freebet_idx
  ON procedimentos_historico (user_id, base_id, status_freebet);

ALTER TABLE usuarios_bancas
  ADD COLUMN IF NOT EXISTS base_id BIGINT;

UPDATE usuarios_bancas ub
SET base_id = (
  SELECT bu.id
  FROM bases_usuario bu
  WHERE bu.user_id = ub.user_id
  ORDER BY bu.created_at ASC, bu.id ASC
  LIMIT 1
)
WHERE ub.base_id IS NULL;

ALTER TABLE usuarios_bancas
  ALTER COLUMN base_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'usuarios_bancas'
      AND constraint_name = 'usuarios_bancas_base_id_fkey'
  ) THEN
    ALTER TABLE usuarios_bancas
      ADD CONSTRAINT usuarios_bancas_base_id_fkey
      FOREIGN KEY (base_id) REFERENCES bases_usuario(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE usuarios_bancas
  DROP CONSTRAINT IF EXISTS usuarios_bancas_pkey;

ALTER TABLE usuarios_bancas
  ADD CONSTRAINT usuarios_bancas_pkey PRIMARY KEY (base_id, bookmaker_id);

CREATE INDEX IF NOT EXISTS usuarios_bancas_user_id_base_id_idx
  ON usuarios_bancas (user_id, base_id);

ALTER TABLE usuarios_observacoes_bancas
  ADD COLUMN IF NOT EXISTS base_id BIGINT;

UPDATE usuarios_observacoes_bancas uob
SET base_id = (
  SELECT bu.id
  FROM bases_usuario bu
  WHERE bu.user_id = uob.user_id
  ORDER BY bu.created_at ASC, bu.id ASC
  LIMIT 1
)
WHERE uob.base_id IS NULL;

ALTER TABLE usuarios_observacoes_bancas
  ALTER COLUMN base_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'usuarios_observacoes_bancas'
      AND constraint_name = 'usuarios_observacoes_bancas_base_id_fkey'
  ) THEN
    ALTER TABLE usuarios_observacoes_bancas
      ADD CONSTRAINT usuarios_observacoes_bancas_base_id_fkey
      FOREIGN KEY (base_id) REFERENCES bases_usuario(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE usuarios_observacoes_bancas
  DROP CONSTRAINT IF EXISTS usuarios_observacoes_bancas_pkey;

ALTER TABLE usuarios_observacoes_bancas
  ADD CONSTRAINT usuarios_observacoes_bancas_pkey PRIMARY KEY (base_id);

CREATE INDEX IF NOT EXISTS usuarios_observacoes_bancas_user_id_base_id_idx
  ON usuarios_observacoes_bancas (user_id, base_id);
