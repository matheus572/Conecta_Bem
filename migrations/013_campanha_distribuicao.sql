-- 013_campanha_distribuicao.sql — Vínculo de "doação distribuída" à campanha
-- (RF_24). Reaproveita a tabela `distribuicao` (doação distribuída) adicionando
-- uma FK opcional `campanha_id`, sem duplicar dados.
ALTER TABLE `distribuicao`
  ADD COLUMN `campanha_id` INT UNSIGNED NULL DEFAULT NULL AFTER `beneficiario_id`,
  ADD KEY `idx_distribuicao_campanha` (`campanha_id`),
  ADD CONSTRAINT `fk_distribuicao_campanha` FOREIGN KEY (`campanha_id`)
    REFERENCES `campanha` (`id`) ON DELETE SET NULL;