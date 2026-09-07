// doadores.controller.js — handlers de doadores (RF_09–12).
import * as service from './doadores.service.js';

function notFound(res, message) {
  res.status(404).render('pages/error', { title: 'Erro 404', status: 404, message });
}

async function listar(req, res) {
  const q = String(req.query.q || '').trim();
  const tipo = String(req.query.tipo || '').trim();
  const doadores = await service.listar({ q, tipo });
  res.render('doadores/list', { title: 'Doadores', doadores, q, tipo });
}

function formularioNovo(req, res) {
  res.render('doadores/form', { title: 'Novo doador', doador: null, erro: null, form: {} });
}

async function criar(req, res) {
  try {
    await service.criar(req.body);
    req.session.flash = { type: 'success', message: 'Doador cadastrado.' };
    res.redirect('/doadores');
  } catch (err) {
    res.status(400).render('doadores/form', {
      title: 'Novo doador',
      doador: null,
      erro: err.message,
      form: req.body,
    });
  }
}

async function formularioEditar(req, res) {
  const doador = await service.obter(req.params.id);
  if (!doador) return notFound(res, 'Doador não encontrado.');
  res.render('doadores/form', { title: 'Editar doador', doador, erro: null, form: doador });
}

async function atualizar(req, res) {
  try {
    await service.atualizar(req.params.id, req.body);
    req.session.flash = { type: 'success', message: 'Doador atualizado.' };
    res.redirect('/doadores');
  } catch (err) {
    const doador = { ...req.body, id: req.params.id };
    res.status(400).render('doadores/form', {
      title: 'Editar doador',
      doador,
      erro: err.message,
      form: req.body,
    });
  }
}

async function excluir(req, res) {
  await service.excluir(req.params.id);
  req.session.flash = { type: 'success', message: 'Doador excluído.' };
  res.redirect('/doadores');
}

export { listar, formularioNovo, criar, formularioEditar, atualizar, excluir };