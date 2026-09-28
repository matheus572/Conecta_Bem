// doacoes.service.test.js — RN03 por item (Sprint 6) + entrada com nome do
// item digitado e criação automática (Sprint 7). Repositories/services mockados.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/db.js', () => ({
  pool: { getConnection: vi.fn() },
}));

vi.mock('../../src/modules/doacoes/doacoes.repository.js', () => ({
  criarDoacao: vi.fn(),
  criarDistribuicao: vi.fn(),
  listarDoacoes: vi.fn(),
  listarDistribuicoes: vi.fn(),
}));

vi.mock('../../src/modules/estoque/estoque.repository.js', () => ({
  incrementar: vi.fn(),
  decrementar: vi.fn(),
  obterSaldoParaAtualizacao: vi.fn(),
  findItemById: vi.fn(),
}));

vi.mock('../../src/modules/estoque/estoque.service.js', () => ({
  resolverOuCriarItem: vi.fn(),
  listarItensParaSelecao: vi.fn(),
}));

vi.mock('../../src/modules/doadores/doadores.repository.js', () => ({
  findById: vi.fn(),
}));

vi.mock('../../src/modules/beneficiarios/beneficiarios.repository.js', () => ({
  findById: vi.fn(),
}));

import { pool } from '../../src/config/db.js';
import * as doacaoRepo from '../../src/modules/doacoes/doacoes.repository.js';
import * as estoqueRepo from '../../src/modules/estoque/estoque.repository.js';
import * as estoqueService from '../../src/modules/estoque/estoque.service.js';
import * as doadoresRepo from '../../src/modules/doadores/doadores.repository.js';
import * as beneficiariosRepo from '../../src/modules/beneficiarios/beneficiarios.repository.js';
import * as service from '../../src/modules/doacoes/doacoes.service.js';

const mockedGetConnection = vi.mocked(pool.getConnection);
const mockedCriarDoacao = vi.mocked(doacaoRepo.criarDoacao);
const mockedCriarDistribuicao = vi.mocked(doacaoRepo.criarDistribuicao);
const mockedIncrementar = vi.mocked(estoqueRepo.incrementar);
const mockedDecrementar = vi.mocked(estoqueRepo.decrementar);
const mockedObterSaldo = vi.mocked(estoqueRepo.obterSaldoParaAtualizacao);
const mockedFindItem = vi.mocked(estoqueRepo.findItemById);
const mockedResolverItem = vi.mocked(estoqueService.resolverOuCriarItem);
const mockedFindDoador = vi.mocked(doadoresRepo.findById);
const mockedFindBeneficiario = vi.mocked(beneficiariosRepo.findById);

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
  mockedGetConnection.mockResolvedValue(conn);
  mockedResolverItem.mockResolvedValue({ id: 7, nome_item: 'Leite 1L', tipo_doacao: 'ALIMENTOS', ativo: 1 });
  mockedFindItem.mockResolvedValue({ id: 7, nome_item: 'Leite 1L', tipo_doacao: 'ALIMENTOS', ativo: 1 });
  mockedFindDoador.mockResolvedValue({ id: 1, nome: 'Doador' });
  mockedFindBeneficiario.mockResolvedValue({ id: 2, nome: 'Beneficiário' });
});

describe('doacoes.service — entrada com criação automática de item (RN03, Sprint 7)', () => {
  it('resolve (ou cria) o item DENTRO da mesma transação e deriva o tipo dele', async () => {
    mockedCriarDoacao.mockResolvedValue(1);

    await service.registrarDoacao(
      {
        nome_item: '  leite  1l ',
        tipo_doacao: 'ALIMENTOS',
        unidade: 'L',
        quantidade: '12.5',
        doador_id: '1',
        data_doacao: '2026-09-07',
      },
      9,
    );

    expect(mockedResolverItem).toHaveBeenCalledWith(
      { nomeBruto: '  leite  1l ', tipo: 'ALIMENTOS', unidade: 'L' },
      conn,
      9,
    );
    expect(mockedIncrementar).toHaveBeenCalledWith(7, 12.5, conn);
    expect(mockedCriarDoacao).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 7, tipo: 'ALIMENTOS' }),
      conn,
    );
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
  });

  it('falha na resolução do item (ex.: nome em outra categoria) faz rollback sem gravar nada', async () => {
    mockedResolverItem.mockRejectedValue(new Error('Já existe o item na categoria X.'));

    await expect(
      service.registrarDoacao({
        nome_item: 'Leite 1L',
        tipo_doacao: 'OUTROS',
        quantidade: '1',
        doador_id: '1',
      }),
    ).rejects.toThrow('Já existe');

    expect(mockedCriarDoacao).not.toHaveBeenCalled();
    expect(mockedIncrementar).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
  });

  it('falha na inserção da doação faz rollback — não sobra item/estoque órfão', async () => {
    mockedCriarDoacao.mockRejectedValue(new Error('Data too long'));

    await expect(
      service.registrarDoacao({
        nome_item: 'Novo item',
        tipo_doacao: 'ALIMENTOS',
        quantidade: '1',
        doador_id: '1',
      }),
    ).rejects.toThrow('Data too long');

    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
  });

  it('rejeita quantidade inválida (zero ou negativa)', async () => {
    await expect(
      service.registrarDoacao({ nome_item: 'X', tipo_doacao: 'ALIMENTOS', quantidade: '0', doador_id: '1' }),
    ).rejects.toThrow('Quantidade deve ser um número maior que zero.');
  });

  it('rejeita doador inexistente', async () => {
    mockedFindDoador.mockResolvedValue(null);
    await expect(
      service.registrarDoacao({ nome_item: 'X', tipo_doacao: 'ALIMENTOS', quantidade: '1', doador_id: '1' }),
    ).rejects.toThrow('Doador não encontrado.');
  });
});

describe('doacoes.service — distribuição segue exigindo item existente (RN03)', () => {
  it('decrementa o saldo do item quando há saldo suficiente', async () => {
    mockedObterSaldo.mockResolvedValue(10);
    mockedCriarDistribuicao.mockResolvedValue(1);

    await service.registrarDistribuicao(
      { item_id: '7', quantidade: '4', beneficiario_id: '2', data_distribuicao: '2026-09-07' },
      9,
    );

    expect(mockedObterSaldo).toHaveBeenCalledWith(7, conn);
    expect(mockedDecrementar).toHaveBeenCalledWith(7, 4, conn);
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });

  it('RN03: saldo insuficiente é recusado sem alterar o estoque (rollback)', async () => {
    mockedObterSaldo.mockResolvedValue(5);

    await expect(
      service.registrarDistribuicao({
        item_id: '7',
        quantidade: '10',
        beneficiario_id: '2',
        data_distribuicao: '2026-09-07',
      }),
    ).rejects.toThrow('Estoque insuficiente para esta distribuição.');

    expect(mockedDecrementar).not.toHaveBeenCalled();
    expect(mockedCriarDistribuicao).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
  });

  it('rejeita item inexistente ou desativado', async () => {
    mockedFindItem.mockResolvedValue(null);
    await expect(
      service.registrarDistribuicao({ item_id: '99', quantidade: '1', beneficiario_id: '2' }),
    ).rejects.toThrow('Item não encontrado.');

    mockedFindItem.mockResolvedValue({ id: 7, ativo: 0 });
    await expect(
      service.registrarDistribuicao({ item_id: '7', quantidade: '1', beneficiario_id: '2' }),
    ).rejects.toThrow('desativado');
  });
});
