// usuarios.controller.js — handlers de gestão de usuários (RF_04), admin-only.
import * as service from './usuarios.service.js';

function notFound(res, message) {
  res.status(404).render('pages/error', { title: 'Erro 404', status: 404, message });
}

async function listar(req, res) {
  const usuarios = await service.listar();
  res.render('usuarios/list', { title: 'Usuários', usuarios });
}

function formularioNovo(req, res) {
  res.render('usuarios/form', { title: 'Novo usuário', usuario: null, erro: null, form: {} });
}

async function criar(req, res) {
  try {
    await service.criar(req.body);
    req.session.flash = { type: 'success', message: 'Usuário criado com sucesso.' };
    res.redirect('/usuarios');
  } catch (err) {
    res.status(400).render('usuarios/form', {
      title: 'Novo usuário',
      usuario: null,
      erro: err.message,
      form: req.body,
    });
  }
}

async function formularioEditar(req, res) {
  const usuario = await service.obter(req.params.id);
  if (!usuario) return notFound(res, 'Usuário não encontrado.');
  res.render('usuarios/form', { title: 'Editar usuário', usuario, erro: null, form: usuario });
}

async function atualizar(req, res) {
  try {
    await service.atualizar(req.params.id, req.body);
    req.session.flash = { type: 'success', message: 'Usuário atualizado.' };
    res.redirect('/usuarios');
  } catch (err) {
    const usuario = { ...req.body, id: req.params.id };
    res.status(400).render('usuarios/form', {
      title: 'Editar usuário',
      usuario,
      erro: err.message,
      form: req.body,
    });
  }
}

async function alternarAtivo(req, res) {
  await service.alternarAtivo(req.params.id, req.body.ativo === '1');
  req.session.flash = { type: 'success', message: 'Status do usuário atualizado.' };
  res.redirect('/usuarios');
}

async function excluir(req, res) {
  await service.excluir(req.params.id);
  req.session.flash = { type: 'success', message: 'Usuário excluído.' };
  res.redirect('/usuarios');
}

export { listar, formularioNovo, criar, formularioEditar, atualizar, alternarAtivo, excluir };