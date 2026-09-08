// voluntarios.service.js — regras de gestão de voluntários (RF_18–21, RN04).
import { somenteDigitos, validarCpf } from '../../utils/documento.js';
import * as repository from './voluntarios.repository.js';

function normalizarDados(dados) {
  const nome = String(dados.nome || '').trim();
  const cpf = somenteDigitos(dados.cpf);

  if (!nome) throw new Error('Nome é obrigatório.');
  if (!cpf) throw new Error('CPF é obrigatório.');
  if (!validarCpf(cpf)) throw new Error('CPF inválido.');

  return {
    nome,
    cpf,
    telefone: String(dados.telefone || '').trim() || null,
    especialidade: String(dados.especialidade || '').trim() || null,
    disponibilidade: String(dados.disponibilidade || '').trim() || null,
  };
}

async function listar(filtros) {
  return repository.list(filtros);
}

async function obter(id) {
  return repository.findById(id);
}

async function listarCampanhas(id) {
  return repository.listCampanhas(id);
}

async function criar(dados) {
  const normalizado = normalizarDados(dados);

  const existente = await repository.findByCpf(normalizado.cpf);
  if (existente) throw new Error('Já existe um voluntário com este CPF.');

  return repository.create(normalizado);
}

async function atualizar(id, dados) {
  const normalizado = normalizarDados(dados);

  const existente = await repository.findByCpf(normalizado.cpf, id);
  if (existente) throw new Error('Já existe outro voluntário com este CPF.');

  await repository.update(id, normalizado);
}

async function excluir(id) {
  await repository.softDelete(id);
}

export { listar, obter, listarCampanhas, criar, atualizar, excluir };