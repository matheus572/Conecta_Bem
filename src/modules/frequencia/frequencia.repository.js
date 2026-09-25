// frequencia.repository.js — acesso a dados de frequência (apenas SQL).
// Métodos de escrita aceitam `conn` opcional (default: pool) para rodar dentro
// da transação do service (RN01).
import { pool } from '../../config/db.js';

/** Verifica se já existe lançamento para a matrícula na data (idempotência). */
async function existeLancamento(matriculaId, dataAula, conn = pool) {
  const [rows] = await conn.query(
    'SELECT id FROM frequencia WHERE matricula_id = ? AND data_aula = ? LIMIT 1',
    [matriculaId, dataAula],
  );
  return rows.length > 0;
}

async function create(dados, conn = pool) {
  const [result] = await conn.query(
    'INSERT INTO frequencia (matricula_id, data_aula, presenca, observacao) VALUES (?, ?, ?, ?)',
    [dados.matriculaId, dados.dataAula, dados.presenca ? 1 : 0, dados.observacao || null],
  );
  return result.insertId;
}

/**
 * Últimos N lançamentos da matrícula por data (mais recente primeiro) —
 * base para a verificação de 3 faltas CONSECUTIVAS (RN01).
 */
async function ultimasFrequencias(matriculaId, limite, conn = pool) {
  const [rows] = await conn.query(
    'SELECT id, data_aula, presenca FROM frequencia WHERE matricula_id = ? ORDER BY data_aula DESC, id DESC LIMIT ?',
    [matriculaId, limite],
  );
  return rows;
}

/** Totais de presença/falta da matrícula (elegibilidade do certificado — RF_35). */
async function totaisPorMatricula(matriculaId, conn = pool) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS total_aulas,
            COALESCE(SUM(presenca = 1), 0) AS total_presencas
       FROM frequencia WHERE matricula_id = ?`,
    [matriculaId],
  );
  return {
    totalAulas: Number(rows[0].total_aulas),
    totalPresencas: Number(rows[0].total_presencas),
  };
}

/** Lançamentos de um dia de aula de uma turma (visão do lançamento). */
async function listByTurmaData(turmaId, dataAula) {
  const [rows] = await pool.query(
    `SELECT f.id, f.matricula_id, f.presenca, f.observacao, b.nome AS beneficiario_nome
       FROM frequencia f
       JOIN matricula m ON m.id = f.matricula_id
       JOIN beneficiario b ON b.id = m.beneficiario_id
       WHERE m.turma_id = ? AND f.data_aula = ?
       ORDER BY b.nome ASC`,
    [turmaId, dataAula],
  );
  return rows;
}

export { existeLancamento, create, ultimasFrequencias, totaisPorMatricula, listByTurmaData };
