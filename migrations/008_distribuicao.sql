-- 008_distribuicao.sql — Distribuição de doações a beneficiários (RF_15).
-- Saída de estoque por tipo; a baixa é feita na mesma transação do registro
-- (RN03), com verificação de saldo via SELECT ... FOR UPDATE.
CREATE TABLE IF NOT EXISTS `distribuicao` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `beneficiario_id` INT UNSIGNED NOT NULL,
  `tipo_doacao` ENUM('ALIMENTOS', 'ROUPAS', 'MOVEIS_UTENSILIOS', 'OUTROS') NOT NULL,
  `quantidade` DECIMAL(10,2) NOT NULL,
  `descricao` VARCHAR(255) NULL DEFAULT NULL,
  `data_distribuicao` DATE NOT NULL,
  `usuario_id` INT UNSIGNED NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_distribuicao_beneficiario` (`beneficiario_id`),
  KEY `idx_distribuicao_data_tipo` (`data_distribuicao`, `tipo_doacao`),
  CONSTRAINT `chk_distribuicao_quantidade_positiva` CHECK (`quantidade` > 0),
  CONSTRAINT `fk_distribuicao_beneficiario` FOREIGN KEY (`beneficiario_id`)
    REFERENCES `beneficiario` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_distribuicao_usuario` FOREIGN KEY (`usuario_id`)
    REFERENCES `usuario` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
