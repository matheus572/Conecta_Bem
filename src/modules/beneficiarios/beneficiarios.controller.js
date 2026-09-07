// beneficiarios.controller.js — handlers de beneficiários (RF_05–08).
import * as service from './beneficiarios.service.js';

function notFound(res, message) {
  res.status(404).render('pages/error', { title: 'Erro 404', status: 404, message });
}

async function listar(req, res) {
  const q = String(req.query.q || '').trim();
  const status = String(req.query.status || '').trim();
  const beneficiarios = await service.listar({ q, status });
  res.render('beneficiarios/list', { title: 'Beneficiários', beneficiarios, q, status });
}

function formularioNovo(req, res) {
  res.render('beneficiarios/form', {
    title: 'Novo beneficiário',
    beneficiario: null,
    erro: null,
    form: {},
  });
}

async function criar(req, res) {
  try {
    await service.criar(req.body);
    req.session.flash = { type: 'success', message: 'Beneficiário cadastrado.' };
    res.redirect('/beneficiarios');
  } catch (err) {
    res.status(400).render('beneficiarios/form', {
      title: 'Novo beneficiário',
      beneficiario: null,
      erro: err.message,
      form: req.body,
    });
  }
}

async function formularioEditar(req, res) {
  const beneficiario = await service.obter(req.params.id);
  if (!beneficiario) return notFound(res, 'Beneficiário não encontrado.');
  res.render('beneficiarios/form', {
    title: 'Editar beneficiário',
    beneficiario,
    erro: null,
    form: beneficiario,
  });
}

async function atualizar(req, res) {
  try {
    await service.atualizar(req.params.id, req.body);
    req.session.flash = { type: 'success', message: 'Beneficiário atualizado.' };
    res.redirect('/beneficiarios');
  } catch (err) {
    const beneficiario = { ...req.body, id: req.params.id };
    res.status(400).render('beneficiarios/form', {
      title: 'Editar beneficiário',
      beneficiario,
      erro: err.message,
      form: req.body,
    });
  }
}

async function excluir(req, res) {
  await service.excluir(req.params.id);
  req.session.flash = { type: 'success', message: 'Beneficiário excluído.' };
  res.redirect('/beneficiarios');
}

export { listar, formularioNovo, criar, formularioEditar, atualizar, excluir };