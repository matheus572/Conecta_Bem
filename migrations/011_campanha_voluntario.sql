-- 011_campanha_voluntario.sql — Associação N:N entre campanha e voluntário
-- (RF_23). O `UNIQUE (campanha_id, voluntario_id)` impede associação duplicada
-- (segunda defesa; a verificação amigável é feita no service). A participação
-- registrada aqui cumpre também o histórico de participação (RF_19).
CREATE TABLE IF NOT EXISTS `campanha_voluntario` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `campanha_id` INT UNSIGNED NOT NULL,
  `voluntario_id` INT UNSIGNED NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_campanha_voluntario` (`campanha_id`, `voluntario_id`),
  KEY `idx_campanha_voluntario_voluntario` (`voluntario_id`),
  CONSTRAINT `fk_campanha_voluntario_campanha` FOREIGN KEY (`campanha_id`)
    REFERENCES `campanha` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_campanha_voluntario_voluntario` FOREIGN KEY (`voluntario_id`)
    REFERENCES `voluntario` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;