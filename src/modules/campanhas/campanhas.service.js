// campanhas.service.js — regras de campanhas (RF_22–25).
// Valida `data_fim >= data_inicio` na aplicação (mensagem amigável) além do
// CHECK no banco (UC11). A associação de voluntário valida duplicidade antes
// de inserir, com o UNIQUE como segunda defesa (RF_23).
import * as repository from './campanhas.repository.js';
import * as voluntariosRepo from '../voluntarios/voluntarios.repository.js';
import * as beneficiariosRepo from '../beneficiarios/beneficiarios.repository.js';
import * as doacoesService from '../doacoes/doacoes.service.js';

export const STATUS_CAMPANHA = ['PLANEJADA', 'ATIVA', 'ENCERRADA'];

export const ROTULOS_STATUS_CAMPANHA = {
  PLANEJADA: 'Planejada',
  ATIVA: 'Ativa',
  ENCERRADA: 'Encerrada',
};

function validarStatus(status) {
  if (!STATUS_CAMPANHA.includes(status)) throw new Error('Status de campanha inválido.');
}

function validarData(valor, nome) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new Error(`${nome} inválida.`);
}

/**
 * Valida as datas de início/término. Lança erro amigável quando a data de
 * término é anterior à de início (regra espelhada no CHECK do banco).
 */
export function validarPeriodo(dataInicio, dataFim) {
  if (dataFim < dataInicio) {
    throw new Error('A data de término deve ser igual ou posterior à data de início.');
  }
}

function normalizarDados(dados) {
  const titulo = String(dados.titulo || '').trim();
  const dataInicio = String(dados.data_inicio || '').trim();
  const dataFim = String(dados.data_fim || '').trim();
  const status = dados.status;

  if (!titulo) throw new Error('Título é obrigatório.');
  validarData(dataInicio, 'Data de início');
  validarData(dataFim, 'Data de término');
  validarStatus(status);
  validarPeriodo(dataInicio, dataFim);

  return {
    titulo,
    descricao: String(dados.descricao || '').trim() || null,
    dataInicio,
    dataFim,
    status,
  };
}

async function listar(filtros) {
  return repository.list(filtros);
}

async function obter(id) {
  return repository.findById(id);
}

async function criar(dados) {
  const normalizado = normalizarDados(dados);
  return repository.create(normalizado);
}

async function atualizar(id, dados) {
  const normalizado = normalizarDados(dados);
  await repository.update(id, normalizado);
}

async function excluir(id) {
  await repository.remove(id);
}

// --- Associação de voluntários (RF_23) ---

async function listarVoluntarios(campanhaId) {
  return repository.listVoluntarios(campanhaId);
}

async function listarVoluntariosDisponiveis(campanhaId) {
  return repository.listVoluntariosDisponiveis(campanhaId);
}

async function associarVoluntario(campanhaId, voluntarioId) {
  const voluntario = await voluntariosRepo.findById(voluntarioId);
  if (!voluntario) throw new Error('Voluntário não encontrado.');

  const existente = await repository.findAssociacao(campanhaId, voluntarioId);
  if (existente) throw new Error('Este voluntário já está associado a esta campanha.');

  await repository.associarVoluntario(campanhaId, voluntarioId);
}

async function removerVoluntario(campanhaId, voluntarioId) {
  await repository.removerVoluntario(campanhaId, voluntarioId);
}

// --- Resultados (RF_24) ---

async function listarAtendimentos(campanhaId) {
  return repository.listAtendimentos(campanhaId);
}

async function listarDistribuicoes(campanhaId) {
  return repository.listDistribuicoes(campanhaId);
}

/** Registra um beneficiário atendido na campanha (reaproveita `atendimento`). */
async function registrarAtendimento(campanhaId, dados, usuarioId = null) {
  const beneficiarioId = Number(dados.beneficiario_id);
  if (!Number.isInteger(beneficiarioId) || beneficiarioId <= 0) {
    throw new Error('Selecione um beneficiário válido.');
  }
  const beneficiario = await beneficiariosRepo.findById(beneficiarioId);
  if (!beneficiario) throw new Error('Beneficiário não encontrado.');

  const data = String(dados.data_atendimento || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Data de atendimento inválida.');

  await repository.criarAtendimento({
    beneficiarioId,
    campanhaId,
    data: `${data} 00:00:00`,
    descricao: String(dados.descricao || '').trim() || null,
    usuarioId,
  });
}

/** Registra uma doação distribuída na campanha (reaproveita RN03 de doações). */
async function registrarDistribuicao(campanhaId, dados, usuarioId = null) {
  return doacoesService.registrarDistribuicao(dados, usuarioId, campanhaId);
}

export {
  listar,
  obter,
  criar,
  atualizar,
  excluir,
  listarVoluntarios,
  listarVoluntariosDisponiveis,
  associarVoluntario,
  removerVoluntario,
  listarAtendimentos,
  listarDistribuicoes,
  registrarAtendimento,
  registrarDistribuicao,
};