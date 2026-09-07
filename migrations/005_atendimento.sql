-- 005_atendimento.sql — Histórico de atendimentos de beneficiários (RF_07).
-- A tabela existe desde já para sustentar o histórico; o preenchimento será
-- feito em sprints futuras conforme o módulo de doações/atendimento evoluir.
CREATE TABLE IF NOT EXISTS `atendimento` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `beneficiario_id` INT UNSIGNED NOT NULL,
  `data_atendimento` DATETIME NOT NULL,
  `descricao` VARCHAR(255) NULL DEFAULT NULL,
  `observacao` TEXT NULL DEFAULT NULL,
  `usuario_id` INT UNSIGNED NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_atendimento_beneficiario` (`beneficiario_id`),
  KEY `idx_atendimento_data` (`data_atendimento`),
  CONSTRAINT `fk_atendimento_beneficiario` FOREIGN KEY (`beneficiario_id`)
    REFERENCES `beneficiario` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_atendimento_usuario` FOREIGN KEY (`usuario_id`)
    REFERENCES `usuario` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;