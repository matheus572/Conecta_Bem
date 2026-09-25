-- 014_curso.sql — Tabela de cursos e oficinas (RF_30, §4.9).
-- `quantidade_vagas` é informativa no nível do curso; o controle efetivo de
-- vagas (RN02) é feito por turma, via `turma.capacidade` (015_turma.sql).
CREATE TABLE IF NOT EXISTS `curso` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(255) NOT NULL,
  `descricao` TEXT NULL DEFAULT NULL,
  `carga_horaria` INT UNSIGNED NOT NULL,
  `quantidade_vagas` INT UNSIGNED NOT NULL,
  `status` ENUM('ATIVO', 'INATIVO') NOT NULL DEFAULT 'ATIVO',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_curso_nome` (`nome`),
  KEY `idx_curso_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
