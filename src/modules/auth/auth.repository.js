// auth.repository.js — acesso a dados de autenticação (apenas SQL).
import { pool } from '../../config/db.js';

/** Busca um usuário ativo pelo e-mail (retorna null se não existir). */
async function findByEmail(email) {
  const [rows] = await pool.query(
    'SELECT `id`, `nome`, `email`, `senha_hash`, `perfil`, `ativo` ' +
      'FROM `usuario` WHERE `email` = ? AND `ativo` = 1 AND `deleted_at` IS NULL LIMIT 1',
    [email],
  );
  return rows[0] || null;
}

/** Cria um token de recuperação de senha (RF_03). O token já chega hasheado. */
async function criarReset({ usuarioId, tokenHash, expiraEm }) {
  await pool.query(
    'INSERT INTO `password_reset` (`usuario_id`, `token_hash`, `expires_at`) VALUES (?, ?, ?)',
    [usuarioId, tokenHash, expiraEm],
  );
}

/** Invalida tokens pendentes anteriores do usuário (só o link mais recente vale). */
async function invalidarResetsPendentes(usuarioId) {
  await pool.query(
    'UPDATE `password_reset` SET `used_at` = NOW() WHERE `usuario_id` = ? AND `used_at` IS NULL',
    [usuarioId],
  );
}

/** Busca um token de reset pelo hash (retorna null se não existir). */
async function findResetPorHash(tokenHash) {
  const [rows] = await pool.query(
    'SELECT `id`, `usuario_id`, `expires_at`, `used_at` FROM `password_reset` WHERE `token_hash` = ? LIMIT 1',
    [tokenHash],
  );
  return rows[0] || null;
}

async function marcarResetUsado(id) {
  await pool.query('UPDATE `password_reset` SET `used_at` = NOW() WHERE `id` = ?', [id]);
}

async function atualizarSenha(usuarioId, senhaHash) {
  await pool.query('UPDATE `usuario` SET `senha_hash` = ? WHERE `id` = ?', [senhaHash, usuarioId]);
}

export {
  findByEmail,
  criarReset,
  invalidarResetsPendentes,
  findResetPorHash,
  marcarResetUsado,
  atualizarSenha,
};