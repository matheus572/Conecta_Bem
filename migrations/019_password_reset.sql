-- 019_password_reset.sql — tokens de recuperação de senha (RF_03, UC01
-- fluxo alternativo "Esqueci minha senha").
--
-- O token só é armazenado como hash SHA-256 (`token_hash`): o valor em claro
-- vai apenas no e-mail, e mesmo com vazamento do banco não é possível usar os
-- links de reset. Tokens expiram em poucos minutos (TTL no service) e são
-- marcados como usados (`used_at`) após a redefinição — ver decisões Sprint 5.
CREATE TABLE `password_reset` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `usuario_id` INT UNSIGNED NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `expires_at` TIMESTAMP NOT NULL,
  `used_at` TIMESTAMP NULL DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_password_reset_token_hash` (`token_hash`),
  KEY `idx_password_reset_usuario` (`usuario_id`),
  KEY `idx_password_reset_expires` (`expires_at`),
  CONSTRAINT `fk_password_reset_usuario`
    FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
