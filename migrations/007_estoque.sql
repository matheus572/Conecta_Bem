-- 007_estoque.sql — Estoque agregado por tipo de doação (RF_14, RF_16).
-- Decisão validada com o time (ver docs/decisoes.md): o estoque é controlado
-- por TIPO de doação (não por item específico), então o modelo conceitual foi
-- simplificado — `nome_item`/`unidade`/`localizacao` dão lugar a uma linha por
-- tipo, com `quantidade` saldo atual e `estoque_minimo` (RF_16/RF_S04) por tipo.
-- O CHECK impede estoque negativo como segunda defesa; a verificação principal
-- (RN03) acontece na transação com SELECT ... FOR UPDATE.
CREATE TABLE IF NOT EXISTS `estoque` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `tipo_doacao` ENUM('ALIMENTOS', 'ROUPAS', 'MOVEIS_UTENSILIOS', 'OUTROS') NOT NULL,
  `quantidade` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `estoque_minimo` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_estoque_tipo` (`tipo_doacao`),
  CONSTRAINT `chk_estoque_quantidade_nao_negativa` CHECK (`quantidade` >= 0),
  CONSTRAINT `chk_estoque_minimo_nao_negativo` CHECK (`estoque_minimo` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
