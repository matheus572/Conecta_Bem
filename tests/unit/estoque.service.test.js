import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/modules/estoque/estoque.repository.js', () => ({
  listar: vi.fn(),
  atualizarMinimo: vi.fn(),
}));

import * as repository from '../../src/modules/estoque/estoque.repository.js';
import * as service from '../../src/modules/estoque/estoque.service.js';

const mockedListar = vi.mocked(repository.listar);
const mockedAtualizarMinimo = vi.mocked(repository.atualizarMinimo);

describe('estoque.service — indicador de estoque mínimo (RF_16/RF_S04)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marca itens abaixo do mínimo', async () => {
    mockedListar.mockResolvedValue([
      { id: 1, tipo_doacao: 'ALIMENTOS', quantidade: 5, estoque_minimo: 10 },
      { id: 2, tipo_doacao: 'ROUPAS', quantidade: 20, estoque_minimo: 10 },
    ]);

    const itens = await service.listar({});
    expect(itens[0].abaixo_minimo).toBe(true);
    expect(itens[1].abaixo_minimo).toBe(false);
  });

  it('filtra por status "baixo"', async () => {
    mockedListar.mockResolvedValue([
      { id: 1, tipo_doacao: 'ALIMENTOS', quantidade: 5, estoque_minimo: 10 },
      { id: 2, tipo_doacao: 'ROUPAS', quantidade: 20, estoque_minimo: 10 },
    ]);

    const itens = await service.listar({ status: 'baixo' });
    expect(itens).toHaveLength(1);
    expect(itens[0].tipo_doacao).toBe('ALIMENTOS');
  });

  it('rejeita tipo inválido', async () => {
    await expect(service.listar({ tipo: 'XXX' })).rejects.toThrow('Tipo de doação inválido.');
  });

  it('atualizarMinimo valida valor não-negativo', async () => {
    mockedAtualizarMinimo.mockResolvedValue(undefined);

    await service.atualizarMinimo('ALIMENTOS', '10');
    expect(mockedAtualizarMinimo).toHaveBeenCalledWith('ALIMENTOS', 10);

    await expect(service.atualizarMinimo('ALIMENTOS', '-1')).rejects.toThrow(
      'Estoque mínimo deve ser um número maior ou igual a zero.',
    );
  });
});