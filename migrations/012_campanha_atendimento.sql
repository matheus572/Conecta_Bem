-- 012_campanha_atendimento.sql — Vínculo de "beneficiário atendido" à
-- campanha (RF_24). Reaproveita a tabela `atendimento` (beneficiário atendido)
-- adicionando uma FK opcional `campanha_id`, sem duplicar dados.
ALTER TABLE `atendimento`
  ADD COLUMN `campanha_id` INT UNSIGNED NULL DEFAULT NULL AFTER `beneficiario_id`,
  ADD KEY `idx_atendimento_campanha` (`campanha_id`),
  ADD CONSTRAINT `fk_atendimento_campanha` FOREIGN KEY (`campanha_id`)
    REFERENCES `campanha` (`id`) ON DELETE SET NULL;