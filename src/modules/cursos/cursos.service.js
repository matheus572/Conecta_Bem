// cursos.service.js — regras de cursos e turmas (RF_30, RF_31).
import * as repository from './cursos.repository.js';

const STATUS_CURSO = ['ATIVO', 'INATIVO'];
const STATUS_TURMA = ['PLANEJADA', 'ATIVA', 'ENCERRADA'];
const ROTULOS_STATUS_CURSO = { ATIVO: 'Ativo', INATIVO: 'Inativo' };
const ROTULOS_STATUS_TURMA = {
  PLANEJADA: 'Planejada',
  ATIVA: 'Ativa',
  ENCERRADA: 'Encerrada',
};

function validarInteiroPositivo(valor, campo) {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero <= 0) {
    throw new Error(`${campo} deve ser um número inteiro maior que zero.`);
  }
  return numero;
}

// --- Curso (RF_30) ---

function normalizarCurso(dados) {
  const nome = String(dados.nome || '').trim();
  if (!nome) throw new Error('Nome do curso é obrigatório.');

  const cargaHoraria = validarInteiroPositivo(dados.carga_horaria, 'Carga horária');
  const quantidadeVagas = validarInteiroPositivo(dados.quantidade_vagas, 'Quantidade de vagas');

  const status = String(dados.status || 'ATIVO').trim().toUpperCase();
  if (!STATUS_CURSO.includes(status)) throw new Error('Status do curso inválido.');

  return {
    nome,
    descricao: String(dados.descricao || '').trim() || null,
    cargaHoraria,
    quantidadeVagas,
    status,
  };
}

function listarCursos(filtros) {
  return repository.listCursos(filtros);
}

function obterCurso(id) {
  return repository.findCursoById(id);
}

function criarCurso(dados) {
  return repository.createCurso(normalizarCurso(dados));
}

async function atualizarCurso(id, dados) {
  await repository.updateCurso(id, normalizarCurso(dados));
}

async function excluirCurso(id) {
  const total = await repository.countTurmasByCurso(id);
  if (total > 0) {
    throw new Error('Este curso possui turmas vinculadas e não pode ser excluído.');
  }
  await repository.deleteCurso(id);
}

// --- Turma (RF_31) ---

function normalizarTurma(dados, cursoId) {
  const periodo = String(dados.periodo || '').trim();
  if (!periodo) throw new Error('Período da turma é obrigatório.');

  const horario = String(dados.horario || '').trim();
  if (!horario) throw new Error('Horário da turma é obrigatório.');

  const diasSemana = String(dados.dias_semana || '').trim();
  if (!diasSemana) throw new Error('Dias da semana são obrigatórios.');

  const capacidade = validarInteiroPositivo(dados.capacidade, 'Capacidade');

  const status = String(dados.status || 'PLANEJADA').trim().toUpperCase();
  if (!STATUS_TURMA.includes(status)) throw new Error('Status da turma inválido.');

  const voluntarioId = dados.voluntario_id ? Number(dados.voluntario_id) : null;
  if (voluntarioId !== null && (!Number.isInteger(voluntarioId) || voluntarioId <= 0)) {
    throw new Error('Voluntário responsável inválido.');
  }

  return { cursoId, voluntarioId, periodo, horario, diasSemana, capacidade, status };
}

function listarTurmas(cursoId) {
  return repository.listTurmasByCurso(cursoId);
}

function obterTurma(id) {
  return repository.findTurmaById(id);
}

function listarTurmasGeral(filtros) {
  return repository.listTurmas(filtros);
}

function listarVoluntariosAtivos() {
  return repository.listVoluntariosAtivos();
}

async function criarTurma(cursoId, dados) {
  const curso = await repository.findCursoById(cursoId);
  if (!curso) throw new Error('Curso não encontrado.');
  return repository.createTurma(normalizarTurma(dados, Number(cursoId)));
}

async function atualizarTurma(id, dados) {
  const turma = await repository.findTurmaById(id);
  if (!turma) throw new Error('Turma não encontrada.');
  await repository.updateTurma(id, normalizarTurma(dados, turma.curso_id));
}

async function excluirTurma(id) {
  const total = await repository.countMatriculasByTurma(id);
  if (total > 0) {
    throw new Error('Esta turma possui matrículas e não pode ser excluída.');
  }
  await repository.deleteTurma(id);
}

export {
  STATUS_CURSO,
  STATUS_TURMA,
  ROTULOS_STATUS_CURSO,
  ROTULOS_STATUS_TURMA,
  listarCursos,
  obterCurso,
  criarCurso,
  atualizarCurso,
  excluirCurso,
  listarTurmas,
  obterTurma,
  listarTurmasGeral,
  listarVoluntariosAtivos,
  criarTurma,
  atualizarTurma,
  excluirTurma,
};
