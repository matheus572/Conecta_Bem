-- 022_movimentacao_item.sql — doacao/distribuicao passam a referenciar o item
-- (Sprint 6). `item_id` nasce NULLável para não quebrar os registros
-- históricos (Sprints 2–5); o vínculo retroativo é feito em
-- 024_backfill_item_generico.sql. `tipo_doacao` é MANTIDO como estava
-- (compatibilidade com relatórios por tipo e com os registros antigos).
ALTER TABLE `doacao`
  ADD COLUMN `item_id` INT UNSIGNED NULL DEFAULT NULL AFTER `tipo_doacao`,
  ADD KEY `idx_doacao_item` (`item_id`),
  ADD CONSTRAINT `fk_doacao_item` FOREIGN KEY (`item_id`)
    REFERENCES `item_doacao` (`id`) ON DELETE RESTRICT;

ALTER TABLE `distribuicao`
  ADD COLUMN `item_id` INT UNSIGNED NULL DEFAULT NULL AFTER `tipo_doacao`,
  ADD KEY `idx_distribuicao_item` (`item_id`),
  ADD CONSTRAINT `fk_distribuicao_item` FOREIGN KEY (`item_id`)
    REFERENCES `item_doacao` (`id`) ON DELETE RESTRICT;
