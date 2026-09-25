// matriculas.service.js — regras de matrícula em turma (RF_32, RN02).
//
// RN02 (vagas): a verificação roda DENTRO de transação com
// `SELECT ... FOR UPDATE` na linha da turma (mesmo padrão do estoque/Sprint 2).
// Assim, duas matrículas simultâneas nunca estouram a capacidade: a segunda
// aguarda o fim da primeira e enxerga a contagem já atualizada. A UNIQUE de
// `matricula(beneficiario_ativo_id)` no banco é a segunda linha de defesa.
import { pool } from '../../config/db.js';
import * as repository from './matriculas.repository.js';
import * as beneficiariosRepo from '../beneficiarios/beneficiarios.repository.js';

function normalizarData(data) {
  const valor = String(data || '').trim();
  if (!valor) return new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new Error('Data de matrícula inválida.');
  return valor;
}

/**
 * Realiza a matrícula de um beneficiário em uma turma (RF_32).
 * Falha por completo (rollback) se a turma estiver lotada (RN02), encerrada,
 * ou se o beneficiário já tiver matrícula ativa na turma.
 */
async function realizarMatricula(dados) {
  const turmaId = Number(dados.turma_id);
  const beneficiarioId = Number(dados.beneficiario_id);
  const dataMatricula = normalizarData(dados.data_matricula);

  if (!Number.isInteger(turmaId) || turmaId <= 0) throw new Error('Selecione uma turma válida.');
  if (!Number.isInteger(beneficiarioId) || beneficiarioId <= 0) {
    throw new Error('Selecione um beneficiário válido.');
  }

  const beneficiario = await beneficiariosRepo.findById(beneficiarioId);
  if (!beneficiario) throw new Error('Beneficiário não encontrado.');
  if (!beneficiario.ativo) throw new Error('Beneficiário inativo não pode ser matriculado.');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Trava a turma: leitura consistente de capacidade + vagas ocupadas (RN02).
    const turma = await repository.obterTurmaParaAtualizacao(turmaId, conn);
    if (!turma) throw new Error('Turma não encontrada.');
    if (turma.status === 'ENCERRADA') {
      throw new Error('Não é possível matricular em uma turma encerrada.');
    }

    const ocupadas = await repository.contarAtivasPorTurma(turmaId, conn);
    if (ocupadas >= turma.capacidade) {
      throw new Error('Turma sem vagas disponíveis.');
    }

    const existente = await repository.findAtiva(turmaId, beneficiarioId, conn);
    if (existente) {
      throw new Error('Este beneficiário já possui matrícula ativa nesta turma.');
    }

    const id = await repository.create({ turmaId, beneficiarioId, dataMatricula }, conn);

    await conn.commit();
    return id;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

function listarPorTurma(turmaId) {
  return repository.listByTurma(turmaId);
}

export { realizarMatricula, listarPorTurma };
