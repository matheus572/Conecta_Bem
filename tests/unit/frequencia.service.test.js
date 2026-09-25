import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/db.js', () => ({
  pool: { getConnection: vi.fn() },
}));

vi.mock('../../src/modules/frequencia/frequencia.repository.js', () => ({
  existeLancamento: vi.fn(),
  create: vi.fn(),
  ultimasFrequencias: vi.fn(),
  totaisPorMatricula: vi.fn(),
  listByTurmaData: vi.fn(),
}));

vi.mock('../../src/modules/matriculas/matriculas.repository.js', () => ({
  listByTurma: vi.fn(),
  listAtivasBloqueadas: vi.fn(),
  atualizarStatus: vi.fn(),
  sincronizarTotalFaltas: vi.fn(),
}));

vi.mock('../../src/modules/cursos/cursos.repository.js', () => ({
  findTurmaById: vi.fn(),
}));

import { pool } from '../../src/config/db.js';
import * as repository from '../../src/modules/frequencia/frequencia.repository.js';
import * as matriculasRepo from '../../src/modules/matriculas/matriculas.repository.js';
import * as cursosRepo from '../../src/modules/cursos/cursos.repository.js';
import * as service from '../../src/modules/frequencia/frequencia.service.js';

const mockedGetConnection = vi.mocked(pool.getConnection);
const mockedExiste = vi.mocked(repository.existeLancamento);
const mockedCreate = vi.mocked(repository.create);
const mockedUltimas = vi.mocked(repository.ultimasFrequencias);
const mockedListAtivas = vi.mocked(matriculasRepo.listAtivasBloqueadas);
const mockedAtualizarStatus = vi.mocked(matriculasRepo.atualizarStatus);
const mockedFindTurma = vi.mocked(cursosRepo.findTurmaById);

function fakeConn() {
  return {
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
  };
}

let conn;

describe('frequencia.service — RN01 (3 faltas consecutivas cancelam a matrícula)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conn = fakeConn();
    mockedGetConnection.mockResolvedValue(conn);
    mockedFindTurma.mockResolvedValue({ id: 10, status: 'ATIVA' });
    mockedExiste.mockResolvedValue(false);
    mockedCreate.mockResolvedValue(1);
  });

  it('função pura: 3 últimas faltas consecutivas ⇒ verdadeiro', () => {
    const ultimas = [{ presenca: 0 }, { presenca: 0 }, { presenca: 0 }];
    expect(service.atingiuFaltasConsecutivas(ultimas)).toBe(true);
  });

  it('função pura: falta-presença-falta NÃO cancela (presença zera a sequência)', () => {
    const ultimas = [{ presenca: 0 }, { presenca: 1 }, { presenca: 0 }];
    expect(service.atingiuFaltasConsecutivas(ultimas)).toBe(false);
  });

  it('função pura: menos de 3 lançamentos nunca cancela', () => {
    expect(service.atingiuFaltasConsecutivas([{ presenca: 0 }, { presenca: 0 }])).toBe(false);
  });

  it('cancela a matrícula na mesma transação ao registrar a 3ª falta consecutiva', async () => {
    mockedListAtivas.mockResolvedValue([{ id: 7, beneficiario_id: 5, beneficiario_nome: 'Maria' }]);
    // Após o lançamento atual, as 3 últimas são todas faltas (mais recente primeiro).
    mockedUltimas.mockResolvedValue([{ presenca: 0 }, { presenca: 0 }, { presenca: 0 }]);

    const resultado = await service.registrarFrequencia(10, { data_aula: '2026-09-25' });

    expect(mockedAtualizarStatus).toHaveBeenCalledWith(7, 'CANCELADA', conn);
    expect(resultado.canceladas).toEqual([{ id: 7, nome: 'Maria' }]);
    expect(conn.commit).toHaveBeenCalledTimes(1);
    expect(conn.rollback).not.toHaveBeenCalled();
  });

  it('NÃO cancela quando a sequência é falta-presença-falta', async () => {
    mockedListAtivas.mockResolvedValue([{ id: 7, beneficiario_id: 5, beneficiario_nome: 'Maria' }]);
    mockedUltimas.mockResolvedValue([{ presenca: 0 }, { presenca: 1 }, { presenca: 0 }]);

    const resultado = await service.registrarFrequencia(10, { data_aula: '2026-09-25' });

    expect(mockedAtualizarStatus).not.toHaveBeenCalled();
    expect(resultado.canceladas).toEqual([]);
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });

  it('presença não dispara verificação de cancelamento', async () => {
    mockedListAtivas.mockResolvedValue([{ id: 7, beneficiario_id: 5, beneficiario_nome: 'Maria' }]);

    const resultado = await service.registrarFrequencia(10, {
      data_aula: '2026-09-25',
      presentes: ['7'],
    });

    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({ matriculaId: 7, presenca: true }),
      conn,
    );
    expect(mockedUltimas).not.toHaveBeenCalled();
    expect(mockedAtualizarStatus).not.toHaveBeenCalled();
    expect(resultado.lancadas).toBe(1);
  });

  it('ignora aluno que já teve frequência lançada na mesma data (UNIQUE)', async () => {
    mockedListAtivas.mockResolvedValue([{ id: 7, beneficiario_id: 5, beneficiario_nome: 'Maria' }]);
    mockedExiste.mockResolvedValue(true);

    const resultado = await service.registrarFrequencia(10, { data_aula: '2026-09-25' });

    expect(mockedCreate).not.toHaveBeenCalled();
    expect(resultado.lancadas).toBe(0);
  });

  it('rejeita lançamento em turma encerrada', async () => {
    mockedFindTurma.mockResolvedValue({ id: 10, status: 'ENCERRADA' });

    await expect(
      service.registrarFrequencia(10, { data_aula: '2026-09-25' }),
    ).rejects.toThrow('Não é possível lançar frequência em uma turma encerrada.');
  });
});
