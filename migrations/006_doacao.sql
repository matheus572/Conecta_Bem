-- 006_doacao.sql — Registro de doações recebidas (RF_13).
-- O campo `valor` existe no modelo conceitual (§10) mas doações em dinheiro
-- estão fora do escopo da Sprint 2 (ver docs/decisoes.md) — a coluna fica
-- reservada e não é exposta nas telas.
CREATE TABLE IF NOT EXISTS `doacao` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `doador_id` INT UNSIGNED NOT NULL,
  `tipo_doacao` ENUM('ALIMENTOS', 'ROUPAS', 'MOVEIS_UTENSILIOS', 'OUTROS') NOT NULL,
  `quantidade` DECIMAL(10,2) NOT NULL,
  `valor` DECIMAL(10,2) NULL DEFAULT NULL,
  `descricao` VARCHAR(255) NULL DEFAULT NULL,
  `data_doacao` DATE NOT NULL,
  `usuario_id` INT UNSIGNED NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_doacao_data_tipo` (`data_doacao`, `tipo_doacao`),
  KEY `idx_doacao_doador` (`doador_id`),
  CONSTRAINT `chk_doacao_quantidade_positiva` CHECK (`quantidade` > 0),
  CONSTRAINT `fk_doacao_doador` FOREIGN KEY (`doador_id`)
    REFERENCES `doador` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_doacao_usuario` FOREIGN KEY (`usuario_id`)
    REFERENCES `usuario` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
