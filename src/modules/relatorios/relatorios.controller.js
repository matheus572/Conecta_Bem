// relatorios.controller.js — handlers dos relatórios (RF_26–28, RF_29a/UC12).
import * as service from './relatorios.service.js';
import { gerarPdf, gerarXlsx } from '../../utils/exportacao.js';
import { TIPOS_DOACAO, ROTULOS_TIPOS_DOACAO } from '../../utils/tiposDoacao.js';

const STATUS_CAMPANHA = ['PLANEJADA', 'ATIVA', 'ENCERRADA'];

function index(req, res) {
  res.render('relatorios/index', { title: 'Relatórios' });
}

/** Devolve o relatório como download (PDF ou .xlsx) com cabeçalhos corretos. */
async function responderExportacao(res, formato, nomeBase, payload) {
  const hoje = new Date().toISOString().slice(0, 10);
  if (formato === 'pdf') {
    const buffer = await gerarPdf(payload);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeBase}-${hoje}.pdf"`);
    return res.send(buffer);
  }
  const buffer = await gerarXlsx(payload);
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${nomeBase}-${hoje}.xlsx"`);
  return res.send(buffer);
}

/** Query string dos filtros, para os botões de exportação preservarem o filtro. */
function qsFiltros(filtros) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filtros)) {
    if (v) params.set(k, v);
  }
  const s = params.toString();
  return s ? `&${s}` : '';
}

/** Handlers com tratamento uniforme de erro de validação de filtro. */
function wrap(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      req.session.flash = { type: 'error', message: err.message };
      res.redirect('/relatorios');
    }
  };
}

const COLUNAS_DOACOES = [
  { header: 'Tipo', key: 'rotulo' },
  { header: 'Nº doações', key: 'num_doacoes' },
  { header: 'Qtd recebida', key: 'total_recebida' },
  { header: 'Doadores', key: 'num_doadores' },
  { header: 'Nº distribuições', key: 'num_distribuicoes' },
  { header: 'Qtd distribuída', key: 'total_distribuida' },
  { header: 'Beneficiários', key: 'num_beneficiarios' },
];

async function doacoes(req, res) {
  const { inicio = '', fim = '', tipo = '', formato = '' } = req.query;
  const dados = await service.relatorioDoacoes({ inicio, fim, tipo });

  if (formato === 'pdf' || formato === 'xlsx') {
    return responderExportacao(res, formato, 'relatorio-doacoes', {
      titulo: 'Relatório de Doações (recebidas e distribuídas)',
      colunas: COLUNAS_DOACOES,
      linhas: dados.linhas,
    });
  }

  return res.render('relatorios/doacoes', {
    title: 'Relatório de Doações',
    ...dados,
    inicio,
    fim,
    tipo,
    tipos: TIPOS_DOACAO,
    rotulos: ROTULOS_TIPOS_DOACAO,
    qs: qsFiltros({ inicio, fim, tipo }),
  });
}

const COLUNAS_ATENDIMENTOS = [
  { header: 'Beneficiário', key: 'nome' },
  { header: 'Atendimentos', key: 'num_atendimentos' },
  { header: 'Distribuições recebidas', key: 'num_distribuicoes' },
  { header: 'Itens recebidos', key: 'itens_recebidos' },
  { header: 'Matrículas', key: 'num_matriculas' },
];

async function atendimentos(req, res) {
  const { inicio = '', fim = '', formato = '' } = req.query;
  const dados = await service.relatorioAtendimentos({ inicio, fim });

  if (formato === 'pdf' || formato === 'xlsx') {
    return responderExportacao(res, formato, 'relatorio-atendimentos', {
      titulo: 'Relatório de Atendimentos por Período',
      colunas: COLUNAS_ATENDIMENTOS,
      linhas: dados.linhas,
    });
  }

  return res.render('relatorios/atendimentos', {
    title: 'Relatório de Atendimentos',
    ...dados,
    inicio,
    fim,
    qs: qsFiltros({ inicio, fim }),
  });
}

const COLUNAS_CAMPANHAS = [
  { header: 'Campanha', key: 'titulo' },
  { header: 'Status', key: 'status' },
  { header: 'Período', key: 'periodo' },
  { header: 'Voluntários', key: 'num_voluntarios' },
  { header: 'Beneficiários atendidos', key: 'beneficiarios_atendidos' },
  { header: 'Itens distribuídos', key: 'itens_distribuidos' },
];

async function campanhas(req, res) {
  const { inicio = '', fim = '', status = '', formato = '' } = req.query;
  const dados = await service.relatorioCampanhas({ inicio, fim, status });

  if (formato === 'pdf' || formato === 'xlsx') {
    return responderExportacao(res, formato, 'relatorio-campanhas', {
      titulo: 'Relatório de Campanhas — Resultados Consolidados',
      colunas: COLUNAS_CAMPANHAS,
      linhas: dados.linhas,
    });
  }

  return res.render('relatorios/campanhas', {
    title: 'Relatório de Campanhas',
    ...dados,
    inicio,
    fim,
    status,
    statusOpcoes: STATUS_CAMPANHA,
    qs: qsFiltros({ inicio, fim, status }),
  });
}

const doacoesHandler = wrap(doacoes);
const atendimentosHandler = wrap(atendimentos);
const campanhasHandler = wrap(campanhas);

export {
  index,
  doacoesHandler as doacoes,
  atendimentosHandler as atendimentos,
  campanhasHandler as campanhas,
};
