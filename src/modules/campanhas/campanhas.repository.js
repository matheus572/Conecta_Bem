// campanhas.repository.js — acesso a dados de campanhas, associação de
// voluntários (RF_23) e resultados (RF_24). Apenas SQL nesta camada.
import { pool } from '../../config/db.js';

async function list({ status = '', inicio = '', fim = '' } = {}) {
  const conditions = [];
  const params = [];

  if (status) {
    conditions.push('`status` = ?');
    params.push(status);
  }
  if (inicio) {
    conditions.push('`data_inicio` >= ?');
    params.push(inicio);
  }
  if (fim) {
    conditions.push('`data_fim` <= ?');
    params.push(fim);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT id, titulo, data_inicio, data_fim, status
       FROM campanha ${where} ORDER BY data_inicio DESC, id DESC`,
    params,
  );
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query(
    'SELECT id, titulo, descricao, data_inicio, data_fim, status FROM campanha WHERE id = ? LIMIT 1',
    [id],
  );
  return rows[0] || null;
}

async function create(dados) {
  const [result] = await pool.query(
    'INSERT INTO campanha (titulo, descricao, data_inicio, data_fim, status) VALUES (?, ?, ?, ?, ?)',
    [dados.titulo, dados.descricao, dados.dataInicio, dados.dataFim, dados.status],
  );
  return result.insertId;
}

async function update(id, dados) {
  await pool.query(
    'UPDATE campanha SET titulo = ?, descricao = ?, data_inicio = ?, data_fim = ?, status = ? WHERE id = ?',
    [dados.titulo, dados.descricao, dados.dataInicio, dados.dataFim, dados.status, id],
  );
}

async function remove(id) {
  await pool.query('DELETE FROM campanha WHERE id = ?', [id]);
}

// --- Associação de voluntários (RF_23) ---

async function listVoluntarios(campanhaId) {
  const [rows] = await pool.query(
    `SELECT v.id, v.nome, v.especialidade, v.disponibilidade
       FROM campanha_voluntario cv
       JOIN voluntario v ON v.id = cv.voluntario_id
       WHERE cv.campanha_id = ? AND v.deleted_at IS NULL
       ORDER BY v.nome ASC`,
    [campanhaId],
  );
  return rows;
}

async function listVoluntariosDisponiveis(campanhaId) {
  const [rows] = await pool.query(
    `SELECT v.id, v.nome, v.especialidade, v.disponibilidade
       FROM voluntario v
       WHERE v.deleted_at IS NULL
         AND v.id NOT IN (SELECT voluntario_id FROM campanha_voluntario WHERE campanha_id = ?)
       ORDER BY v.nome ASC`,
    [campanhaId],
  );
  return rows;
}

async function findAssociacao(campanhaId, voluntarioId) {
  const [rows] = await pool.query(
    'SELECT id FROM campanha_voluntario WHERE campanha_id = ? AND voluntario_id = ? LIMIT 1',
    [campanhaId, voluntarioId],
  );
  return rows[0] || null;
}

async function associarVoluntario(campanhaId, voluntarioId) {
  await pool.query(
    'INSERT INTO campanha_voluntario (campanha_id, voluntario_id) VALUES (?, ?)',
    [campanhaId, voluntarioId],
  );
}

async function removerVoluntario(campanhaId, voluntarioId) {
  await pool.query(
    'DELETE FROM campanha_voluntario WHERE campanha_id = ? AND voluntario_id = ?',
    [campanhaId, voluntarioId],
  );
}

// --- Resultados (RF_24) ---

async function listAtendimentos(campanhaId) {
  const [rows] = await pool.query(
    `SELECT a.id, a.data_atendimento, a.descricao, b.nome AS beneficiario_nome
       FROM atendimento a
       JOIN beneficiario b ON b.id = a.beneficiario_id
       WHERE a.campanha_id = ?
       ORDER BY a.data_atendimento DESC, a.id DESC`,
    [campanhaId],
  );
  return rows;
}

async function listDistribuicoes(campanhaId) {
  const [rows] = await pool.query(
    `SELECT d.id, d.data_distribuicao, d.tipo_doacao, d.quantidade, b.nome AS beneficiario_nome
       FROM distribuicao d
       JOIN beneficiario b ON b.id = d.beneficiario_id
       WHERE d.campanha_id = ?
       ORDER BY d.data_distribuicao DESC, d.id DESC`,
    [campanhaId],
  );
  return rows;
}

async function criarAtendimento(dados) {
  const [result] = await pool.query(
    'INSERT INTO atendimento (beneficiario_id, campanha_id, data_atendimento, descricao, usuario_id) VALUES (?, ?, ?, ?, ?)',
    [dados.beneficiarioId, dados.campanhaId, dados.data, dados.descricao, dados.usuarioId],
  );
  return result.insertId;
}

export {
  list,
  findById,
  create,
  update,
  remove,
  listVoluntarios,
  listVoluntariosDisponiveis,
  findAssociacao,
  associarVoluntario,
  removerVoluntario,
  listAtendimentos,
  listDistribuicoes,
  criarAtendimento,
};