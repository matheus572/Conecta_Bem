// dashboard.service.js — consolidação dos indicadores (RF_29/UC14).
import * as repository from './dashboard.repository.js';
import { ROTULOS_TIPOS_DOACAO } from '../../utils/tiposDoacao.js';
import { formatarData } from '../relatorios/relatorios.service.js';

/**
 * Monta o conjunto de indicadores do painel. Com a base vazia, retorna tudo
 * zerado/listas vazias — o fluxo alternativo do UC14 (indicadores zerados com
 * mensagem orientativa) é tratado na view a partir de `vazio`.
 */
async function indicadores() {
  const [beneficiariosAtivos, doacoesMes, voluntariosAtivos, proximasCampanhas, estoqueBaixo] =
    await Promise.all([
      repository.totalBeneficiariosAtivos(),
      repository.doacoesDoMes(),
      repository.totalVoluntariosAtivos(),
      repository.proximasCampanhas(),
      repository.tiposEstoqueAbaixoMinimo(),
    ]);

  const campanhas = proximasCampanhas.map((c) => ({
    ...c,
    periodo: `${formatarData(c.data_inicio)} a ${formatarData(c.data_fim)}`,
  }));

  const estoqueAbaixoMinimo = estoqueBaixo.map((e) => ({
    tipo: e.tipo_doacao,
    rotulo: ROTULOS_TIPOS_DOACAO[e.tipo_doacao] || e.tipo_doacao,
    quantidade: Number(e.quantidade),
    minimo: Number(e.estoque_minimo),
  }));

  const vazio =
    beneficiariosAtivos === 0 &&
    doacoesMes === 0 &&
    voluntariosAtivos === 0 &&
    campanhas.length === 0;

  return {
    beneficiariosAtivos,
    doacoesMes,
    voluntariosAtivos,
    proximasCampanhas: campanhas,
    estoqueAbaixoMinimo,
    vazio,
  };
}

export { indicadores };
