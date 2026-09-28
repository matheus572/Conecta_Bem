// doacoes.controller.js — handlers de doações e distribuições (RF_13, RF_15, RF_17).
// Sprint 6: distribuição seleciona ITEM (select); o tipo é derivado no service.
// Sprint 7 (RF_13): doação recebe o nome do item digitado (datalist) +
// categoria; item inexistente é criado automaticamente no service.
import { TIPOS_DOACAO, ROTULOS_TIPOS_DOACAO, UNIDADES_ITEM } from '../../utils/tiposDoacao.js';
import * as doacoesService from './doacoes.service.js';
import * as estoqueService from '../estoque/estoque.service.js';
import * as doadoresService from '../doadores/doadores.service.js';
import * as beneficiariosService from '../beneficiarios/beneficiarios.service.js';

function tiposParaView() {
  return TIPOS_DOACAO.map((tipo) => ({ valor: tipo, rotulo: ROTULOS_TIPOS_DOACAO[tipo] }));
}

/** Itens ativos agrupados por tipo, para os <select> com <optgroup>. */
function itensPorTipo(itens) {
  return TIPOS_DOACAO.map((tipo) => ({
    tipo,
    rotulo: ROTULOS_TIPOS_DOACAO[tipo],
    itens: itens.filter((i) => i.tipo_doacao === tipo),
  })).filter((grupo) => grupo.itens.length);
}

async function listarDoacoes(req, res) {
  const tipo = String(req.query.tipo || '').trim();
  const inicio = String(req.query.inicio || '').trim();
  const fim = String(req.query.fim || '').trim();
  const doacoes = await doacoesService.listarDoacoes({ tipo, inicio, fim });
  res.render('doacoes/list', { title: 'Doações', doacoes, tipo, inicio, fim, tipos: tiposParaView() });
}

async function listarDistribuicoes(req, res) {
  const tipo = String(req.query.tipo || '').trim();
  const inicio = String(req.query.inicio || '').trim();
  const fim = String(req.query.fim || '').trim();
  const distribuicoes = await doacoesService.listarDistribuicoes({ tipo, inicio, fim });
  res.render('doacoes/distribuicoes', {
    title: 'Distribuições',
    distribuicoes,
    tipo,
    inicio,
    fim,
    tipos: tiposParaView(),
  });
}

async function formularioNovaDoacao(req, res) {
  const doadores = await doadoresService.listar({});
  const itens = await estoqueService.listarItensParaSelecao();
  res.render('doacoes/form', {
    title: 'Registrar doação',
    itens,
    tipos: tiposParaView(),
    unidades: UNIDADES_ITEM,
    doadores,
    erro: null,
    form: {},
  });
}

async function criarDoacao(req, res) {
  try {
    await doacoesService.registrarDoacao(req.body, req.session.user?.id || null);
    req.session.flash = { type: 'success', message: 'Doação registrada e estoque atualizado.' };
    res.redirect('/doacoes');
  } catch (err) {
    const doadores = await doadoresService.listar({});
    const itens = await estoqueService.listarItensParaSelecao();
    res.status(400).render('doacoes/form', {
      title: 'Registrar doação',
      itens,
      tipos: tiposParaView(),
      unidades: UNIDADES_ITEM,
      doadores,
      erro: err.message,
      form: req.body,
    });
  }
}

async function formularioNovaDistribuicao(req, res) {
  const beneficiarios = await beneficiariosService.listar({});
  const itens = itensPorTipo(await estoqueService.listarItensParaSelecao());
  res.render('doacoes/distribuicao-form', {
    title: 'Registrar distribuição',
    itens,
    beneficiarios,
    erro: null,
    form: {},
  });
}

async function criarDistribuicao(req, res) {
  try {
    await doacoesService.registrarDistribuicao(req.body, req.session.user?.id || null);
    req.session.flash = { type: 'success', message: 'Distribuição registrada e estoque atualizado.' };
    res.redirect('/doacoes/distribuicoes');
  } catch (err) {
    const beneficiarios = await beneficiariosService.listar({});
    const itens = itensPorTipo(await estoqueService.listarItensParaSelecao());
    res.status(400).render('doacoes/distribuicao-form', {
      title: 'Registrar distribuição',
      itens,
      beneficiarios,
      erro: err.message,
      form: req.body,
    });
  }
}

export {
  listarDoacoes,
  listarDistribuicoes,
  formularioNovaDoacao,
  criarDoacao,
  formularioNovaDistribuicao,
  criarDistribuicao,
};