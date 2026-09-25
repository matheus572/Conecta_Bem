// certificados.repository.js — acesso a dados de certificados (apenas SQL).
import { pool } from '../../config/db.js';

async function findByMatricula(matriculaId, conn = pool) {
  const [rows] = await conn.query(
    'SELECT id, matricula_id, data_emissao, codigo_validacao FROM certificado WHERE matricula_id = ? LIMIT 1',
    [matriculaId],
  );
  return rows[0] || null;
}

async function findByCodigo(codigo) {
  const [rows] = await pool.query(
    `SELECT ce.id, ce.data_emissao, ce.codigo_validacao,
            b.nome AS beneficiario_nome, c.nome AS curso_nome, c.carga_horaria,
            t.periodo AS turma_periodo
       FROM certificado ce
       JOIN matricula m ON m.id = ce.matricula_id
       JOIN beneficiario b ON b.id = m.beneficiario_id
       JOIN turma t ON t.id = m.turma_id
       JOIN curso c ON c.id = t.curso_id
       WHERE ce.codigo_validacao = ? LIMIT 1`,
    [codigo],
  );
  return rows[0] || null;
}

async function listByTurma(turmaId) {
  const [rows] = await pool.query(
    `SELECT ce.id, ce.data_emissao, ce.codigo_validacao,
            b.nome AS beneficiario_nome
       FROM certificado ce
       JOIN matricula m ON m.id = ce.matricula_id
       JOIN beneficiario b ON b.id = m.beneficiario_id
       WHERE m.turma_id = ?
       ORDER BY b.nome ASC`,
    [turmaId],
  );
  return rows;
}

async function create(dados, conn = pool) {
  const [result] = await conn.query(
    'INSERT INTO certificado (matricula_id, codigo_validacao) VALUES (?, ?)',
    [dados.matriculaId, dados.codigoValidacao],
  );
  return result.insertId;
}

export { findByMatricula, findByCodigo, listByTurma, create };
