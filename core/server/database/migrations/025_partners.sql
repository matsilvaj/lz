-- Parceiros: casas que o usuário opera em nome de outra pessoa.
-- Só acrescenta tabelas e uma coluna opcional; nada existente é alterado.

CREATE TABLE IF NOT EXISTS parceiros (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Excluir só marca a data: procedimentos antigos continuam mostrando o nome.
  removido_em TIMESTAMPTZ,
  CONSTRAINT parceiros_nome_length CHECK (char_length(nome) BETWEEN 1 AND 60),
  CONSTRAINT parceiros_id_user_key UNIQUE (id, user_id)
);

-- Um nome ativo por usuário (sem diferenciar maiúsculas).
CREATE UNIQUE INDEX IF NOT EXISTS parceiros_user_nome_ativo_idx
  ON parceiros (user_id, lower(nome))
  WHERE removido_em IS NULL;

-- Casa atrelada a um parceiro, com saldo próprio (ex.: Bet365 · Maria).
CREATE TABLE IF NOT EXISTS parceiros_bancas (
  user_id UUID NOT NULL,
  base_id BIGINT NOT NULL,
  parceiro_id BIGINT NOT NULL,
  bookmaker_id BIGINT NOT NULL REFERENCES casas_de_apostas(id) ON DELETE CASCADE,
  saldo DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (base_id, parceiro_id, bookmaker_id),
  CONSTRAINT parceiros_bancas_user_base_fkey
    FOREIGN KEY (user_id, base_id) REFERENCES bases_usuario(user_id, id) ON DELETE CASCADE,
  CONSTRAINT parceiros_bancas_parceiro_fkey
    FOREIGN KEY (parceiro_id, user_id) REFERENCES parceiros(id, user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS parceiros_bancas_user_base_idx
  ON parceiros_bancas (user_id, base_id);

-- Ajuste de saldo que um procedimento fez na casa do parceiro.
CREATE TABLE IF NOT EXISTS procedimentos_parceiros_aplicacoes (
  id BIGSERIAL PRIMARY KEY,
  procedimento_id BIGINT NOT NULL REFERENCES procedimentos_historico(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  base_id BIGINT NOT NULL,
  parceiro_id BIGINT NOT NULL,
  bookmaker_id BIGINT NOT NULL REFERENCES casas_de_apostas(id) ON DELETE CASCADE,
  saldo_delta DOUBLE PRECISION NOT NULL DEFAULT 0,
  saldo_anterior DOUBLE PRECISION NOT NULL DEFAULT 0,
  saldo_resultante DOUBLE PRECISION NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT procedimentos_parceiros_aplicacoes_user_base_fkey
    FOREIGN KEY (user_id, base_id) REFERENCES bases_usuario(user_id, id) ON DELETE CASCADE,
  CONSTRAINT procedimentos_parceiros_aplicacoes_parceiro_fkey
    FOREIGN KEY (parceiro_id, user_id) REFERENCES parceiros(id, user_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS procedimentos_parceiros_aplicacoes_proc_parceiro_casa_idx
  ON procedimentos_parceiros_aplicacoes (procedimento_id, parceiro_id, bookmaker_id);

CREATE INDEX IF NOT EXISTS procedimentos_parceiros_aplicacoes_user_base_idx
  ON procedimentos_parceiros_aplicacoes (user_id, base_id);

-- Entrada feita na casa de um parceiro (vazio = casa do próprio usuário).
-- Coluna opcional e sem valor padrão: não reescreve a tabela.
ALTER TABLE procedimentos_entradas
  ADD COLUMN IF NOT EXISTS parceiro_id BIGINT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'procedimentos_entradas_parceiro_fkey'
  ) THEN
    -- O parceiro precisa ser do mesmo usuário da entrada.
    ALTER TABLE procedimentos_entradas
      ADD CONSTRAINT procedimentos_entradas_parceiro_fkey
      FOREIGN KEY (parceiro_id, user_id) REFERENCES parceiros(id, user_id)
      ON DELETE SET NULL (parceiro_id)
      NOT VALID;
  END IF;
END $$;

ALTER TABLE procedimentos_entradas
  VALIDATE CONSTRAINT procedimentos_entradas_parceiro_fkey;

CREATE INDEX IF NOT EXISTS procedimentos_entradas_parceiro_idx
  ON procedimentos_entradas (user_id, parceiro_id)
  WHERE parceiro_id IS NOT NULL;

-- Segurança: só o papel do sistema acessa, como nas demais tabelas.
ALTER TABLE parceiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE parceiros_bancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedimentos_parceiros_aplicacoes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE parceiros FROM anon, authenticated;
REVOKE ALL ON TABLE parceiros_bancas FROM anon, authenticated;
REVOKE ALL ON TABLE procedimentos_parceiros_aplicacoes FROM anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lz_runtime') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE parceiros TO lz_runtime;
    GRANT USAGE, SELECT ON SEQUENCE parceiros_id_seq TO lz_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE parceiros_bancas TO lz_runtime;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE procedimentos_parceiros_aplicacoes TO lz_runtime;
    GRANT USAGE, SELECT ON SEQUENCE procedimentos_parceiros_aplicacoes_id_seq TO lz_runtime;
  END IF;
END $$;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lz_runtime') THEN
    RETURN;
  END IF;

  FOREACH table_name IN ARRAY ARRAY['parceiros', 'parceiros_bancas', 'procedimentos_parceiros_aplicacoes']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = table_name
        AND policyname = 'lz_runtime_manage_' || table_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL TO lz_runtime USING (true) WITH CHECK (true)',
        'lz_runtime_manage_' || table_name,
        table_name
      );
    END IF;
  END LOOP;
END $$;
