-- 017_frequencia.sql — Frequência por matrícula e aula (RF_33, §2.1 #14).
-- `UNIQUE(matricula_id, data_aula)` impede lançar frequência duplicada na
-- mesma aula. A regra RN01 (3 faltas consecutivas) é verificada na camada de
-- service, na mesma transação do lançamento.
CREATE TABLE IF NOT EXISTS `frequencia` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `matricula_id` INT UNSIGNED NOT NULL,
  `data_aula` DATE NOT NULL,
  `presenca` TINYINT(1) NOT NULL,
  `observacao` VARCHAR(255) NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_frequencia_matricula_aula` (`matricula_id`, `data_aula`),
  KEY `idx_frequencia_matricula_data` (`matricula_id`, `data_aula`),
  CONSTRAINT `fk_frequencia_matricula` FOREIGN KEY (`matricula_id`)
    REFERENCES `matricula` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
