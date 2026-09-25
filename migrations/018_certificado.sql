-- 018_certificado.sql — Certificados de conclusão (RF_35, UC13, §10.2).
-- Vinculado à matrícula (que liga beneficiário ↔ turma ↔ curso), com
-- `codigo_validacao` único (RF_35) e `UNIQUE(matricula_id)` impedindo emissão
-- duplicada para a mesma matrícula.
CREATE TABLE IF NOT EXISTS `certificado` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `matricula_id` INT UNSIGNED NOT NULL,
  `data_emissao` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `codigo_validacao` VARCHAR(64) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_certificado_codigo` (`codigo_validacao`),
  UNIQUE KEY `uq_certificado_matricula` (`matricula_id`),
  CONSTRAINT `fk_certificado_matricula` FOREIGN KEY (`matricula_id`)
    REFERENCES `matricula` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
