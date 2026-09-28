-- 021_item_doacao.sql — Catálogo de itens para granularidade por item no
-- estoque (Sprint 6 — SUPERSEDES decisão nº 8, ver docs/decisoes.md).
--
-- O tipo da doação (RF_13) continua existindo aqui em `tipo_doacao` e nas
-- tabelas de movimentação, para agrupamentos e relatórios por tipo (RF_26).
-- O saldo passa a ser por ITEM (ver 023_estoque_por_item.sql).
CREATE TABLE IF NOT EXISTS `item_doacao` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nome_item` VARCHAR(120) NOT NULL,
  `tipo_doacao` ENUM('ALIMENTOS', 'ROUPAS', 'MOVEIS_UTENSILIOS', 'OUTROS') NOT NULL,
  `unidade` VARCHAR(20) NOT NULL DEFAULT 'UN',
  `ativo` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_item_nome_tipo` (`nome_item`, `tipo_doacao`),
  KEY `idx_item_tipo` (`tipo_doacao`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
