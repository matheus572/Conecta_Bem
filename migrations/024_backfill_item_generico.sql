-- 024_backfill_item_generico.sql — MIGRAÇÃO DE DADOS histórica da Sprint 6.
--
-- ── ATUALIZAÇÃO — Sprint 8 (decisão nº 44) ─────────────────────────────────
-- A criação automática dos itens genéricos "Outros [tipo]" foi REMOVIDA desta
-- migration: com a criação sob demanda de itens no registro de doação
-- (Sprint 7), o "catch-all" genérico deixou de ser necessário. Bases novas
-- (incluindo o banco de desenvolvimento, zerado manualmente antes desta
-- sprint) não recebem mais esses registros.
-- Os UPSERTs/UPDATEs abaixo só agem em bases antigas em que os genéricos JÁ
-- existiam (bases criadas entre as Sprints 6 e 7 com dados legacy); em bases
-- novas são no-op por construção. Nenhuma nova migration foi criada — ver
-- docs/decisoes.md para o racional completo.
-- ───────────────────────────────────────────────────────────────────────────
--
-- Em bases criadas na Sprint 6 que ainda tenham os itens genéricos, preserva
-- o saldo de estoque_legado no item genérico e vincula retroativamente as
-- movimentações históricas (item_id NULL) ao item genérico do tipo.
INSERT INTO `estoque` (`item_id`, `quantidade`, `estoque_minimo`)
SELECT i.id, leg.quantidade, leg.estoque_minimo
  FROM `estoque_legado` leg
  JOIN `item_doacao` i ON i.tipo_doacao = leg.tipo_doacao AND i.nome_item LIKE 'Outros%'
 WHERE NOT EXISTS (SELECT 1 FROM `estoque` e WHERE e.item_id = i.id);

UPDATE `doacao` d
  JOIN `item_doacao` i ON i.tipo_doacao = d.tipo_doacao AND i.nome_item LIKE 'Outros%'
   SET d.item_id = i.id
 WHERE d.item_id IS NULL;

UPDATE `distribuicao` di
  JOIN `item_doacao` i ON i.tipo_doacao = di.tipo_doacao AND i.nome_item LIKE 'Outros%'
   SET di.item_id = i.id
 WHERE di.item_id IS NULL;
