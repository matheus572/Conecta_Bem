// cursos.repository.js — acesso a dados de cursos e turmas (apenas SQL).
import { pool } from '../../config/db.js';

// --- Curso (RF_30) ---

/** Lista cursos com busca por nome e filtro por status, incluindo nº de turmas. */
async function listCursos({ q = '', status = '' } = {}) {
  const conditions = [];
  const params = [];

  if (q) {
    conditions.push('c.`nome` LIKE ?');
    params.push(`%${q}%`);
  }
  if (status) {
    conditions.push('c.`status` = ?');
    params.push(status);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT c.id, c.nome, c.descricao, c.carga_horaria, c.quantidade_vagas, c.status,
            (SELECT COUNT(*) FROM turma t WHERE t.curso_id = c.id) AS total_turmas
       FROM curso c ${where}
       ORDER BY c.nome ASC`,
    params,
  );
  return rows;
}

async function findCursoById(id) {
  const [rows] = await pool.query(
    'SELECT id, nome, descricao, carga_horaria, quantidade_vagas, status FROM curso WHERE id = ? LIMIT 1',
    [id],
  );
  return rows[0] || null;
}

async function createCurso(dados) {
  const [result] = await pool.query(
    'INSERT INTO curso (nome, descricao, carga_horaria, quantidade_vagas, status) VALUES (?, ?, ?, ?, ?)',
    [dados.nome, dados.descricao, dados.cargaHoraria, dados.quantidadeVagas, dados.status],
  );
  return result.insertId;
}

async function updateCurso(id, dados) {
  await pool.query(
    'UPDATE curso SET nome = ?, descricao = ?, carga_horaria = ?, quantidade_vagas = ?, status = ? WHERE id = ?',
    [dados.nome, dados.descricao, dados.cargaHoraria, dados.quantidadeVagas, dados.status, id],
  );
}

async function deleteCurso(id) {
  await pool.query('DELETE FROM curso WHERE id = ?', [id]);
}

async function countTurmasByCurso(cursoId) {
  const [rows] = await pool.query('SELECT COUNT(*) AS total FROM turma WHERE curso_id = ?', [
    cursoId,
  ]);
  return rows[0].total;
}

// --- Turma (RF_31) ---

async function listTurmasByCurso(cursoId) {
  const [rows] = await pool.query(
    `SELECT t.id, t.curso_id, t.periodo, t.horario, t.dias_semana, t.capacidade, t.status,
            v.nome AS voluntario_nome,
            (SELECT COUNT(*) FROM matricula m WHERE m.turma_id = t.id AND m.status = 'ATIVA') AS vagas_ocupadas
       FROM turma t
       LEFT JOIN voluntario v ON v.id = t.voluntario_id
       WHERE t.curso_id = ?
       ORDER BY t.id DESC`,
    [cursoId],
  );
  return rows;
}

/** Detalhe de uma turma já com dados do curso e do voluntário responsável. */
async function findTurmaById(id) {
  const [rows] = await pool.query(
    `SELECT t.id, t.curso_id, t.voluntario_id, t.periodo, t.horario, t.dias_semana,
            t.capacidade, t.status,
            c.nome AS curso_nome, c.carga_horaria AS curso_carga_horaria,
            v.nome AS voluntario_nome
       FROM turma t
       JOIN curso c ON c.id = t.curso_id
       LEFT JOIN voluntario v ON v.id = t.voluntario_id
       WHERE t.id = ? LIMIT 1`,
    [id],
  );
  return rows[0] || null;
}

async function createTurma(dados) {
  const [result] = await pool.query(
    'INSERT INTO turma (curso_id, voluntario_id, periodo, horario, dias_semana, capacidade, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      dados.cursoId,
      dados.voluntarioId,
      dados.periodo,
      dados.horario,
      dados.diasSemana,
      dados.capacidade,
      dados.status,
    ],
  );
  return result.insertId;
}

async function updateTurma(id, dados) {
  await pool.query(
    'UPDATE turma SET voluntario_id = ?, periodo = ?, horario = ?, dias_semana = ?, capacidade = ?, status = ? WHERE id = ?',
    [
      dados.voluntarioId,
      dados.periodo,
      dados.horario,
      dados.diasSemana,
      dados.capacidade,
      dados.status,
      id,
    ],
  );
}

async function deleteTurma(id) {
  await pool.query('DELETE FROM turma WHERE id = ?', [id]);
}

async function countMatriculasByTurma(turmaId) {
  const [rows] = await pool.query('SELECT COUNT(*) AS total FROM matricula WHERE turma_id = ?', [
    turmaId,
  ]);
  return rows[0].total;
}

/** Voluntários ativos para o select de responsável pela turma. */
async function listVoluntariosAtivos() {
  const [rows] = await pool.query(
    'SELECT id, nome FROM voluntario WHERE ativo = 1 AND deleted_at IS NULL ORDER BY nome ASC',
  );
  return rows;
}

/** Turmas com curso (para seleção em telas de certificado). */
async function listTurmas({ status = '' } = {}) {
  const conditions = [];
  const params = [];
  if (status) {
    conditions.push('t.`status` = ?');
    params.push(status);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT t.id, t.periodo, t.horario, t.dias_semana, t.capacidade, t.status, c.nome AS curso_nome
       FROM turma t
       JOIN curso c ON c.id = t.curso_id
       ${where}
       ORDER BY c.nome ASC, t.id DESC`,
    params,
  );
  return rows;
}

export {
  listCursos,
  findCursoById,
  createCurso,
  updateCurso,
  deleteCurso,
  countTurmasByCurso,
  listTurmasByCurso,
  findTurmaById,
  createTurma,
  updateTurma,
  deleteTurma,
  countMatriculasByTurma,
  listVoluntariosAtivos,
  listTurmas,
};
