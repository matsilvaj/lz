-- Converte os workspaces antigos em parceiros (autorizado pelo cliente).
-- Cada usuário passa a usar só a primeira base. As demais são esvaziadas:
--   * procedimentos, entradas e resultados vão para a base principal;
--   * as bases 271, 221 e 326 são histórico do próprio usuário: entram sem parceiro;
--   * as outras viram um parceiro com o nome do workspace, e as entradas movidas
--     passam a ter esse parceiro como dono (quem já tinha dono não muda);
--   * as casas da base antiga viram casas do parceiro (ou do usuário, nos três
--     casos acima), somando o saldo quando a casa já existir;
--   * os lançamentos de saldo antigos saem, porque o sistema os refaz na
--     reconciliação, já na banca certa.
-- As bases antigas continuam no banco, vazias, e as tabelas backup_028_* guardam
-- as linhas como estavam antes.
-- O executor de migrações roda o arquivo numa transação: se algo falhar, nada muda.

CREATE TABLE IF NOT EXISTS backup_028_bases_usuario AS
SELECT b.*
FROM bases_usuario b
WHERE b.id IN (271, 221, 326, 307, 272, 92, 54, 309, 335, 57, 97, 225, 252, 332);

CREATE TABLE IF NOT EXISTS backup_028_procedimentos_historico AS
SELECT p.*
FROM procedimentos_historico p
WHERE p.base_id IN (271, 221, 326, 307, 272, 92, 54, 309, 335, 57, 97, 225, 252, 332);

CREATE TABLE IF NOT EXISTS backup_028_procedimentos_entradas AS
SELECT e.*
FROM procedimentos_entradas e
WHERE e.base_id IN (271, 221, 326, 307, 272, 92, 54, 309, 335, 57, 97, 225, 252, 332);

CREATE TABLE IF NOT EXISTS backup_028_procedimentos_resultados AS
SELECT r.*
FROM procedimentos_resultados r
WHERE r.base_id IN (271, 221, 326, 307, 272, 92, 54, 309, 335, 57, 97, 225, 252, 332);

CREATE TABLE IF NOT EXISTS backup_028_usuarios_bancas AS
SELECT u.*
FROM usuarios_bancas u
WHERE u.base_id IN (271, 221, 326, 307, 272, 92, 54, 309, 335, 57, 97, 225, 252, 332);

CREATE TABLE IF NOT EXISTS backup_028_bancas_aplicacoes AS
SELECT a.*
FROM procedimentos_bancas_aplicacoes a
WHERE a.base_id IN (271, 221, 326, 307, 272, 92, 54, 309, 335, 57, 97, 225, 252, 332);

DO $$
DECLARE
  base_antiga record;
  base_principal bigint;
  parceiro bigint;
  nome_parceiro text;
  -- Histórico do próprio usuário: entra na conta principal sem virar parceiro.
  sem_parceiro bigint[] := ARRAY[271, 221, 326];
BEGIN
  FOR base_antiga IN
    SELECT ordenadas.id, ordenadas.user_id, ordenadas.nome
    FROM (
      SELECT
        b.*,
        row_number() OVER (PARTITION BY b.user_id ORDER BY b.id) AS posicao
      FROM bases_usuario b
    ) ordenadas
    WHERE ordenadas.posicao > 1
    ORDER BY ordenadas.user_id, ordenadas.id
  LOOP
    SELECT min(id) INTO base_principal
    FROM bases_usuario
    WHERE user_id = base_antiga.user_id;

    parceiro := NULL;

    IF NOT (base_antiga.id = ANY(sem_parceiro)) THEN
      nome_parceiro := left(
        coalesce(nullif(btrim(base_antiga.nome), ''), 'Workspace ' || base_antiga.id),
        60
      );

      SELECT id INTO parceiro
      FROM parceiros
      WHERE user_id = base_antiga.user_id
        AND lower(nome) = lower(nome_parceiro)
        AND removido_em IS NULL;

      IF parceiro IS NULL THEN
        INSERT INTO parceiros (user_id, nome)
        VALUES (base_antiga.user_id, nome_parceiro)
        RETURNING id INTO parceiro;
      END IF;

      INSERT INTO parceiros_bancas (user_id, base_id, parceiro_id, bookmaker_id, saldo)
      SELECT base_antiga.user_id, base_principal, parceiro, ub.bookmaker_id, ub.saldo
      FROM usuarios_bancas ub
      WHERE ub.base_id = base_antiga.id
      ON CONFLICT (base_id, parceiro_id, bookmaker_id)
      DO UPDATE SET saldo = parceiros_bancas.saldo + EXCLUDED.saldo;
    ELSE
      INSERT INTO usuarios_bancas (user_id, base_id, bookmaker_id, saldo)
      SELECT base_antiga.user_id, base_principal, ub.bookmaker_id, ub.saldo
      FROM usuarios_bancas ub
      WHERE ub.base_id = base_antiga.id
      ON CONFLICT (base_id, bookmaker_id)
      DO UPDATE SET saldo = usuarios_bancas.saldo + EXCLUDED.saldo;
    END IF;

    DELETE FROM usuarios_bancas WHERE base_id = base_antiga.id;
    DELETE FROM procedimentos_bancas_aplicacoes WHERE base_id = base_antiga.id;
    DELETE FROM procedimentos_parceiros_aplicacoes WHERE base_id = base_antiga.id;

    UPDATE procedimentos_entradas
    SET base_id = base_principal,
        parceiro_id = coalesce(parceiro_id, parceiro)
    WHERE base_id = base_antiga.id;

    UPDATE procedimentos_resultados
    SET base_id = base_principal
    WHERE base_id = base_antiga.id;

    UPDATE procedimentos_historico
    SET base_id = base_principal
    WHERE base_id = base_antiga.id;
  END LOOP;
END $$;
