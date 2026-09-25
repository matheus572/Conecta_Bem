-- 015_turma.sql — Tabela de turmas vinculadas a um curso (RF_31, §10.2: N:1).
-- `voluntario_id` (NULL) registra o voluntário responsável pela turma
-- ("Um voluntário pode ministrar várias turmas", 1:N), reaproveitando o módulo
-- de voluntários (Sprint 3). `capacidade` é a base do controle de vagas (RN02).
-- Status ENCERRADA habilita a emissão de certificados (RF_35/UC13).
CREATE TABLE IF NOT EXISTS `turma` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `curso_id` INT UNSIGNED NOT NULL,
  `voluntario_id` INT UNSIGNED NULL DEFAULT NULL,
  `periodo` VARCHAR(100) NOT NULL,
  `horario` VARCHAR(50) NOT NULL,
  `dias_semana` VARCHAR(100) NOT NULL,
  `capacidade` INT UNSIGNED NOT NULL,
  `status` ENUM('PLANEJADA', 'ATIVA', 'ENCERRADA') NOT NULL DEFAULT 'PLANEJADA',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_turma_curso` (`curso_id`),
  KEY `idx_turma_status` (`status`),
  CONSTRAINT `fk_turma_curso` FOREIGN KEY (`curso_id`)
    REFERENCES `curso` (`id`),
  CONSTRAINT `fk_turma_voluntario` FOREIGN KEY (`voluntario_id`)
    REFERENCES `voluntario` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
