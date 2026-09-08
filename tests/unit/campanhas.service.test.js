import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config/db.js', () => ({
  pool: { getConnection: vi.fn() },
}));

vi.mock('../../src/modules/campanhas/campanhas.repository.js', () => ({
  create: vi.fn(),
  findAssociacao: vi.fn(),
  associarVoluntario: vi.fn(),
}));

vi.mock('../../src/modules/voluntarios/voluntarios.repository.js', () => ({
  findById: vi.fn(),
}));

vi.mock('../../src/modules/beneficiarios/beneficiarios.repository.js', () => ({
  findById: vi.fn(),
}));

vi.mock('../../src/modules/doacoes/doacoes.service.js', () => ({
  registrarDistribuicao: vi.fn(),
}));

import * as repository from '../../src/modules/campanhas/campanhas.repository.js';
import * as voluntariosRepo from '../../src/modules/voluntarios/voluntarios.repository.js';
import * as service from '../../src/modules/campanhas/campanhas.service.js';

const mockedCreate = vi.mocked(repository.create);
const mockedFindAssociacao = vi.mocked(repository.findAssociacao);
const mockedAssociar = vi.mocked(repository.associarVoluntario);
const mockedFindVoluntario = vi.mocked(voluntariosRepo.findById);

const dadosValidos = {
  titulo: 'Campanha do Agasalho',
  descricao: 'Arrecadação de agasalhos',
  data_inicio: '2026-09-01',
  data_fim: '2026-09-30',
  status: 'ATIVA',
};

describe('campanhas.service — datas (UC11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreate.mockResolvedValue(1);
  });

  it('rejeita data de término anterior à de início (mensagem amigável)', async () => {
    await expect(
      service.criar({ ...dadosValidos, data_inicio: '2026-09-30', data_fim: '2026-09-01' }),
    ).rejects.toThrow('A data de término deve ser igual ou posterior à data de início.');
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it('valida diretamente o período via validarPeriodo', () => {
    expect(() => service.validarPeriodo('2026-09-01', '2026-09-30')).not.toThrow();
    expect(() => service.validarPeriodo('2026-09-30', '2026-09-01')).toThrow(
      'A data de término deve ser igual ou posterior à data de início.',
    );
  });

  it('aceita período válido e persiste', async () => {
    await service.criar(dadosValidos);
    const chamada = mockedCreate.mock.calls[0][0];
    expect(chamada.dataInicio).toBe('2026-09-01');
    expect(chamada.dataFim).toBe('2026-09-30');
    expect(chamada.status).toBe('ATIVA');
  });
});

describe('campanhas.service — associação de voluntário (RF_23)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFindVoluntario.mockResolvedValue({ id: 3, nome: 'Ana' });
  });

  it('rejeita associação duplicada com mensagem amigável', async () => {
    mockedFindAssociacao.mockResolvedValue({ id: 1 });
    await expect(service.associarVoluntario(10, '3')).rejects.toThrow(
      'Este voluntário já está associado a esta campanha.',
    );
    expect(mockedAssociar).not.toHaveBeenCalled();
  });

  it('associa voluntário quando não há duplicidade', async () => {
    mockedFindAssociacao.mockResolvedValue(null);
    await service.associarVoluntario(10, '3');
    expect(mockedAssociar).toHaveBeenCalledWith(10, '3');
  });

  it('rejeita associação de voluntário inexistente', async () => {
    mockedFindVoluntario.mockResolvedValue(null);
    await expect(service.associarVoluntario(10, '999')).rejects.toThrow('Voluntário não encontrado.');
  });
});