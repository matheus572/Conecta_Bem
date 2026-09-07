-- 004_doador.sql — Tabela de doadores PF/PJ (RF_09–12).
-- Soft delete via `ativo` + `deleted_at` (RF_11 / §11.2).
CREATE TABLE IF NOT EXISTS `doador` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(255) NOT NULL,
  `tipo_doador` ENUM('PF', 'PJ') NOT NULL,
  `documento` VARCHAR(14) NOT NULL,
  `telefone` VARCHAR(20) NULL DEFAULT NULL,
  `endereco` VARCHAR(255) NULL DEFAULT NULL,
  `ativo` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_doador_documento` (`documento`),
  KEY `idx_doador_nome` (`nome`),
  KEY `idx_doador_tipo` (`tipo_doador`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;