// voluntarios.controller.js — handlers de voluntários (RF_18–21).
// Permissão (§12.2 / RF_36): ADMINISTRADOR gerencia; COLABORADOR só consulta
// (a restrição de escrita é aplicada nas rotas via authorize()).
import * as service from './voluntarios.service.js';

function notFound(res, message) {
  res.status(404).render('pages/error', { title: 'Erro 404', status: 404, message });
}

async function listar(req, res) {
  const q = String(req.query.q || '').trim();
  const voluntarios = await service.listar({ q });
  res.render('voluntarios/list', { title: 'Voluntários', voluntarios, q });
}

function formularioNovo(req, res) {
  res.render('voluntarios/form', {
    title: 'Novo voluntário',
    voluntario: null,
    erro: null,
    form: {},
  });
}

async function criar(req, res) {
  try {
    await service.criar(req.body);
    req.session.flash = { type: 'success', message: 'Voluntário cadastrado.' };
    res.redirect('/voluntarios');
  } catch (err) {
    res.status(400).render('voluntarios/form', {
      title: 'Novo voluntário',
      voluntario: null,
      erro: err.message,
      form: req.body,
    });
  }
}

async function detalhar(req, res) {
  const voluntario = await service.obter(req.params.id);
  if (!voluntario) return notFound(res, 'Voluntário não encontrado.');

  const campanhas = await service.listarCampanhas(req.params.id);
  res.render('voluntarios/detalhe', { title: 'Voluntário', voluntario, campanhas });
}

async function formularioEditar(req, res) {
  const voluntario = await service.obter(req.params.id);
  if (!voluntario) return notFound(res, 'Voluntário não encontrado.');
  res.render('voluntarios/form', {
    title: 'Editar voluntário',
    voluntario,
    erro: null,
    form: voluntario,
  });
}

async function atualizar(req, res) {
  try {
    await service.atualizar(req.params.id, req.body);
    req.session.flash = { type: 'success', message: 'Voluntário atualizado.' };
    res.redirect('/voluntarios');
  } catch (err) {
    const voluntario = { ...req.body, id: req.params.id };
    res.status(400).render('voluntarios/form', {
      title: 'Editar voluntário',
      voluntario,
      erro: err.message,
      form: req.body,
    });
  }
}

async function excluir(req, res) {
  await service.excluir(req.params.id);
  req.session.flash = { type: 'success', message: 'Voluntário excluído.' };
  res.redirect('/voluntarios');
}

export { listar, formularioNovo, criar, detalhar, formularioEditar, atualizar, excluir };