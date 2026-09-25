import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/db.js', () => ({
  pool: { getConnection: vi.fn() },
}));

vi.mock('../../src/modules/certificados/certificados.repository.js', () => ({
  findByMatricula: vi.fn(),
  findByCodigo: vi.fn(),
  listByTurma: vi.fn(),
  create: vi.fn(),
}));

vi.mock('../../src/modules/matriculas/matriculas.repository.js', () => ({
  findById: vi.fn(),
  obterTurmaParaAtualizacao: vi.fn(),
  atualizarStatus: vi.fn(),
  listByTurma: vi.fn(),
}));

vi.mock('../../src/modules/frequencia/frequencia.repository.js', () => ({
  totaisPorMatricula: vi.fn(),
}));

vi.mock('../../src/modules/cursos/cursos.repository.js', () => ({
  findTurmaById: vi.fn(),
}));

import { pool } from '../../src/config/db.js';
import * as repository from '../../src/modules/certificados/certificados.repository.js';
import * as matriculasRepo from '../../src/modules/matriculas/matriculas.repository.js';
import * as frequenciaRepo from '../../src/modules/frequencia/frequencia.repository.js';
import * as service from '../../src/modules/certificados/certificados.service.js';

const mockedGetConnection = vi.mocked(pool.getConnection);
const mockedFindById = vi.mocked(matriculasRepo.findById);
const mockedTurmaUpdate = vi.mocked(matriculasRepo.obterTurmaParaAtualizacao);
const mockedFindCert = vi.mocked(repository.findByMatricula);
const mockedCreate = vi.mocked(repository.create);
const mockedTotais = vi.mocked(frequenciaRepo.totaisPorMatricula);
const mockedAtualizarStatus = vi.mocked(matriculasRepo.atualizarStatus);

function fakeConn() {
  return {
    beginTransaction: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    release: vi.fn(),
  };
}

let conn;

describe('certificados.service — elegibilidade (RF_35, UC13, mínimo 75%)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conn = fakeConn();
    mockedGetConnection.mockResolvedValue(conn);
    mockedFindById.mockResolvedValue({ id: 7, turma_id: 10, status: 'ATIVA' });
    mockedTurmaUpdate.mockResolvedValue({ id: 10, status: 'ENCERRADA' });
    mockedFindCert.mockResolvedValue(null);
    mockedCreate.mockResolvedValue(1);
  });

  it('função pura: 75% exatos é apto; abaixo não; sem aulas não', () => {
    expect(service.atendeFrequenciaMinima(3, 4)).toBe(true); // 75%
    expect(service.atendeFrequenciaMinima(2, 3)).toBe(false); // ~66,7%
    expect(service.atendeFrequenciaMinima(0, 0)).toBe(false); // sem aulas lançadas
    expect(service.atendeFrequenciaMinima(4, 4)).toBe(true); // 100%
  });

  it('código de validação tem formato CB-XXXX-XXXX-XXXXXXXX', () => {
    expect(service.gerarCodigoValidacao()).toMatch(/^CB-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{8}$/);
  });

  it('emite certificado para aluno apto e marca matrícula como CONCLUIDA', async () => {
    mockedTotais.mockResolvedValue({ totalAulas: 4, totalPresencas: 3 });

    const { codigoValidacao } = await service.emitir(7);

    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({ matriculaId: 7, codigoValidacao }),
      conn,
    );
    expect(mockedAtualizarStatus).toHaveBeenCalledWith(7, 'CONCLUIDA', conn);
    expect(conn.commit).toHaveBeenCalledTimes(1);
  });

  it('impede emissão para aluno sem frequência mínima (UC13 — fluxo alternativo)', async () => {
    mockedTotais.mockResolvedValue({ totalAulas: 8, totalPresencas: 5 }); // 62,5%

    await expect(service.emitir(7)).rejects.toThrow(/Frequência insuficiente/);

    expect(mockedCreate).not.toHaveBeenCalled();
    expect(conn.rollback).toHaveBeenCalledTimes(1);
  });

  it('impede emissão com turma ainda não encerrada', async () => {
    mockedTurmaUpdate.mockResolvedValue({ id: 10, status: 'ATIVA' });

    await expect(service.emitir(7)).rejects.toThrow(
      'O certificado só pode ser emitido após o encerramento da turma.',
    );

    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('impede emissão para matrícula cancelada (RN01)', async () => {
    mockedFindById.mockResolvedValue({ id: 7, turma_id: 10, status: 'CANCELADA' });

    await expect(service.emitir(7)).rejects.toThrow(
      'Matrícula cancelada: aluno não está apto a receber certificado.',
    );

    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('impede emissão duplicada para a mesma matrícula', async () => {
    mockedFindCert.mockResolvedValue({ id: 1 });

    await expect(service.emitir(7)).rejects.toThrow(
      'Já existe um certificado emitido para esta matrícula.',
    );

    expect(mockedCreate).not.toHaveBeenCalled();
  });
});
