// beneficiarios.service.js — regras de gestão de beneficiários (RF_05–08, RN04).
import { somenteDigitos, validarCpf } from '../../utils/documento.js';
import * as repository from './beneficiarios.repository.js';

function normalizarDados(dados) {
  const nome = String(dados.nome || '').trim();
  const cpf = somenteDigitos(dados.cpf);

  if (!nome) throw new Error('Nome é obrigatório.');
  if (!cpf) throw new Error('CPF é obrigatório.');
  if (!validarCpf(cpf)) throw new Error('CPF inválido.');

  return {
    nome,
    cpf,
    dataNascimento: dados.data_nascimento || null,
    telefone: String(dados.telefone || '').trim() || null,
    endereco: String(dados.endereco || '').trim() || null,
    situacaoSocial: String(dados.situacao_social || '').trim() || null,
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

  const existente = await repository.findByCpf(normalizado.cpf);
  if (existente) throw new Error('Já existe um beneficiário com este CPF.');

  return repository.create(normalizado);
}

async function atualizar(id, dados) {
  const normalizado = normalizarDados(dados);

  const existente = await repository.findByCpf(normalizado.cpf, id);
  if (existente) throw new Error('Já existe outro beneficiário com este CPF.');

  await repository.update(id, normalizado);
}

async function excluir(id) {
  await repository.softDelete(id);
}

export { listar, obter, criar, atualizar, excluir };