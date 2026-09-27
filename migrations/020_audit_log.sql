-- 020_audit_log.sql — log de auditoria de acesso a dados pessoais sensíveis
-- (LGPD §11.3): quem (usuario_id)/quando (created_at)/o quê (acao + entidade).
--
-- Decisão (Sprint 5): o log NÃO armazena o payload da operação (CPF, situação
-- socioeconômica etc.), apenas metadados — minimização de dados (RNF_04). A
-- política de retenção/expurgo destes logs fica pendente de definição do
-- stakeholder (ver docs/decisoes.md).
CREATE TABLE IF NOT EXISTS `audit_log` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `usuario_id` INT UNSIGNED NULL DEFAULT NULL,
  `acao` ENUM('CONSULTA', 'CRIACAO', 'EDICAO', 'EXCLUSAO') NOT NULL,
  `entidade` VARCHAR(50) NOT NULL,
  `entidade_id` INT UNSIGNED NULL DEFAULT NULL,
  `detalhe` VARCHAR(255) NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_log_entidade` (`entidade`, `entidade_id`),
  KEY `idx_audit_log_usuario` (`usuario_id`),
  CONSTRAINT `fk_audit_log_usuario`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
