// relatorios.service.test.js — consolidação dos relatórios (RF_26–28, UC12)
// com o repository mockado (sem banco).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/modules/relatorios/relatorios.repository.js', () => ({
  resumoDoacoesRecebidas: vi.fn(),
  resumoDoacoesDistribuidas: vi.fn(),
  resumoDoacoesRecebidasPorItem: vi.fn(),
  resumoDoacoesDistribuidasPorItem: vi.fn(),
  atendimentosPorBeneficiario: vi.fn(),
  distribuicoesPorBeneficiario: vi.fn(),
  matriculasPorBeneficiario: vi.fn(),
  nomesBeneficiarios: vi.fn(),
  campanhasConsolidadas: vi.fn(),
}));

import * as repository from '../../src/modules/relatorios/relatorios.repository.js';
import * as service from '../../src/modules/relatorios/relatorios.service.js';

const repo = vi.mocked(repository);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('relatorioDoacoes (RF_26)', () => {
  beforeEach(() => {
    repo.resumoDoacoesRecebidasPorItem.mockResolvedValue([]);
    repo.resumoDoacoesDistribuidasPorItem.mockResolvedValue([]);
  });

  it('consolida recebidas e distribuídas por tipo, com totais', async () => {
    repo.resumoDoacoesRecebidas.mockResolvedValue([
      { tipo_doacao: 'ALIMENTOS', num_doacoes: 3, total_recebida: 10, num_doadores: 2 },
    ]);
    repo.resumoDoacoesDistribuidas.mockResolvedValue([
      { tipo_doacao: 'ALIMENTOS', num_distribuicoes: 2, total_distribuida: 4, num_beneficiarios: 2 },
      { tipo_doacao: 'ROUPAS', num_distribuicoes: 1, total_distribuida: 3, num_beneficiarios: 1 },
    ]);

    const { linhas, totais } = await service.relatorioDoacoes({});

    const alimentos = linhas.find((l) => l.tipo === 'ALIMENTOS');
    const roupas = linhas.find((l) => l.tipo === 'ROUPAS');
    expect(alimentos).toMatchObject({
      num_doacoes: 3,
      total_recebida: 10,
      num_distribuicoes: 2,
      total_distribuida: 4,
    });
    expect(roupas).toMatchObject({ num_doacoes: 0, total_distribuida: 3 });
    expect(totais).toMatchObject({
      num_doacoes: 3,
      total_recebida: 10,
      num_distribuicoes: 3,
      total_distribuida: 7,
    });
  });

  it('detalha por item, juntando recebidas e distribuídas pela chave tipo+item', async () => {
    repo.resumoDoacoesRecebidas.mockResolvedValue([
      { tipo_doacao: 'ALIMENTOS', num_doacoes: 2, total_recebida: 20, num_doadores: 1 },
    ]);
    repo.resumoDoacoesDistribuidas.mockResolvedValue([
      { tipo_doacao: 'ALIMENTOS', num_distribuicoes: 1, total_distribuida: 8, num_beneficiarios: 1 },
    ]);
    repo.resumoDoacoesRecebidasPorItem.mockResolvedValue([
      { tipo_doacao: 'ALIMENTOS', nome_item: 'Leite 1L', num_doacoes: 2, total_recebida: 20 },
    ]);
    repo.resumoDoacoesDistribuidasPorItem.mockResolvedValue([
      { tipo_doacao: 'ALIMENTOS', nome_item: 'Leite 1L', num_distribuicoes: 1, total_distribuida: 8 },
      { tipo_doacao: 'ALIMENTOS', nome_item: 'Arroz 5kg', num_distribuicoes: 1, total_distribuida: 5 },
    ]);

    const { linhasItens } = await service.relatorioDoacoes({});

    expect(linhasItens.find((l) => l.nome_item === 'Leite 1L')).toMatchObject({
      num_doacoes: 2,
      total_recebida: 20,
      num_distribuicoes: 1,
      total_distribuida: 8,
    });
    expect(linhasItens.find((l) => l.nome_item === 'Arroz 5kg')).toMatchObject({
      num_doacoes: 0,
      total_recebida: 0,
      num_distribuicoes: 1,
      total_distribuida: 5,
    });
  });

  it('rejeita período com data inicial maior que a final', async () => {
    await expect(
      service.relatorioDoacoes({ inicio: '2026-09-30', fim: '2026-09-01' }),
    ).rejects.toThrow('inicial não pode ser maior');
  });

  it('rejeita tipo de doação inválido', async () => {
    await expect(service.relatorioDoacoes({ tipo: 'DINHEIRO' })).rejects.toThrow(
      'Tipo de doação inválido',
    );
  });
});

describe('relatorioAtendimentos (RF_27)', () => {
  it('une atendimentos, distribuições e matrículas por beneficiário', async () => {
    repo.atendimentosPorBeneficiario.mockResolvedValue([
      { beneficiario_id: 1, num_atendimentos: 2 },
    ]);
    repo.distribuicoesPorBeneficiario.mockResolvedValue([
      { beneficiario_id: 1, num_distribuicoes: 3, itens_recebidos: 7 },
      { beneficiario_id: 2, num_distribuicoes: 1, itens_recebidos: 2 },
    ]);
    repo.matriculasPorBeneficiario.mockResolvedValue([{ beneficiario_id: 2, num_matriculas: 1 }]);
    repo.nomesBeneficiarios.mockResolvedValue([
      { id: 1, nome: 'Maria' },
      { id: 2, nome: 'João' },
    ]);

    const { linhas, totais } = await service.relatorioAtendimentos({});

    expect(linhas).toHaveLength(2);
    expect(linhas.find((l) => l.nome === 'Maria')).toMatchObject({
      num_atendimentos: 2,
      num_distribuicoes: 3,
      itens_recebidos: 7,
      num_matriculas: 0,
    });
    expect(linhas.find((l) => l.nome === 'João')).toMatchObject({
      num_atendimentos: 0,
      num_matriculas: 1,
    });
    expect(totais.num_atendimentos).toBe(2);
    expect(totais.itens_recebidos).toBe(9);
  });
});

describe('relatorioCampanhas (RF_28)', () => {
  it('formata período e consolida resultados', async () => {
    repo.campanhasConsolidadas.mockResolvedValue([
      {
        id: 1,
        titulo: 'Campanha do Agasalho',
        status: 'ENCERRADA',
        data_inicio: new Date('2026-06-01T00:00:00Z'),
        data_fim: new Date('2026-06-30T00:00:00Z'),
        num_voluntarios: 5,
        beneficiarios_atendidos: 12,
        itens_distribuidos: 40,
      },
    ]);

    const { linhas, totais } = await service.relatorioCampanhas({});

    expect(linhas[0].periodo).toBe('01/06/2026 a 30/06/2026');
    expect(linhas[0].beneficiarios_atendidos).toBe(12);
    expect(totais.itens_distribuidos).toBe(40);
  });

  it('rejeita status de campanha inválido', async () => {
    await expect(service.relatorioCampanhas({ status: 'XYZ' })).rejects.toThrow(
      'Status de campanha inválido',
    );
  });
});
