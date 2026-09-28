// estoque.service.test.js — regras de estoque por item (Sprint 6) com o
// repository mockado (sem banco).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/db.js', () => ({
  pool: { getConnection: vi.fn() },
}));

vi.mock('../../src/modules/estoque/estoque.repository.js', () => ({
  listar: vi.fn(),
  listarItensAtivos: vi.fn(),
  findItemById: vi.fn(),
  findItemPorNomeTipo: vi.fn(),
  criarItem: vi.fn(),
  criarEstoqueVazio: vi.fn(),
  atualizarItem: vi.fn(),
  setItemAtivo: vi.fn(),
  atualizarMinimo: vi.fn(),
  obterSaldoParaAtualizacao: vi.fn(),
  incrementar: vi.fn(),
  decrementar: vi.fn(),
}));

import { pool } from '../../src/config/db.js';
import * as repository from '../../src/modules/estoque/estoque.repository.js';
import * as service from '../../src/modules/estoque/estoque.service.js';

const repo = vi.mocked(repository);
const getConn = vi.mocked(pool.getConnection);

function fakeConn() {
  return {
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
  };
}

let conn;

beforeEach(() => {
  vi.clearAllMocks();
  conn = fakeConn();
  getConn.mockResolvedValue(conn);
});

describe('estoque.service — indicador de estoque mínimo por ITEM (RF_16/RF_S04)', () => {
  it('marca itens abaixo do mínimo', async () => {
    repo.listar.mockResolvedValue([
      { item_id: 1, nome_item: 'Leite 1L', quantidade: 5, estoque_minimo: 10 },
      { item_id: 2, nome_item: 'Arroz 5kg', quantidade: 20, estoque_minimo: 10 },
    ]);

    const itens = await service.listar({});
    expect(itens[0].abaixo_minimo).toBe(true);
    expect(itens[1].abaixo_minimo).toBe(false);
  });

  it('filtra por status "baixo"', async () => {
    repo.listar.mockResolvedValue([
      { item_id: 1, nome_item: 'Leite 1L', quantidade: 5, estoque_minimo: 10 },
      { item_id: 2, nome_item: 'Arroz 5kg', quantidade: 20, estoque_minimo: 10 },
    ]);

    const itens = await service.listar({ status: 'baixo' });
    expect(itens).toHaveLength(1);
    expect(itens[0].nome_item).toBe('Leite 1L');
  });

  it('passa a busca por nome (q) e o tipo ao repository', async () => {
    repo.listar.mockResolvedValue([]);
    await service.listar({ q: 'lei', tipo: 'ALIMENTOS' });
    expect(repo.listar).toHaveBeenCalledWith({ tipo: 'ALIMENTOS', q: 'lei' });
  });

  it('rejeita tipo inválido', async () => {
    await expect(service.listar({ tipo: 'XXX' })).rejects.toThrow('Tipo de doação inválido.');
  });

  it('atualizarMinimo valida item existente e valor não-negativo', async () => {
    repo.findItemById.mockResolvedValue({ id: 1 });
    repo.atualizarMinimo.mockResolvedValue(undefined);

    await service.atualizarMinimo('1', '10');
    expect(repo.atualizarMinimo).toHaveBeenCalledWith(1, 10);

    await expect(service.atualizarMinimo('1', '-1')).rejects.toThrow(
      'Estoque mínimo deve ser um número maior ou igual a zero.',
    );

    repo.findItemById.mockResolvedValue(null);
    await expect(service.atualizarMinimo('999', '5')).rejects.toThrow('Item não encontrado.');
  });
});

describe('estoque.service — CRUD de itens', () => {
  it('cria o item e sua linha de estoque zerada na MESMA transação', async () => {
    repo.findItemPorNomeTipo.mockResolvedValue(null);
    repo.criarItem.mockResolvedValue(42);

    const id = await service.criarItem({
      nome_item: 'Leite 1L',
      tipo_doacao: 'ALIMENTOS',
      unidade: 'L',
    });

    expect(id).toBe(42);
    expect(repo.criarItem).toHaveBeenCalledWith(
      { nome: 'Leite 1L', tipo: 'ALIMENTOS', unidade: 'L' },
      conn,
    );
    expect(repo.criarEstoqueVazio).toHaveBeenCalledWith(42, conn);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
  });

  it('rejeita nome duplicado no mesmo tipo (uq_item_nome_tipo)', async () => {
    repo.findItemPorNomeTipo.mockResolvedValue({ id: 9 });

    await expect(
      service.criarItem({ nome_item: 'Leite 1L', tipo_doacao: 'ALIMENTOS', unidade: 'L' }),
    ).rejects.toThrow('Já existe um item com este nome neste tipo.');

    expect(repo.criarItem).not.toHaveBeenCalled();
  });

  it('permite o mesmo nome em tipos diferentes', async () => {
    repo.findItemPorNomeTipo.mockResolvedValue(null);
    repo.criarItem.mockResolvedValue(1);
    await service.criarItem({ nome_item: 'Leite 1L', tipo_doacao: 'OUTROS', unidade: 'L' });
    expect(repo.findItemPorNomeTipo).toHaveBeenCalledWith('Leite 1L', 'OUTROS');
  });

  it('edição não permite colisão de nome com outro item do tipo', async () => {
    repo.findItemById.mockResolvedValue({ id: 1, tipo_doacao: 'ALIMENTOS' });
    repo.findItemPorNomeTipo.mockResolvedValue({ id: 2 });

    await expect(
      service.atualizarItem('1', { nome_item: 'Arroz 5kg', unidade: 'KG' }),
    ).rejects.toThrow('Já existe um item com este nome neste tipo.');
  });
});
