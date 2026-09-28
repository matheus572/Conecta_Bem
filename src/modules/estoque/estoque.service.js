// estoque.service.js — regras de itens e estoque por item (RF_14, RF_16/RF_S04,
// busca por item da Sprint 6).
import { pool } from '../../config/db.js';
import { isTipoValido } from '../../utils/tiposDoacao.js';
import * as repository from './estoque.repository.js';

// --- Listagem/busca do estoque ---

/**
 * Lista o estoque (por item) com filtros: busca parcial por nome (`q`,
 * case-insensitive), filtro por tipo e por condição de estoque mínimo.
 * Adiciona `abaixo_minimo` quando `quantidade < estoque_minimo` (RF_S04).
 */
async function listar({ tipo = '', status = '', q = '' } = {}) {
  const tipoT = String(tipo || '').trim();
  const qT = String(q || '').trim().slice(0, 120);
  if (tipoT && !isTipoValido(tipoT)) throw new Error('Tipo de doação inválido.');

  const itens = await repository.listar({ tipo: tipoT, q: qT });

  const comIndicador = itens.map((item) => ({
    ...item,
    abaixo_minimo: item.quantidade < item.estoque_minimo,
  }));

  if (status === 'baixo') return comIndicador.filter((item) => item.abaixo_minimo);
  if (status === 'ok') return comIndicador.filter((item) => !item.abaixo_minimo);
  return comIndicador;
}

function listarItensParaSelecao() {
  return repository.listarItensAtivos();
}

async function obterItem(id) {
  return repository.findItemById(Number(id));
}

// --- CRUD de itens (RF_14; escrita restrita ao ADMINISTRADOR nas rotas) ---

function validarDadosItem(dados) {
  const nome = String(dados.nome_item || '').trim();
  const unidade = String(dados.unidade || 'UN').trim() || 'UN';
  const tipo = String(dados.tipo_doacao || '').trim();

  if (!nome || nome.length > 120) throw new Error('Informe um nome de item válido (até 120 caracteres).');
  if (!unidade || unidade.length > 20) throw new Error('Informe uma unidade válida (até 20 caracteres).');
  if (tipo && !isTipoValido(tipo)) throw new Error('Tipo de doação inválido.');

  return { nome, unidade, tipo };
}

/**
 * Cria um item com sua linha de estoque zerada — tudo na mesma transação
 * (transacionalidade, §2.1). O estoque de cada item nasce com saldo 0.
 */
async function criarItem(dados) {
  const { nome, unidade, tipo } = validarDadosItem(dados);
  if (!tipo) throw new Error('Selecione o tipo de doação do item.');

  const existente = await repository.findItemPorNomeTipo(nome, tipo);
  if (existente) throw new Error('Já existe um item com este nome neste tipo.');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const itemId = await repository.criarItem({ nome, tipo, unidade }, conn);
    await repository.criarEstoqueVazio(itemId, conn);
    await conn.commit();
    return itemId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Edita nome/unidade. O tipo não é editável: alterá-lo deslocaria saldos
 * entre tipos; nesse caso, desativar o item e criar outro (ver decisões). */
async function atualizarItem(id, dados) {
  const itemId = Number(id);
  if (!Number.isInteger(itemId) || itemId <= 0) throw new Error('Item inválido.');

  const item = await repository.findItemById(itemId);
  if (!item) throw new Error('Item não encontrado.');

  const { nome, unidade } = validarDadosItem({ ...dados, tipo_doacao: item.tipo_doacao });

  const duplicado = await repository.findItemPorNomeTipo(nome, item.tipo_doacao);
  if (duplicado && duplicado.id !== itemId) {
    throw new Error('Já existe um item com este nome neste tipo.');
  }

  await repository.atualizarItem(itemId, { nome, unidade });
}

async function alternarItemAtivo(id, ativo) {
  const itemId = Number(id);
  if (!Number.isInteger(itemId) || itemId <= 0) throw new Error('Item inválido.');
  const item = await repository.findItemById(itemId);
  if (!item) throw new Error('Item não encontrado.');
  await repository.setItemAtivo(itemId, ativo);
}

// --- Estoque mínimo (RF_16) ---

async function atualizarMinimo(itemId, minimo) {
  const id = Number(itemId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Item inválido.');

  const item = await repository.findItemById(id);
  if (!item) throw new Error('Item não encontrado.');

  const valor = Number(minimo);
  if (!Number.isFinite(valor) || valor < 0) {
    throw new Error('Estoque mínimo deve ser um número maior ou igual a zero.');
  }

  await repository.atualizarMinimo(id, valor);
}

export {
  listar,
  listarItensParaSelecao,
  obterItem,
  criarItem,
  atualizarItem,
  alternarItemAtivo,
  atualizarMinimo,
};
