// doadores.service.js — regras de gestão de doadores (RF_09–12).
// Documento: CPF (PF, 11 dígitos) ou CNPJ (PJ, 14 dígitos), validados com
// dígitos verificadores; unicidade via constraint + verificação amigável.
import { somenteDigitos, validarCpf, validarCnpj } from '../../utils/documento.js';
import * as repository from './doadores.repository.js';

function normalizarDados(dados) {
  const nome = String(dados.nome || '').trim();
  const tipoDoador = dados.tipo_doador;
  const documento = somenteDigitos(dados.documento);

  if (!nome) throw new Error('Nome/razão social é obrigatório.');
  if (tipoDoador !== 'PF' && tipoDoador !== 'PJ') throw new Error('Tipo de doador inválido.');
  if (!documento) throw new Error('CPF/CNPJ é obrigatório.');

  if (tipoDoador === 'PF' && !validarCpf(documento)) {
    throw new Error('CPF inválido.');
  }
  if (tipoDoador === 'PJ' && !validarCnpj(documento)) {
    throw new Error('CNPJ inválido.');
  }

  return {
    nome,
    tipoDoador,
    documento,
    telefone: String(dados.telefone || '').trim() || null,
    endereco: String(dados.endereco || '').trim() || null,
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

  const existente = await repository.findByDocumento(normalizado.documento);
  if (existente) throw new Error('Já existe um doador com este CPF/CNPJ.');

  return repository.create(normalizado);
}

async function atualizar(id, dados) {
  const normalizado = normalizarDados(dados);

  const existente = await repository.findByDocumento(normalizado.documento, id);
  if (existente) throw new Error('Já existe outro doador com este CPF/CNPJ.');

  await repository.update(id, normalizado);
}

async function excluir(id) {
  await repository.softDelete(id);
}

export { listar, obter, criar, atualizar, excluir };