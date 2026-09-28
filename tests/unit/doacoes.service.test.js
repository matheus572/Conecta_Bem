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

vi.mock('../../src/modules/doadores/doadores.repository.js', () => ({
  findById: vi.fn(),
}));

vi.mock('../../src/modules/beneficiarios/beneficiarios.repository.js', () => ({
  findById: vi.fn(),
}));

import { pool } from '../../src/config/db.js';
import * as doacaoRepo from '../../src/modules/doacoes/doacoes.repository.js';
import * as estoqueRepo from '../../src/modules/estoque/estoque.repository.js';
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

describe('doacoes.service — RN03 por item (cálculo de saldo e rejeição de insuficiente)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conn = fakeConn();
    mockedGetConnection.mockResolvedValue(conn);
    mockedFindItem.mockResolvedValue({ id: 7, nome_item: 'Leite 1L', tipo_doacao: 'ALIMENTOS', ativo: 1 });
    mockedFindDoador.mockResolvedValue({ id: 1, nome: 'Doador' });
    mockedFindBeneficiario.mockResolvedValue({ id: 2, nome: 'Beneficiário' });
  });

  it('registrarDoacao incrementa o saldo do ITEM e deriva o tipo do item', async () => {
    mockedCriarDoacao.mockResolvedValue(1);

    await service.registrarDoacao(
      { item_id: '7', quantidade: '12.5', doador_id: '1', data_doacao: '2026-09-07' },
      9,
    );

    expect(mockedIncrementar).toHaveBeenCalledTimes(1);
    expect(mockedIncrementar).toHaveBeenCalledWith(7, 12.5, conn);
    expect(mockedCriarDoacao).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: 7, tipo: 'ALIMENTOS' }),
      conn,
    );
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
  });

  it('registrarDistribuicao decrementa o saldo do item quando há saldo suficiente', async () => {
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

  it('rejeita item inexistente, desativado ou não informado', async () => {
    await expect(
      service.registrarDoacao({ quantidade: '1', doador_id: '1' }),
    ).rejects.toThrow('Selecione um item válido.');

    mockedFindItem.mockResolvedValue(null);
    await expect(
      service.registrarDoacao({ item_id: '99', quantidade: '1', doador_id: '1' }),
    ).rejects.toThrow('Item não encontrado.');

    mockedFindItem.mockResolvedValue({ id: 7, nome_item: 'Leite 1L', tipo_doacao: 'ALIMENTOS', ativo: 0 });
    await expect(
      service.registrarDoacao({ item_id: '7', quantidade: '1', doador_id: '1' }),
    ).rejects.toThrow('desativado');
  });

  it('rejeita quantidade inválida (zero ou negativa)', async () => {
    await expect(
      service.registrarDoacao({ item_id: '7', quantidade: '0', doador_id: '1' }),
    ).rejects.toThrow('Quantidade deve ser um número maior que zero.');
  });

  it('rejeita doador inexistente', async () => {
    mockedFindDoador.mockResolvedValue(null);
    await expect(
      service.registrarDoacao({ item_id: '7', quantidade: '1', doador_id: '1' }),
    ).rejects.toThrow('Doador não encontrado.');
  });
});
