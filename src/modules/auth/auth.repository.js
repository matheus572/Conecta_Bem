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

export { findByEmail };