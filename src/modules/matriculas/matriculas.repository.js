// matriculas.repository.js — acesso a dados de matrículas (apenas SQL).
// Métodos de escrita/leitura-usada-em-transação aceitam `conn` opcional
// (default: pool) para rodar dentro da transação do service (RN02).
import { pool } from '../../config/db.js';

/**
 * Trava a linha da turma para leitura consistente da capacidade dentro da
 * transação de matrícula (RN02) — mesmo padrão do controle de estoque
 * (`SELECT ... FOR UPDATE`).
 */
async function obterTurmaParaAtualizacao(turmaId, conn = pool) {
  const [rows] = await conn.query(
    'SELECT id, curso_id, capacidade, status FROM turma WHERE id = ? FOR UPDATE',
    [turmaId],
  );
  return rows[0] || null;
}

/** Conta matrículas ATIVAS da turma (vagas ocupadas — RN02). */
async function contarAtivasPorTurma(turmaId, conn = pool) {
  const [rows] = await conn.query(
    "SELECT COUNT(*) AS total FROM matricula WHERE turma_id = ? AND status = 'ATIVA'",
    [turmaId],
  );
  return rows[0].total;
}

/** Busca matrícula ATIVA de um beneficiário em uma turma (impede duplicidade). */
async function findAtiva(turmaId, beneficiarioId, conn = pool) {
  const [rows] = await conn.query(
    "SELECT id FROM matricula WHERE turma_id = ? AND beneficiario_id = ? AND status = 'ATIVA' LIMIT 1",
    [turmaId, beneficiarioId],
  );
  return rows[0] || null;
}

async function findById(id, conn = pool) {
  const [rows] = await conn.query(
    `SELECT m.id, m.turma_id, m.beneficiario_id, m.data_matricula, m.status,
            m.quantidade_faltas, b.nome AS beneficiario_nome
       FROM matricula m
       JOIN beneficiario b ON b.id = m.beneficiario_id
       WHERE m.id = ? LIMIT 1`,
    [id],
  );
  return rows[0] || null;
}

async function listByTurma(turmaId) {
  const [rows] = await pool.query(
    `SELECT m.id, m.beneficiario_id, m.data_matricula, m.status, m.quantidade_faltas,
            b.nome AS beneficiario_nome, b.cpf AS beneficiario_cpf
       FROM matricula m
       JOIN beneficiario b ON b.id = m.beneficiario_id
       WHERE m.turma_id = ?
       ORDER BY b.nome ASC`,
    [turmaId],
  );
  return rows;
}

/** Matrículas ATIVAS de uma turma, travadas para atualização (RN01). */
async function listAtivasBloqueadas(turmaId, conn = pool) {
  const [rows] = await conn.query(
    `SELECT m.id, m.beneficiario_id, b.nome AS beneficiario_nome
       FROM matricula m
       JOIN beneficiario b ON b.id = m.beneficiario_id
       WHERE m.turma_id = ? AND m.status = 'ATIVA'
       ORDER BY b.nome ASC
       FOR UPDATE`,
    [turmaId],
  );
  return rows;
}

async function create(dados, conn = pool) {
  const [result] = await conn.query(
    "INSERT INTO matricula (turma_id, beneficiario_id, data_matricula, status) VALUES (?, ?, ?, 'ATIVA')",
    [dados.turmaId, dados.beneficiarioId, dados.dataMatricula],
  );
  return result.insertId;
}

async function atualizarStatus(id, status, conn = pool) {
  await conn.query('UPDATE matricula SET status = ? WHERE id = ?', [status, id]);
}

/** Recalcula o total de faltas da matrícula a partir da tabela de frequência. */
async function sincronizarTotalFaltas(id, conn = pool) {
  await conn.query(
    'UPDATE matricula SET quantidade_faltas = (SELECT COUNT(*) FROM frequencia WHERE matricula_id = ? AND presenca = 0) WHERE id = ?',
    [id, id],
  );
}

export {
  obterTurmaParaAtualizacao,
  contarAtivasPorTurma,
  findAtiva,
  findById,
  listByTurma,
  listAtivasBloqueadas,
  create,
  atualizarStatus,
  sincronizarTotalFaltas,
};
