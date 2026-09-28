// dashboard.service.test.js — cálculo de cada indicador do painel (RF_29/UC14)
// com o repository mockado (sem banco). Sprint 6: alerta por item.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/modules/dashboard/dashboard.repository.js', () => ({
  totalBeneficiariosAtivos: vi.fn(),
  doacoesDoMes: vi.fn(),
  totalVoluntariosAtivos: vi.fn(),
  proximasCampanhas: vi.fn(),
  itensEstoqueAbaixoMinimo: vi.fn(),
}));

import * as repository from '../../src/modules/dashboard/dashboard.repository.js';
import * as service from '../../src/modules/dashboard/dashboard.service.js';

const repo = vi.mocked(repository);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('dashboard — indicadores (RF_29)', () => {
  it('consolida os quatro indicadores a partir das consultas', async () => {
    repo.totalBeneficiariosAtivos.mockResolvedValue(12);
    repo.doacoesDoMes.mockResolvedValue(7);
    repo.totalVoluntariosAtivos.mockResolvedValue(20);
    repo.proximasCampanhas.mockResolvedValue([
      {
        id: 1,
        titulo: 'Campanha do Agasalho',
        status: 'PLANEJADA',
        data_inicio: new Date('2026-10-01T00:00:00Z'),
        data_fim: new Date('2026-10-31T00:00:00Z'),
      },
    ]);
    repo.itensEstoqueAbaixoMinimo.mockResolvedValue([
      { item_id: 7, nome_item: 'Leite 1L', tipo_doacao: 'ALIMENTOS', quantidade: 2, estoque_minimo: 5 },
    ]);

    const dados = await service.indicadores();

    expect(dados.beneficiariosAtivos).toBe(12);
    expect(dados.doacoesMes).toBe(7);
    expect(dados.voluntariosAtivos).toBe(20);
    expect(dados.proximasCampanhas).toHaveLength(1);
    expect(dados.proximasCampanhas[0].periodo).toBe('01/10/2026 a 31/10/2026');
    expect(dados.estoqueAbaixoMinimo).toEqual([
      { item_id: 7, tipo: 'ALIMENTOS', rotulo: 'Leite 1L', quantidade: 2, minimo: 5 },
    ]);
    expect(dados.vazio).toBe(false);
  });

  it('base vazia produz indicadores zerados com flag vazio (UC14 — fluxo alternativo)', async () => {
    repo.totalBeneficiariosAtivos.mockResolvedValue(0);
    repo.doacoesDoMes.mockResolvedValue(0);
    repo.totalVoluntariosAtivos.mockResolvedValue(0);
    repo.proximasCampanhas.mockResolvedValue([]);
    repo.itensEstoqueAbaixoMinimo.mockResolvedValue([]);

    const dados = await service.indicadores();

    expect(dados).toMatchObject({
      beneficiariosAtivos: 0,
      doacoesMes: 0,
      voluntariosAtivos: 0,
      proximasCampanhas: [],
      estoqueAbaixoMinimo: [],
      vazio: true,
    });
  });
});
