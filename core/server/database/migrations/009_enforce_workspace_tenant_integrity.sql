DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'bases_usuario'
      AND constraint_name = 'bases_usuario_user_id_id_key'
  ) THEN
    ALTER TABLE bases_usuario
      ADD CONSTRAINT bases_usuario_user_id_id_key UNIQUE (user_id, id);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM procedimentos_historico ph
    LEFT JOIN bases_usuario bu
      ON bu.user_id = ph.user_id
     AND bu.id = ph.base_id
    WHERE bu.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Existem procedimentos vinculados a uma base de outro usuario.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM usuarios_bancas ub
    LEFT JOIN bases_usuario bu
      ON bu.user_id = ub.user_id
     AND bu.id = ub.base_id
    WHERE bu.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Existem bancas vinculadas a uma base de outro usuario.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM usuarios_observacoes_bancas uob
    LEFT JOIN bases_usuario bu
      ON bu.user_id = uob.user_id
     AND bu.id = uob.base_id
    WHERE bu.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Existem observacoes de bancas vinculadas a uma base de outro usuario.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'procedimentos_historico'
      AND constraint_name = 'procedimentos_historico_user_base_fkey'
  ) THEN
    ALTER TABLE procedimentos_historico
      ADD CONSTRAINT procedimentos_historico_user_base_fkey
      FOREIGN KEY (user_id, base_id)
      REFERENCES bases_usuario (user_id, id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'procedimentos_historico_user_base_fkey'
      AND conrelid = 'procedimentos_historico'::regclass
      AND NOT convalidated
  ) THEN
    ALTER TABLE procedimentos_historico
      VALIDATE CONSTRAINT procedimentos_historico_user_base_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'usuarios_bancas'
      AND constraint_name = 'usuarios_bancas_user_base_fkey'
  ) THEN
    ALTER TABLE usuarios_bancas
      ADD CONSTRAINT usuarios_bancas_user_base_fkey
      FOREIGN KEY (user_id, base_id)
      REFERENCES bases_usuario (user_id, id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'usuarios_bancas_user_base_fkey'
      AND conrelid = 'usuarios_bancas'::regclass
      AND NOT convalidated
  ) THEN
    ALTER TABLE usuarios_bancas
      VALIDATE CONSTRAINT usuarios_bancas_user_base_fkey;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_name = 'usuarios_observacoes_bancas'
      AND constraint_name = 'usuarios_observacoes_bancas_user_base_fkey'
  ) THEN
    ALTER TABLE usuarios_observacoes_bancas
      ADD CONSTRAINT usuarios_observacoes_bancas_user_base_fkey
      FOREIGN KEY (user_id, base_id)
      REFERENCES bases_usuario (user_id, id)
      ON DELETE CASCADE
      NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'usuarios_observacoes_bancas_user_base_fkey'
      AND conrelid = 'usuarios_observacoes_bancas'::regclass
      AND NOT convalidated
  ) THEN
    ALTER TABLE usuarios_observacoes_bancas
      VALIDATE CONSTRAINT usuarios_observacoes_bancas_user_base_fkey;
  END IF;
END $$;
