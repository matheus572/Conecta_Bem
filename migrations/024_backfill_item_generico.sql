-- 024_backfill_item_generico.sql — MIGRAÇÃO DE DADOS (passo explícito e
-- documentado da Sprint 6, decidido com o time — ver docs/decisoes.md).
--
-- As doações/distribuições registradas nas Sprints 2–5 possuem apenas
-- `tipo_doacao` e NÃO podem ser retroativamente atribuídas a um item
-- específico sem inventar informação. Estratégia adotada:
--
--   1. Para cada tipo, cria-se um item genérico "Outros [tipo]" (catch-all).
--   2. O saldo agregado atual (e o estoque mínimo já configurado) de cada
--      tipo é migrado de `estoque_legado` para a linha de estoque do item
--      genérico correspondente — saldo total preservado.
--   3. doacao/distribuicao históricas (item_id NULL) são vinculadas ao item
--      genérico do seu tipo.
--
-- A partir desta sprint, novas movimentações devem referenciar um item
-- específico; o genérico permanece disponível apenas como catch-all.
--
-- Os nomes abaixo DEVEM bater com NOME_ITEM_GENERICO em
-- src/utils/tiposDoacao.js (usado por seed.js e pelos testes de migração).
INSERT INTO `item_doacao` (`nome_item`, `tipo_doacao`, `unidade`)
SELECT nome, tipo, 'UN' FROM (
  SELECT 'Outros Alimentos' AS nome, 'ALIMENTOS' AS tipo
  UNION ALL SELECT 'Outros Roupas', 'ROUPAS'
  UNION ALL SELECT 'Outros Móveis e utensílios', 'MOVEIS_UTENSILIOS'
  UNION ALL SELECT 'Outros (diversos)', 'OUTROS'
) AS genericos
WHERE NOT EXISTS (
  SELECT 1 FROM `item_doacao` i
   WHERE i.tipo_doacao = genericos.tipo AND i.nome_item = genericos.nome
);

INSERT INTO `estoque` (`item_id`, `quantidade`, `estoque_minimo`)
SELECT el.tipo_doacao_id AS item_id, el.quantidade, el.estoque_minimo
FROM (
  SELECT i.id AS tipo_doacao_id, leg.quantidade, leg.estoque_minimo, leg.tipo_doacao
    FROM `estoque_legado` leg
    JOIN `item_doacao` i
      ON i.tipo_doacao = leg.tipo_doacao AND i.nome_item LIKE 'Outros%'
) el
WHERE NOT EXISTS (SELECT 1 FROM `estoque` e WHERE e.item_id = el.tipo_doacao_id);

UPDATE `doacao` d
  JOIN `item_doacao` i ON i.tipo_doacao = d.tipo_doacao AND i.nome_item LIKE 'Outros%'
   SET d.item_id = i.id
 WHERE d.item_id IS NULL;

UPDATE `distribuicao` di
  JOIN `item_doacao` i ON i.tipo_doacao = di.tipo_doacao AND i.nome_item LIKE 'Outros%'
   SET di.item_id = i.id
 WHERE di.item_id IS NULL;
