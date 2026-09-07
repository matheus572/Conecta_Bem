// doadores.repository.js — acesso a dados de doadores (apenas SQL).
import { pool } from '../../config/db.js';
import { somenteDigitos } from '../../utils/documento.js';

async function list({ q = '', tipo = '' } = {}) {
  const conditions = ['`deleted_at` IS NULL'];
  const params = [];

  if (q) {
    const qDigitos = somenteDigitos(q);
    if (qDigitos) {
      conditions.push('(`nome` LIKE ? OR `documento` LIKE ?)');
      params.push(`%${q}%`, `%${qDigitos}%`);
    } else {
      conditions.push('`nome` LIKE ?');
      params.push(`%${q}%`);
    }
  }
  if (tipo === 'PF' || tipo === 'PJ') {
    conditions.push('`tipo_doador` = ?');
    params.push(tipo);
  }

  const [rows] = await pool.query(
    `SELECT id, nome, tipo_doador, documento, telefone, endereco, ativo
       FROM doador WHERE ${conditions.join(' AND ')} ORDER BY nome ASC`,
    params,
  );
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query(
    'SELECT id, nome, tipo_doador, documento, telefone, endereco, ativo FROM doador WHERE id = ? AND deleted_at IS NULL LIMIT 1',
    [id],
  );
  return rows[0] || null;
}

async function findByDocumento(documento, excludeId = null) {
  const [rows] = await pool.query(
    'SELECT id FROM doador WHERE documento = ? AND deleted_at IS NULL' +
      (excludeId ? ' AND id <> ?' : '') +
      ' LIMIT 1',
    excludeId ? [documento, excludeId] : [documento],
  );
  return rows[0] || null;
}

async function create(dados) {
  const [result] = await pool.query(
    'INSERT INTO doador (nome, tipo_doador, documento, telefone, endereco) VALUES (?, ?, ?, ?, ?)',
    [dados.nome, dados.tipoDoador, dados.documento, dados.telefone, dados.endereco],
  );
  return result.insertId;
}

async function update(id, dados) {
  await pool.query(
    'UPDATE doador SET nome = ?, tipo_doador = ?, documento = ?, telefone = ?, endereco = ? WHERE id = ?',
    [dados.nome, dados.tipoDoador, dados.documento, dados.telefone, dados.endereco, id],
  );
}

async function softDelete(id) {
  await pool.query('UPDATE doador SET ativo = 0, deleted_at = NOW() WHERE id = ?', [id]);
}

export { list, findById, findByDocumento, create, update, softDelete };