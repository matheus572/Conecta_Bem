-- 023_estoque_por_item.sql — Reestruturação do estoque: de saldo por TIPO
-- (decisão nº 8, superada) para saldo por ITEM (Sprint 6).
--
-- A tabela antiga é PRESERVADA como `estoque_legado` (read-only, referência
-- auditável da migração) e a nova `estoque` já é criada com o mesmo nome —
-- os consumidores (doacoes, relatórios, dashboard) são adaptados no código.
RENAME TABLE `estoque` TO `estoque_legado`;

CREATE TABLE `estoque` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `item_id` INT UNSIGNED NOT NULL,
  `quantidade` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `estoque_minimo` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_estoque_item` (`item_id`),
  CONSTRAINT `fk_estoque_item` FOREIGN KEY (`item_id`)
    REFERENCES `item_doacao` (`id`),
  -- Nomes de CHECK distintos dos da tabela legada (o InnoDB exige nomes de
  -- constraint únicos por schema; a tabela antiga segue como estoque_legado).
  CONSTRAINT `chk_estoque_item_qtd_nao_negativa` CHECK (`quantidade` >= 0),
  CONSTRAINT `chk_estoque_item_min_nao_negativo` CHECK (`estoque_minimo` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
