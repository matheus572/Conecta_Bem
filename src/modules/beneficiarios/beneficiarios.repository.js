// beneficiarios.repository.js — acesso a dados de beneficiários (apenas SQL).
import { pool } from '../../config/db.js';
import { somenteDigitos } from '../../utils/documento.js';

/**
 * Lista beneficiários com busca por nome/CPF e filtro por status (ativo).
 * Registros excluídos (soft delete) nunca aparecem.
 */
async function list({ q = '', status = '' } = {}) {
  const conditions = ['`deleted_at` IS NULL'];
  const params = [];

  if (q) {
    const qDigitos = somenteDigitos(q);
    if (qDigitos) {
      // Busca tanto por nome quanto por CPF (normalizando pontuação do CPF).
      conditions.push('(`nome` LIKE ? OR `cpf` LIKE ?)');
      params.push(`%${q}%`, `%${qDigitos}%`);
    } else {
      conditions.push('`nome` LIKE ?');
      params.push(`%${q}%`);
    }
  }
  if (status === 'ativo' || status === 'inativo') {
    conditions.push('`ativo` = ?');
    params.push(status === 'ativo' ? 1 : 0);
  }

  const [rows] = await pool.query(
    `SELECT id, nome, cpf, data_nascimento, telefone, endereco, situacao_social, ativo
       FROM beneficiario WHERE ${conditions.join(' AND ')} ORDER BY nome ASC`,
    params,
  );
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query(
    'SELECT id, nome, cpf, data_nascimento, telefone, endereco, situacao_social, ativo FROM beneficiario WHERE id = ? AND deleted_at IS NULL LIMIT 1',
    [id],
  );
  return rows[0] || null;
}

async function findByCpf(cpf, excludeId = null) {
  const [rows] = await pool.query(
    'SELECT id FROM beneficiario WHERE cpf = ? AND deleted_at IS NULL' +
      (excludeId ? ' AND id <> ?' : '') +
      ' LIMIT 1',
    excludeId ? [cpf, excludeId] : [cpf],
  );
  return rows[0] || null;
}

async function create(dados) {
  const [result] = await pool.query(
    'INSERT INTO beneficiario (nome, cpf, data_nascimento, telefone, endereco, situacao_social) VALUES (?, ?, ?, ?, ?, ?)',
    [
      dados.nome,
      dados.cpf,
      dados.dataNascimento,
      dados.telefone,
      dados.endereco,
      dados.situacaoSocial,
    ],
  );
  return result.insertId;
}

async function update(id, dados) {
  await pool.query(
    'UPDATE beneficiario SET nome = ?, cpf = ?, data_nascimento = ?, telefone = ?, endereco = ?, situacao_social = ? WHERE id = ?',
    [
      dados.nome,
      dados.cpf,
      dados.dataNascimento,
      dados.telefone,
      dados.endereco,
      dados.situacaoSocial,
      id,
    ],
  );
}

async function softDelete(id) {
  await pool.query('UPDATE beneficiario SET ativo = 0, deleted_at = NOW() WHERE id = ?', [id]);
}

export { list, findById, findByCpf, create, update, softDelete };