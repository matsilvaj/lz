-- Unifica casas cadastradas em duplicidade no catálogo (mesma casa, grafias diferentes).
-- Regras combinadas com o cliente:
--   * quem tinha só uma das versões fica com a casa unificada e o mesmo saldo;
--   * quem tinha as duas fica com uma banca só, somando os saldos;
--   * exceção: nas grafias que só mudam nas maiúsculas (4Play, Jogo de Ouro) o código
--     lançava a mesma aposta nas duas versões; ali, saldos iguais contam uma vez só.
-- O executor de migrações roda o arquivo numa transação: se algo falhar, nada muda.

CREATE TEMP TABLE casa_merge (
  old_nome text NOT NULL,
  new_nome text NOT NULL,
  case_only boolean NOT NULL,
  old_id bigint,
  new_id bigint
);

INSERT INTO casa_merge (old_nome, new_nome, case_only) VALUES
  ('4play', '4Play', true),
  ('Jogo de ouro', 'Jogo de Ouro', true),
  ('Apostabet', 'Aposta Bet', false),
  ('Bolsa de Apostas', 'Bolsa de Aposta', false),
  ('Sportybet', 'Sporty Bet', false),
  ('McGames', 'Mc Games', false),
  ('Bet Pix 365', 'Betpix365', false),
  ('Sorteonline', 'Sorte Online', false),
  ('7k Bet', 'Bet7k', false);

UPDATE casa_merge m
SET old_id = o.id, new_id = n.id
FROM casas_de_apostas o, casas_de_apostas n
WHERE o.nome = m.old_nome
  AND n.nome = m.new_nome;

-- Pares já unificados (reexecução) ficam de fora.
DELETE FROM casa_merge WHERE old_id IS NULL OR new_id IS NULL;

-- Bancas do usuário ------------------------------------------------------------
UPDATE usuarios_bancas n
SET saldo = CASE
  WHEN m.case_only AND n.saldo = o.saldo THEN n.saldo
  ELSE n.saldo + o.saldo
END
FROM usuarios_bancas o, casa_merge m
WHERE o.bookmaker_id = m.old_id
  AND n.bookmaker_id = m.new_id
  AND n.base_id = o.base_id;

DELETE FROM usuarios_bancas o
USING casa_merge m, usuarios_bancas n
WHERE o.bookmaker_id = m.old_id
  AND n.bookmaker_id = m.new_id
  AND n.base_id = o.base_id;

UPDATE usuarios_bancas ub
SET bookmaker_id = m.new_id
FROM casa_merge m
WHERE ub.bookmaker_id = m.old_id;

-- Bancas de parceiros ------------------------------------------------------------
UPDATE parceiros_bancas n
SET saldo = CASE
  WHEN m.case_only AND n.saldo = o.saldo THEN n.saldo
  ELSE n.saldo + o.saldo
END
FROM parceiros_bancas o, casa_merge m
WHERE o.bookmaker_id = m.old_id
  AND n.bookmaker_id = m.new_id
  AND n.base_id = o.base_id
  AND n.parceiro_id = o.parceiro_id;

DELETE FROM parceiros_bancas o
USING casa_merge m, parceiros_bancas n
WHERE o.bookmaker_id = m.old_id
  AND n.bookmaker_id = m.new_id
  AND n.base_id = o.base_id
  AND n.parceiro_id = o.parceiro_id;

UPDATE parceiros_bancas pb
SET bookmaker_id = m.new_id
FROM casa_merge m
WHERE pb.bookmaker_id = m.old_id;

-- Lançamentos de saldo dos procedimentos ----------------------------------------
-- Mesmo procedimento nas duas versões: nas grafias só de maiúsculas era o mesmo
-- lançamento repetido (fica um); nas demais, os valores se somam.
UPDATE procedimentos_bancas_aplicacoes n
SET saldo_delta = n.saldo_delta + o.saldo_delta,
    saldo_resultante = n.saldo_resultante + o.saldo_delta,
    atualizado_em = now()
FROM procedimentos_bancas_aplicacoes o, casa_merge m
WHERE o.bookmaker_id = m.old_id
  AND n.bookmaker_id = m.new_id
  AND n.procedimento_id = o.procedimento_id
  AND NOT m.case_only;

DELETE FROM procedimentos_bancas_aplicacoes o
USING casa_merge m, procedimentos_bancas_aplicacoes n
WHERE o.bookmaker_id = m.old_id
  AND n.bookmaker_id = m.new_id
  AND n.procedimento_id = o.procedimento_id;

UPDATE procedimentos_bancas_aplicacoes a
SET bookmaker_id = m.new_id, atualizado_em = now()
FROM casa_merge m
WHERE a.bookmaker_id = m.old_id;

UPDATE procedimentos_parceiros_aplicacoes n
SET saldo_delta = n.saldo_delta + o.saldo_delta,
    atualizado_em = now()
FROM procedimentos_parceiros_aplicacoes o, casa_merge m
WHERE o.bookmaker_id = m.old_id
  AND n.bookmaker_id = m.new_id
  AND n.procedimento_id = o.procedimento_id
  AND n.parceiro_id = o.parceiro_id
  AND NOT m.case_only;

DELETE FROM procedimentos_parceiros_aplicacoes o
USING casa_merge m, procedimentos_parceiros_aplicacoes n
WHERE o.bookmaker_id = m.old_id
  AND n.bookmaker_id = m.new_id
  AND n.procedimento_id = o.procedimento_id
  AND n.parceiro_id = o.parceiro_id;

UPDATE procedimentos_parceiros_aplicacoes a
SET bookmaker_id = m.new_id, atualizado_em = now()
FROM casa_merge m
WHERE a.bookmaker_id = m.old_id;

-- Nomes gravados nos procedimentos ----------------------------------------------
UPDATE procedimentos_entradas e
SET casa = m.new_nome
FROM casa_merge m
WHERE lower(trim(e.casa)) = lower(m.old_nome);

UPDATE procedimentos_historico h
SET casa_destino_freebet = m.new_nome
FROM casa_merge m
WHERE lower(trim(h.casa_destino_freebet)) = lower(m.old_nome);

-- "Casa A, Casa B": troca cada nome e não repete a mesma casa.
UPDATE procedimentos_historico h
SET casas_envolvidas = (
  SELECT string_agg(x.nome, ', ' ORDER BY x.ordem)
  FROM (
    SELECT COALESCE(m.new_nome, trim(t.nome)) AS nome, min(t.ordem) AS ordem
    FROM unnest(string_to_array(h.casas_envolvidas, ',')) WITH ORDINALITY AS t(nome, ordem)
    LEFT JOIN casa_merge m ON lower(trim(t.nome)) = lower(m.old_nome)
    WHERE trim(t.nome) <> ''
    GROUP BY 1
  ) x
)
WHERE EXISTS (
  SELECT 1
  FROM unnest(string_to_array(h.casas_envolvidas, ',')) AS t(nome)
  JOIN casa_merge m ON lower(trim(t.nome)) = lower(m.old_nome)
);

-- Filtros salvos que citam a grafia antiga.
DO $$
DECLARE
  pair record;
BEGIN
  FOR pair IN SELECT old_nome, new_nome FROM casa_merge LOOP
    UPDATE user_filter_presets
    SET filtros = replace(filtros::text, to_jsonb(pair.old_nome)::text, to_jsonb(pair.new_nome)::text)::jsonb
    WHERE filtros::text LIKE '%' || to_jsonb(pair.old_nome)::text || '%';
  END LOOP;
END $$;

-- Catálogo -----------------------------------------------------------------------
DELETE FROM casas_de_apostas c
USING casa_merge m
WHERE c.id = m.old_id;

-- Impede novas casas que só mudam nas maiúsculas.
CREATE UNIQUE INDEX IF NOT EXISTS casas_de_apostas_nome_lower_key
  ON casas_de_apostas (lower(nome));

DROP TABLE casa_merge;
