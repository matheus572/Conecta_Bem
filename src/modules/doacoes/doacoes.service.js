// doacoes.service.js — regras de doações e distribuições (RF_13, RF_15, RN03).
//
// Sprint 6: as movimentações referenciam um ITEM (`item_id`, de item_doacao),
// não mais apenas o tipo. O `tipo_doacao` gravado na movimentação é DERIVADO
// do item (continua na tabela para agrupamentos/relatórios por tipo).
//
// Toda movimentação que afeta o estoque roda em uma transação real
// (getConnection → beginTransaction → operações → commit/rollback), conforme
// seção 1.3 do plano. A distribuição usa `SELECT ... FOR UPDATE` no saldo do
// item (estoque.repository) para impedir corrida entre saídas simultâneas.
import { pool } from '../../config/db.js';
import * as doacaoRepo from './doacoes.repository.js';
import * as estoqueRepo from '../estoque/estoque.repository.js';
import * as doadoresRepo from '../doadores/doadores.repository.js';
import * as beneficiariosRepo from '../beneficiarios/beneficiarios.repository.js';

/** Valida e resolve o item da movimentação (precisa existir e estar ativo). */
async function resolverItem(itemIdBruto) {
  const itemId = Number(itemIdBruto);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    throw new Error('Selecione um item válido.');
  }
  const item = await estoqueRepo.findItemById(itemId);
  if (!item) throw new Error('Item não encontrado.');
  if (!item.ativo) throw new Error('Este item está desativado. Selecione outro item.');
  return item;
}

function validarQuantidade(quantidade) {
  const valor = Number(quantidade);
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error('Quantidade deve ser um número maior que zero.');
  }
  return valor;
}

function normalizarData(data) {
  const valor = String(data || '').trim();
  if (!valor) return new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) throw new Error('Data inválida.');
  return valor;
}

async function registrarDoacao(dados, usuarioId = null) {
  const item = await resolverItem(dados.item_id);
  const quantidade = validarQuantidade(dados.quantidade);
  const data = normalizarData(dados.data_doacao);
  const doadorId = Number(dados.doador_id);

  if (!Number.isInteger(doadorId) || doadorId <= 0) {
    throw new Error('Selecione um doador válido.');
  }
  const doador = await doadoresRepo.findById(doadorId);
  if (!doador) throw new Error('Doador não encontrado.');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await doacaoRepo.criarDoacao(
      {
        doadorId,
        itemId: item.id,
        tipo: item.tipo_doacao,
        quantidade,
        descricao: String(dados.descricao || '').trim() || null,
        data,
        usuarioId,
      },
      conn,
    );
    await estoqueRepo.incrementar(item.id, quantidade, conn);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function registrarDistribuicao(dados, usuarioId = null, campanhaId = null) {
  const item = await resolverItem(dados.item_id);
  const quantidade = validarQuantidade(dados.quantidade);
  const data = normalizarData(dados.data_distribuicao);
  const beneficiarioId = Number(dados.beneficiario_id);

  if (!Number.isInteger(beneficiarioId) || beneficiarioId <= 0) {
    throw new Error('Selecione um beneficiário válido.');
  }
  const beneficiario = await beneficiariosRepo.findById(beneficiarioId);
  if (!beneficiario) throw new Error('Beneficiário não encontrado.');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const saldo = await estoqueRepo.obterSaldoParaAtualizacao(item.id, conn);
    if (saldo === null || saldo < quantidade) {
      throw new Error('Estoque insuficiente para esta distribuição.');
    }

    await doacaoRepo.criarDistribuicao(
      {
        beneficiarioId,
        campanhaId,
        itemId: item.id,
        tipo: item.tipo_doacao,
        quantidade,
        descricao: String(dados.descricao || '').trim() || null,
        data,
        usuarioId,
      },
      conn,
    );
    await estoqueRepo.decrementar(item.id, quantidade, conn);

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

function listarDoacoes(filtros) {
  return doacaoRepo.listarDoacoes(filtros);
}

function listarDistribuicoes(filtros) {
  return doacaoRepo.listarDistribuicoes(filtros);
}

export { registrarDoacao, registrarDistribuicao, listarDoacoes, listarDistribuicoes };
