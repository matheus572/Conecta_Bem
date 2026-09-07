import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/modules/doadores/doadores.repository.js', () => ({
  findByDocumento: vi.fn(),
  create: vi.fn(),
}));

import * as repository from '../../src/modules/doadores/doadores.repository.js';
import * as service from '../../src/modules/doadores/doadores.service.js';

const mockedFindByDocumento = vi.mocked(repository.findByDocumento);
const mockedCreate = vi.mocked(repository.create);

const doadorPf = {
  nome: 'João Doador',
  tipo_doador: 'PF',
  documento: '529.982.247-25',
  telefone: '(18) 99999-0000',
  endereco: 'Rua B, 2',
};

describe('doadores.service — criar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFindByDocumento.mockResolvedValue(null);
    mockedCreate.mockResolvedValue(1);
  });

  it('rejeita documento duplicado', async () => {
    mockedFindByDocumento.mockResolvedValue({ id: 3 });
    await expect(service.criar(doadorPf)).rejects.toThrow('Já existe um doador com este CPF/CNPJ.');
  });

  it('rejeita CPF inválido em pessoa física', async () => {
    await expect(service.criar({ ...doadorPf, documento: '529.982.247-26' })).rejects.toThrow('CPF inválido.');
  });

  it('rejeita CNPJ inválido em pessoa jurídica', async () => {
    await expect(
      service.criar({
        nome: 'Empresa Exemplo',
        tipo_doador: 'PJ',
        documento: '11.222.333/0001-82',
      }),
    ).rejects.toThrow('CNPJ inválido.');
  });

  it('rejeita tipo de doador inválido', async () => {
    await expect(service.criar({ ...doadorPf, tipo_doador: 'XX' })).rejects.toThrow('Tipo de doador inválido.');
  });

  it('normaliza o documento e persiste em criação válida', async () => {
    await service.criar(doadorPf);
    const chamada = mockedCreate.mock.calls[0][0];
    expect(chamada.documento).toBe('52998224725');
    expect(chamada.tipoDoador).toBe('PF');
  });
});