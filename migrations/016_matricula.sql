-- 016_matricula.sql — Matrícula de beneficiário em turma (RF_32, RN02, §10.2).
-- O plano (§2.1 #13) pede `UNIQUE(turma_id, beneficiario_id)` "para ativa":
-- como o MySQL não tem índice parcial, usamos a coluna gerada
-- `beneficiario_ativo_id` (preenchida apenas quando status = 'ATIVA' e NULL
-- nos demais casos — UNIQUE ignora duplicatas de NULL). Isso garante, no
-- banco, que um beneficiário tenha no máximo UMA matrícula ativa por turma,
-- sem impedir nova matrícula após um cancelamento (RN01) ou conclusão.
CREATE TABLE IF NOT EXISTS `matricula` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `turma_id` INT UNSIGNED NOT NULL,
  `beneficiario_id` INT UNSIGNED NOT NULL,
  `data_matricula` DATE NOT NULL DEFAULT (CURRENT_DATE),
  `status` ENUM('ATIVA', 'CONCLUIDA', 'CANCELADA') NOT NULL DEFAULT 'ATIVA',
  `quantidade_faltas` INT UNSIGNED NOT NULL DEFAULT 0,
  `beneficiario_ativo_id` INT UNSIGNED GENERATED ALWAYS AS (
    IF(`status` = 'ATIVA', `beneficiario_id`, NULL)
  ) STORED,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_matricula_ativa_turma` (`turma_id`, `beneficiario_ativo_id`),
  KEY `idx_matricula_turma_status` (`turma_id`, `status`),
  KEY `idx_matricula_beneficiario` (`beneficiario_id`),
  CONSTRAINT `fk_matricula_turma` FOREIGN KEY (`turma_id`)
    REFERENCES `turma` (`id`),
  CONSTRAINT `fk_matricula_beneficiario` FOREIGN KEY (`beneficiario_id`)
    REFERENCES `beneficiario` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
