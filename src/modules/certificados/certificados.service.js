// certificados.service.js — regras de emissão de certificados (RF_35, UC13).
//
// Critério de elegibilidade (definido nesta sprint — ver docs/decisoes.md):
//   - turma ENCERRADA;
//   - matrícula ATIVA ou CONCLUIDA (CANCELADA nunca é apta — RN01);
//   - frequência mínima de 75%: presenças / aulas lançadas do aluno >= 0.75,
//     com pelo menos 1 aula lançada.
// Ao emitir, a matrícula ATIVA passa a CONCLUIDA na mesma transação.
import crypto from 'node:crypto';
import { pool } from '../../config/db.js';
import * as repository from './certificados.repository.js';
import * as matriculasRepo from '../matriculas/matriculas.repository.js';
import * as frequenciaRepo from '../frequencia/frequencia.repository.js';
import * as cursosRepo from '../cursos/cursos.repository.js';

/** Percentual mínimo de frequência para conclusão (UC13) — decisão assumida: 75%. */
const FREQUENCIA_MINIMA_CERTIFICADO = 0.75;

/** Função pura de elegibilidade por frequência — testável isoladamente. */
function atendeFrequenciaMinima(totalPresencas, totalAulas, minimo = FREQUENCIA_MINIMA_CERTIFICADO) {
  if (totalAulas <= 0) return false;
  return totalPresencas / totalAulas >= minimo;
}

/** Percentual de presença (0–100) arredondado para exibição. */
function percentualPresenca(totalPresencas, totalAulas) {
  if (totalAulas <= 0) return 0;
  return Math.round((totalPresencas / totalAulas) * 1000) / 10;
}

/** Gera código de validação único (RF_35), ex.: "CB-9F2A-…". */
function gerarCodigoValidacao() {
  const aleatorio = crypto.randomBytes(8).toString('hex').toUpperCase();
  return `CB-${aleatorio.slice(0, 4)}-${aleatorio.slice(4, 8)}-${aleatorio.slice(8)}`;
}

/**
 * Situação de elegibilidade dos alunos de uma turma para certificado (UC13).
 * @returns {Promise<{turma: object, alunos: Array<object>}>}
 */
async function listarElegibilidade(turmaId) {
  const turma = await cursosRepo.findTurmaById(turmaId);
  if (!turma) return null;

  const matriculas = await matriculasRepo.listByTurma(turmaId);
  const alunos = [];
  for (const matricula of matriculas) {
    const { totalAulas, totalPresencas } = await frequenciaRepo.totaisPorMatricula(matricula.id);
    const certificado = await repository.findByMatricula(matricula.id);
    const frequenciaOk = atendeFrequenciaMinima(totalPresencas, totalAulas);
    const apto =
      turma.status === 'ENCERRADA' &&
      (matricula.status === 'ATIVA' || matricula.status === 'CONCLUIDA') &&
      frequenciaOk &&
      !certificado;

    alunos.push({
      ...matricula,
      totalAulas,
      totalPresencas,
      percentual: percentualPresenca(totalPresencas, totalAulas),
      certificado,
      apto,
    });
  }
  return { turma, alunos };
}

/**
 * Emite o certificado de uma matrícula (RF_35). Falha por completo quando o
 * aluno não atende aos critérios (UC13 — fluxo alternativo), com mensagem clara.
 */
async function emitir(matriculaId) {
  const id = Number(matriculaId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Matrícula inválida.');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const matricula = await matriculasRepo.findById(id, conn);
    if (!matricula) throw new Error('Matrícula não encontrada.');
    if (matricula.status === 'CANCELADA') {
      throw new Error('Matrícula cancelada: aluno não está apto a receber certificado.');
    }

    const turma = await matriculasRepo.obterTurmaParaAtualizacao(matricula.turma_id, conn);
    if (!turma) throw new Error('Turma não encontrada.');
    if (turma.status !== 'ENCERRADA') {
      throw new Error('O certificado só pode ser emitido após o encerramento da turma.');
    }

    const existente = await repository.findByMatricula(id, conn);
    if (existente) throw new Error('Já existe um certificado emitido para esta matrícula.');

    const { totalAulas, totalPresencas } = await frequenciaRepo.totaisPorMatricula(id, conn);
    if (!atendeFrequenciaMinima(totalPresencas, totalAulas)) {
      throw new Error(
        `Frequência insuficiente: ${percentualPresenca(totalPresencas, totalAulas)}% ` +
          `(mínimo exigido: ${FREQUENCIA_MINIMA_CERTIFICADO * 100}%).`,
      );
    }

    const codigoValidacao = gerarCodigoValidacao();
    const certificadoId = await repository.create({ matriculaId: id, codigoValidacao }, conn);

    // Matrícula ATIVA vira CONCLUIDA ao receber o certificado.
    if (matricula.status === 'ATIVA') {
      await matriculasRepo.atualizarStatus(id, 'CONCLUIDA', conn);
    }

    await conn.commit();
    return { id: certificadoId, codigoValidacao };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

function listarEmitidos(turmaId) {
  return repository.listByTurma(turmaId);
}

export {
  FREQUENCIA_MINIMA_CERTIFICADO,
  atendeFrequenciaMinima,
  percentualPresenca,
  gerarCodigoValidacao,
  listarElegibilidade,
  emitir,
  listarEmitidos,
};
