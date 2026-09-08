-- 009_voluntario.sql — Tabela de voluntários (RF_18–21, RN04).
-- Soft delete via `ativo` + `deleted_at` (RF_20 / §11.2). CPF único (RN04).
-- `especialidade` representa as "habilidades" (RF_18) e `disponibilidade` os
-- horários disponíveis (RF_18), ambos pesquisáveis (RF_21).
CREATE TABLE IF NOT EXISTS `voluntario` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(255) NOT NULL,
  `cpf` CHAR(11) NOT NULL,
  `telefone` VARCHAR(20) NULL DEFAULT NULL,
  `especialidade` VARCHAR(255) NULL DEFAULT NULL,
  `disponibilidade` VARCHAR(255) NULL DEFAULT NULL,
  `ativo` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_voluntario_cpf` (`cpf`),
  KEY `idx_voluntario_nome` (`nome`),
  KEY `idx_voluntario_ativo` (`ativo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;