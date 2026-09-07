// usuarios.repository.js — acesso a dados de usuários (apenas SQL).
import { pool } from '../../config/db.js';

async function list() {
  const [rows] = await pool.query(
    'SELECT `id`, `nome`, `email`, `perfil`, `ativo`, `created_at` ' +
      'FROM `usuario` WHERE `deleted_at` IS NULL ORDER BY `nome` ASC',
  );
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query(
    'SELECT `id`, `nome`, `email`, `perfil`, `ativo` FROM `usuario` WHERE `id` = ? AND `deleted_at` IS NULL LIMIT 1',
    [id],
  );
  return rows[0] || null;
}

async function findByEmail(email, excludeId = null) {
  const [rows] = await pool.query(
    'SELECT `id` FROM `usuario` WHERE `email` = ? AND `deleted_at` IS NULL' +
      (excludeId ? ' AND `id` <> ?' : '') +
      ' LIMIT 1',
    excludeId ? [email, excludeId] : [email],
  );
  return rows[0] || null;
}

async function create({ nome, email, senhaHash, perfil }) {
  const [result] = await pool.query(
    'INSERT INTO `usuario` (`nome`, `email`, `senha_hash`, `perfil`, `ativo`) VALUES (?, ?, ?, ?, 1)',
    [nome, email, senhaHash, perfil],
  );
  return result.insertId;
}

async function update(id, { nome, email, perfil }) {
  await pool.query('UPDATE `usuario` SET `nome` = ?, `email` = ?, `perfil` = ? WHERE `id` = ?', [
    nome,
    email,
    perfil,
    id,
  ]);
}

async function setAtivo(id, ativo) {
  await pool.query('UPDATE `usuario` SET `ativo` = ? WHERE `id` = ?', [ativo ? 1 : 0, id]);
}

async function softDelete(id) {
  await pool.query('UPDATE `usuario` SET `ativo` = 0, `deleted_at` = NOW() WHERE `id` = ?', [id]);
}

export { list, findById, findByEmail, create, update, setAtivo, softDelete };