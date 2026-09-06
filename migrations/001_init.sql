-- 001_init.sql — Tabela de controle do runner de migrations
CREATE TABLE IF NOT EXISTS `_migrations` (
  `name` VARCHAR(255) NOT NULL,
  `applied_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;