-- 003_beneficiario.sql — Tabela de beneficiários (RF_05–08, RN04).
-- Soft delete via `ativo` + `deleted_at` (decisão de modelagem: aplicar a
-- exclusão lógica também a beneficiário, conforme validado com o time).
-- O campo `ativo` representa o "status" citado na documentação (RF_08) e é
-- usado na busca por status.
CREATE TABLE IF NOT EXISTS `beneficiario` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(255) NOT NULL,
  `cpf` CHAR(11) NOT NULL,
  `data_nascimento` DATE NULL DEFAULT NULL,
  `telefone` VARCHAR(20) NULL DEFAULT NULL,
  `endereco` VARCHAR(255) NULL DEFAULT NULL,
  `situacao_social` VARCHAR(255) NULL DEFAULT NULL,
  `ativo` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_beneficiario_cpf` (`cpf`),
  KEY `idx_beneficiario_nome` (`nome`),
  KEY `idx_beneficiario_ativo` (`ativo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;