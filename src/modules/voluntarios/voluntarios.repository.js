// voluntarios.repository.js — acesso a dados de voluntários (apenas SQL).
import { pool } from '../../config/db.js';
import { somenteDigitos } from '../../utils/documento.js';

/**
 * Lista voluntários ativos com busca por nome, habilidade (especialidade) ou
 * disponibilidade (RF_21). Registros excluídos (soft delete) nunca aparecem.
 */
async function list({ q = '' } = {}) {
  const conditions = ['`deleted_at` IS NULL'];
  const params = [];

  if (q) {
    const qDigitos = somenteDigitos(q);
    if (qDigitos) {
      conditions.push('(`nome` LIKE ? OR `cpf` LIKE ? OR `especialidade` LIKE ? OR `disponibilidade` LIKE ?)');
      params.push(`%${q}%`, `%${qDigitos}%`, `%${q}%`, `%${q}%`);
    } else {
      conditions.push('(`nome` LIKE ? OR `especialidade` LIKE ? OR `disponibilidade` LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
  }

  const [rows] = await pool.query(
    `SELECT id, nome, cpf, telefone, especialidade, disponibilidade, ativo
       FROM voluntario WHERE ${conditions.join(' AND ')} ORDER BY nome ASC`,
    params,
  );
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query(
    'SELECT id, nome, cpf, telefone, especialidade, disponibilidade, ativo FROM voluntario WHERE id = ? AND deleted_at IS NULL LIMIT 1',
    [id],
  );
  return rows[0] || null;
}

async function findByCpf(cpf, excludeId = null) {
  const [rows] = await pool.query(
    'SELECT id FROM voluntario WHERE cpf = ? AND deleted_at IS NULL' +
      (excludeId ? ' AND id <> ?' : '') +
      ' LIMIT 1',
    excludeId ? [cpf, excludeId] : [cpf],
  );
  return rows[0] || null;
}

/**
 * Histórico de participação em campanhas (RF_19), via associação N:N.
 * Lista as campanhas em que o voluntário participou.
 */
async function listCampanhas(voluntarioId) {
  const [rows] = await pool.query(
    `SELECT c.id, c.titulo, c.data_inicio, c.data_fim, c.status
       FROM campanha_voluntario cv
       JOIN campanha c ON c.id = cv.campanha_id
       WHERE cv.voluntario_id = ?
       ORDER BY c.data_inicio DESC`,
    [voluntarioId],
  );
  return rows;
}

async function create(dados) {
  const [result] = await pool.query(
    'INSERT INTO voluntario (nome, cpf, telefone, especialidade, disponibilidade) VALUES (?, ?, ?, ?, ?)',
    [dados.nome, dados.cpf, dados.telefone, dados.especialidade, dados.disponibilidade],
  );
  return result.insertId;
}

async function update(id, dados) {
  await pool.query(
    'UPDATE voluntario SET nome = ?, cpf = ?, telefone = ?, especialidade = ?, disponibilidade = ? WHERE id = ?',
    [dados.nome, dados.cpf, dados.telefone, dados.especialidade, dados.disponibilidade, id],
  );
}

async function softDelete(id) {
  await pool.query('UPDATE voluntario SET ativo = 0, deleted_at = NOW() WHERE id = ?', [id]);
}

export { list, findById, findByCpf, listCampanhas, create, update, softDelete };