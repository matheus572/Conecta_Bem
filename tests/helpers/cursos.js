// tests/helpers/cursos.js — fixtures para os testes de integração da Sprint 4
// (cursos, turmas, beneficiários e matrículas criados direto no banco de teste).
import { pool } from './db.js';

async function criarCurso({ nome = 'Curso Teste', capacidadePadrao = 30 } = {}) {
  const [result] = await pool.query(
    "INSERT INTO curso (nome, descricao, carga_horaria, quantidade_vagas, status) VALUES (?, 'Curso de teste', 40, ?, 'ATIVO')",
    [nome, capacidadePadrao],
  );
  return result.insertId;
}

async function criarTurma(cursoId, { capacidade = 2, status = 'ATIVA' } = {}) {
  const [result] = await pool.query(
    'INSERT INTO turma (curso_id, periodo, horario, dias_semana, capacidade, status) VALUES (?, ?, ?, ?, ?, ?)',
    [cursoId, '01/09 a 30/11/2026', '14h às 16h', 'segundas e quartas', capacidade, status],
  );
  return result.insertId;
}

let cpfSequencia = 39053344700; // base para CPFs de teste válidos

async function criarBeneficiario(nome = 'Beneficiário Teste') {
  cpfSequencia += 1;
  const [result] = await pool.query(
    'INSERT INTO beneficiario (nome, cpf, ativo) VALUES (?, ?, 1)',
    [nome, String(cpfSequencia)],
  );
  return result.insertId;
}

async function criarMatricula(turmaId, beneficiarioId, status = 'ATIVA') {
  const [result] = await pool.query(
    'INSERT INTO matricula (turma_id, beneficiario_id, data_matricula, status) VALUES (?, ?, CURDATE(), ?)',
    [turmaId, beneficiarioId, status],
  );
  return result.insertId;
}

async function registrarFrequenciaDireta(matriculaId, dataAula, presenca) {
  await pool.query('INSERT INTO frequencia (matricula_id, data_aula, presenca) VALUES (?, ?, ?)', [
    matriculaId,
    dataAula,
    presenca ? 1 : 0,
  ]);
}

async function statusMatricula(id) {
  const [rows] = await pool.query('SELECT status FROM matricula WHERE id = ?', [id]);
  return rows[0]?.status;
}

async function idMatricula(turmaId, beneficiarioId) {
  const [rows] = await pool.query(
    'SELECT id FROM matricula WHERE turma_id = ? AND beneficiario_id = ?',
    [turmaId, beneficiarioId],
  );
  return rows[0]?.id;
}

export {
  criarCurso,
  criarTurma,
  criarBeneficiario,
  criarMatricula,
  registrarFrequenciaDireta,
  statusMatricula,
  idMatricula,
};
