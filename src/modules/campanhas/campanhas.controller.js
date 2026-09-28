// campanhas.controller.js — handlers de campanhas (RF_22–25).
// Módulo restrito ao ADMINISTRADOR (aplica authorize() nas rotas).
import { TIPOS_DOACAO, ROTULOS_TIPOS_DOACAO } from '../../utils/tiposDoacao.js';
import { ROTULOS_STATUS_CAMPANHA } from './campanhas.service.js';
import * as service from './campanhas.service.js';
import * as estoqueService from '../estoque/estoque.service.js';
import * as beneficiariosService from '../beneficiarios/beneficiarios.service.js';

function notFound(res, message) {
  res.status(404).render('pages/error', { title: 'Erro 404', status: 404, message });
}

/** Itens ativos agrupados por tipo, para o <select> de resultados (RF_24). */
function itensPorTipo(itens) {
  return TIPOS_DOACAO.map((tipo) => ({
    tipo,
    rotulo: ROTULOS_TIPOS_DOACAO[tipo],
    itens: itens.filter((i) => i.tipo_doacao === tipo),
  })).filter((grupo) => grupo.itens.length);
}

async function listar(req, res) {
  const status = String(req.query.status || '').trim();
  const inicio = String(req.query.inicio || '').trim();
  const fim = String(req.query.fim || '').trim();
  const campanhas = await service.listar({ status, inicio, fim });
  res.render('campanhas/list', {
    title: 'Campanhas',
    campanhas,
    status,
    inicio,
    fim,
    rotulosStatus: ROTULOS_STATUS_CAMPANHA,
  });
}

function formularioNova(req, res) {
  res.render('campanhas/form', {
    title: 'Nova campanha',
    campanha: null,
    erro: null,
    form: {},
  });
}

async function criar(req, res) {
  try {
    await service.criar(req.body);
    req.session.flash = { type: 'success', message: 'Campanha cadastrada.' };
    res.redirect('/campanhas');
  } catch (err) {
    res.status(400).render('campanhas/form', {
      title: 'Nova campanha',
      campanha: null,
      erro: err.message,
      form: req.body,
    });
  }
}

async function detalhar(req, res) {
  const campanha = await service.obter(req.params.id);
  if (!campanha) return notFound(res, 'Campanha não encontrada.');

  const [voluntarios, atendimentos, distribuicoes] = await Promise.all([
    service.listarVoluntarios(campanha.id),
    service.listarAtendimentos(campanha.id),
    service.listarDistribuicoes(campanha.id),
  ]);

  res.render('campanhas/detalhe', {
    title: campanha.titulo,
    campanha,
    voluntarios,
    atendimentos,
    distribuicoes,
    rotulosStatus: ROTULOS_STATUS_CAMPANHA,
    rotulosTipos: ROTULOS_TIPOS_DOACAO,
  });
}

async function formularioEditar(req, res) {
  const campanha = await service.obter(req.params.id);
  if (!campanha) return notFound(res, 'Campanha não encontrada.');
  res.render('campanhas/form', {
    title: 'Editar campanha',
    campanha,
    erro: null,
    form: campanha,
  });
}

async function atualizar(req, res) {
  try {
    await service.atualizar(req.params.id, req.body);
    req.session.flash = { type: 'success', message: 'Campanha atualizada.' };
    res.redirect('/campanhas');
  } catch (err) {
    const campanha = { ...req.body, id: req.params.id };
    res.status(400).render('campanhas/form', {
      title: 'Editar campanha',
      campanha,
      erro: err.message,
      form: req.body,
    });
  }
}

async function excluir(req, res) {
  await service.excluir(req.params.id);
  req.session.flash = { type: 'success', message: 'Campanha excluída.' };
  res.redirect('/campanhas');
}

// --- Associação de voluntários (RF_23) ---

async function formularioAssociar(req, res) {
  const campanha = await service.obter(req.params.id);
  if (!campanha) return notFound(res, 'Campanha não encontrada.');

  const [associados, disponiveis] = await Promise.all([
    service.listarVoluntarios(campanha.id),
    service.listarVoluntariosDisponiveis(campanha.id),
  ]);

  res.render('campanhas/associar', {
    title: 'Associar voluntários',
    campanha,
    associados,
    disponiveis,
    erro: null,
  });
}

async function associarVoluntario(req, res) {
  try {
    await service.associarVoluntario(req.params.id, req.body.voluntario_id);
    req.session.flash = { type: 'success', message: 'Voluntário associado à campanha.' };
  } catch (err) {
    req.session.flash = { type: 'error', message: err.message };
  }
  res.redirect(`/campanhas/${req.params.id}/voluntarios`);
}

async function removerVoluntario(req, res) {
  await service.removerVoluntario(req.params.id, req.params.voluntarioId);
  req.session.flash = { type: 'success', message: 'Voluntário removido da campanha.' };
  res.redirect(`/campanhas/${req.params.id}/voluntarios`);
}

// --- Resultados (RF_24) ---

async function formularioResultados(req, res) {
  const campanha = await service.obter(req.params.id);
  if (!campanha) return notFound(res, 'Campanha não encontrada.');

  const beneficiarios = await beneficiariosService.listar({});
  const itens = itensPorTipo(await estoqueService.listarItensParaSelecao());
  res.render('campanhas/resultados', {
    title: 'Registrar resultados',
    campanha,
    beneficiarios,
    itens,
    erro: null,
  });
}

async function registrarAtendimento(req, res) {
  try {
    await service.registrarAtendimento(req.params.id, req.body, req.session.user?.id || null);
    req.session.flash = { type: 'success', message: 'Beneficiário atendido registrado.' };
  } catch (err) {
    req.session.flash = { type: 'error', message: err.message };
  }
  res.redirect(`/campanhas/${req.params.id}/resultados`);
}

async function registrarDistribuicao(req, res) {
  try {
    await service.registrarDistribuicao(req.params.id, req.body, req.session.user?.id || null);
    req.session.flash = { type: 'success', message: 'Doação distribuída registrada.' };
  } catch (err) {
    req.session.flash = { type: 'error', message: err.message };
  }
  res.redirect(`/campanhas/${req.params.id}/resultados`);
}

export {
  listar,
  formularioNova,
  criar,
  detalhar,
  formularioEditar,
  atualizar,
  excluir,
  formularioAssociar,
  associarVoluntario,
  removerVoluntario,
  formularioResultados,
  registrarAtendimento,
  registrarDistribuicao,
};