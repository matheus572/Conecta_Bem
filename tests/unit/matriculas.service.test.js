import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/db.js', () => ({
  pool: { getConnection: vi.fn() },
}));

vi.mock('../../src/modules/matriculas/matriculas.repository.js', () => ({
  obterTurmaParaAtualizacao: vi.fn(),
  contarAtivasPorTurma: vi.fn(),
  findAtiva: vi.fn(),
  findById: vi.fn(),
  listByTurma: vi.fn(),
  listAtivasBloqueadas: vi.fn(),
  create: vi.fn(),
  atualizarStatus: vi.fn(),
  sincronizarTotalFaltas: vi.fn(),
}));

vi.mock('../../src/modules/beneficiarios/beneficiarios.repository.js', () => ({
  findById: vi.fn(),
}));

import { pool } from '../../src/config/db.js';
import * as repository from '../../src/modules/matriculas/matriculas.repository.js';
import * as beneficiariosRepo from '../../src/modules/beneficiarios/beneficiarios.repository.js';
import * as service from '../../src/modules/matriculas/matriculas.service.js';

const mockedGetConnection = vi.mocked(pool.getConnection);
const mockedTurma = vi.mocked(repository.obterTurmaParaAtualizacao);
const mockedContarAtivas = vi.mocked(repository.contarAtivasPorTurma);
const mockedFindAtiva = vi.mocked(repository.findAtiva);
const mockedCreate = vi.mocked(repository.create);
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

describe('matriculas.service — RN02 (controle de vagas transacional)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conn = fakeConn();
    mockedGetConnection.mockResolvedValue(conn);
    mockedFindBeneficiario.mockResolvedValue({ id: 5, nome: 'Maria', ativo: 1 });
    mockedTurma.mockResolvedValue({ id: 10, capacidade: 2, status: 'ATIVA' });
    mockedFindAtiva.mockResolvedValue(null);
  });

  it('turma com 1 vaga aceita exatamente uma matrícula (commit)', async () => {
    mockedContarAtivas.mockResolvedValue(1); // capacidade 2 → 1 livre
    mockedCreate.mockResolvedValue(42);

    const id = await service.realizarMatricula({ turma_id: '10', beneficiario_id: '5' });

    expect(id).toBe(42);
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    // A verificação de vagas usou a linha travada da turma (SELECT ... FOR UPDATE).
    expect(mockedTurma).toHaveBeenCalledWith(10, conn);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
  });

  it('turma lotada rejeita a matrícula sem inserir nada (rollback — RN02)', async () => {
    mockedContarAtivas.mockResolvedValue(2); // capacidade 2 → lotada

    await expect(
      service.realizarMatricula({ turma_id: '10', beneficiario_id: '5' }),
    ).rejects.toThrow('Turma sem vagas disponíveis.');

    expect(mockedCreate).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalledTimes(1);
    expect(conn.commit).not.toHaveBeenCalled();
  });

  it('rejeita matrícula duplicada (beneficiário já ativo na turma)', async () => {
    mockedContarAtivas.mockResolvedValue(0);
    mockedFindAtiva.mockResolvedValue({ id: 99 });

    await expect(
      service.realizarMatricula({ turma_id: '10', beneficiario_id: '5' }),
    ).rejects.toThrow('Este beneficiário já possui matrícula ativa nesta turma.');

    expect(mockedCreate).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalledTimes(1);
  });

  it('rejeita matrícula em turma encerrada', async () => {
    mockedTurma.mockResolvedValue({ id: 10, capacidade: 2, status: 'ENCERRADA' });

    await expect(
      service.realizarMatricula({ turma_id: '10', beneficiario_id: '5' }),
    ).rejects.toThrow('Não é possível matricular em uma turma encerrada.');

    expect(mockedCreate).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalledTimes(1);
  });

  it('rejeita beneficiário inexistente antes de abrir transação', async () => {
    mockedFindBeneficiario.mockResolvedValue(null);

    await expect(
      service.realizarMatricula({ turma_id: '10', beneficiario_id: '5' }),
    ).rejects.toThrow('Beneficiário não encontrado.');

    expect(mockedGetConnection).not.toHaveBeenCalled();
  });
});
