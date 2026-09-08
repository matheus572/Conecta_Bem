import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/modules/voluntarios/voluntarios.repository.js', () => ({
  findByCpf: vi.fn(),
  create: vi.fn(),
}));

import * as repository from '../../src/modules/voluntarios/voluntarios.repository.js';
import * as service from '../../src/modules/voluntarios/voluntarios.service.js';

const mockedFindByCpf = vi.mocked(repository.findByCpf);
const mockedCreate = vi.mocked(repository.create);

const dadosValidos = {
  nome: 'Ana Voluntária',
  cpf: '529.982.247-25',
  telefone: '(18) 99999-1111',
  especialidade: 'Recreação',
  disponibilidade: 'Sábados pela manhã',
};

describe('voluntarios.service — criar (RN04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFindByCpf.mockResolvedValue(null);
    mockedCreate.mockResolvedValue(1);
  });

  it('rejeita CPF duplicado', async () => {
    mockedFindByCpf.mockResolvedValue({ id: 5 });
    await expect(service.criar(dadosValidos)).rejects.toThrow('Já existe um voluntário com este CPF.');
  });

  it('rejeita CPF inválido (dígito verificador)', async () => {
    await expect(service.criar({ ...dadosValidos, cpf: '529.982.247-26' })).rejects.toThrow('CPF inválido.');
  });

  it('rejeita nome vazio', async () => {
    await expect(service.criar({ ...dadosValidos, nome: '  ' })).rejects.toThrow('Nome é obrigatório.');
  });

  it('normaliza o CPF e persiste em criação válida', async () => {
    await service.criar(dadosValidos);
    const chamada = mockedCreate.mock.calls[0][0];
    expect(chamada.cpf).toBe('52998224725');
    expect(chamada.especialidade).toBe('Recreação');
  });
});