// estoque.controller.js — handlers de estoque (RF_14, RF_16/RF_S04).
import { TIPOS_DOACAO, ROTULOS_TIPOS_DOACAO } from '../../utils/tiposDoacao.js';
import * as service from './estoque.service.js';

async function listar(req, res) {
  const tipo = String(req.query.tipo || '').trim();
  const status = String(req.query.status || '').trim();
  const itens = await service.listar({ tipo, status });
  res.render('estoque/list', {
    title: 'Estoque',
    itens,
    tipo,
    status,
    tipos: TIPOS_DOACAO,
    rotulos: ROTULOS_TIPOS_DOACAO,
  });
}

async function atualizarMinimo(req, res) {
  try {
    await service.atualizarMinimo(req.params.tipo, req.body.estoque_minimo);
    req.session.flash = { type: 'success', message: 'Estoque mínimo atualizado.' };
  } catch (err) {
    req.session.flash = { type: 'error', message: err.message };
  }
  const redirect = req.query.tipo ? `?tipo=${encodeURIComponent(String(req.query.tipo).trim())}` : '';
  res.redirect(`/estoque${redirect}`);
}

export { listar, atualizarMinimo };