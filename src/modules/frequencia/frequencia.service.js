// frequencia.service.js — regras de frequência (RF_33, RF_34, RN01).
//
// RN01: após cada FALTA lançada, verifica se o aluno acumulou 3 faltas
// CONSECUTIVAS (as 3 últimas aulas, por data, todas com presenca = 0).
// Uma presença quebra a sequência (falta-presença-falta NÃO cancela).
// Quando atinge 3, a matrícula é cancelada NA MESMA TRANSAÇÃO e a vaga é
// liberada automaticamente (vagas são contadas por matrícula ATIVA).
//
// RF_34 (notificação): sem SMTP no MVP, a notificação é um alerta em tela
// para o administrador — o service devolve a lista de matrículas canceladas
// e o controller a exibe como flash (ver docs/decisoes.md, Sprint 4).
import { pool } from '../../config/db.js';
import * as repository from './frequencia.repository.js';
import * as matriculasRepo from '../matriculas/matriculas.repository.js';
import * as cursosRepo from '../cursos/cursos.repository.js';

const LIMITE_FALTAS_CONSECUTIVAS = 3;

function normalizarDataAula(data) {
  const valor = String(data || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new Error('Data da aula inválida.');
  return valor;
}

/**
 * Verdadeiro quando os últimos `limite` lançamentos são todos faltas
 * (e existem pelo menos `limite` lançamentos). Função pura — testável.
 */
function atingiuFaltasConsecutivas(ultimas, limite = LIMITE_FALTAS_CONSECUTIVAS) {
  if (ultimas.length < limite) return false;
  return ultimas.slice(0, limite).every((f) => Number(f.presenca) === 0);
}

/**
 * Registra a frequência de uma aula inteira da turma (RF_33): para cada
 * matrícula ativa, presença (id em `presentesIds`) ou falta. Lançamentos já
 * existentes na data são ignorados (UNIQUE no banco como segunda defesa).
 *
 * @returns {{ lancadas: number, canceladas: Array<{id:number, nome:string}> }}
 */
async function registrarFrequencia(turmaId, dados) {
  const id = Number(turmaId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Turma inválida.');

  const dataAula = normalizarDataAula(dados.data_aula);
  const presentes = new Set(
    (Array.isArray(dados.presentes) ? dados.presentes : dados.presentes ? [dados.presentes] : [])
      .map(Number),
  );

  const turma = await cursosRepo.findTurmaById(id);
  if (!turma) throw new Error('Turma não encontrada.');
  if (turma.status === 'ENCERRADA') {
    throw new Error('Não é possível lançar frequência em uma turma encerrada.');
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const matriculas = await matriculasRepo.listAtivasBloqueadas(id, conn);
    const canceladas = [];
    let lancadas = 0;

    for (const matricula of matriculas) {
      const jaLancada = await repository.existeLancamento(matricula.id, dataAula, conn);
      if (jaLancada) continue; // idempotente: não duplica lançamento da aula

      const presenca = presentes.has(Number(matricula.id));
      await repository.create({ matriculaId: matricula.id, dataAula, presenca }, conn);
      lancadas += 1;

      if (!presenca) {
        await matriculasRepo.sincronizarTotalFaltas(matricula.id, conn);

        const ultimas = await repository.ultimasFrequencias(
          matricula.id,
          LIMITE_FALTAS_CONSECUTIVAS,
          conn,
        );
        if (atingiuFaltasConsecutivas(ultimas)) {
          // RN01: cancela na mesma transação; a vaga é liberada porque a
          // contagem de vagas (RN02) considera apenas matrículas ATIVAS.
          await matriculasRepo.atualizarStatus(matricula.id, 'CANCELADA', conn);
          canceladas.push({ id: matricula.id, nome: matricula.beneficiario_nome });
        }
      }
    }

    await conn.commit();
    return { lancadas, canceladas };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Matrículas ativas da turma (para a tela de lançamento de frequência). */
async function listarAlunosParaLancamento(turmaId) {
  const matriculas = await matriculasRepo.listByTurma(turmaId);
  return matriculas.filter((m) => m.status === 'ATIVA');
}

function listarPorTurmaData(turmaId, dataAula) {
  return repository.listByTurmaData(turmaId, dataAula);
}

export {
  LIMITE_FALTAS_CONSECUTIVAS,
  atingiuFaltasConsecutivas,
  registrarFrequencia,
  listarAlunosParaLancamento,
  listarPorTurmaData,
};
