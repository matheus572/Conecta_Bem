-- 010_campanha.sql — Tabela de campanhas e ações sociais (RF_22, RF_25).
-- O CHECK `data_fim >= data_inicio` implementa a regra de UC11 ("datas
-- inconsistentes → mensagem de erro"); a validação também é feita na camada de
-- aplicação antes de chegar ao banco (mensagem amigável).
CREATE TABLE IF NOT EXISTS `campanha` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `titulo` VARCHAR(255) NOT NULL,
  `descricao` TEXT NULL DEFAULT NULL,
  `data_inicio` DATE NOT NULL,
  `data_fim` DATE NOT NULL,
  `status` ENUM('PLANEJADA', 'ATIVA', 'ENCERRADA') NOT NULL DEFAULT 'PLANEJADA',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_campanha_status` (`status`),
  KEY `idx_campanha_datas` (`data_inicio`, `data_fim`),
  CONSTRAINT `chk_campanha_data_fim_apos_inicio` CHECK (`data_fim` >= `data_inicio`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;