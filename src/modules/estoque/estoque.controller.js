// estoque.controller.js — handlers de estoque (RF_14, RF_16/RF_S04) e CRUD de
// itens (Sprint 6 — granularidade por item).
import { TIPOS_DOACAO, ROTULOS_TIPOS_DOACAO } from '../../utils/tiposDoacao.js';
import * as service from './estoque.service.js';

function tiposParaView() {
  return TIPOS_DOACAO.map((tipo) => ({ valor: tipo, rotulo: ROTULOS_TIPOS_DOACAO[tipo] }));
}

async function listar(req, res) {
  const tipo = String(req.query.tipo || '').trim();
  const status = String(req.query.status || '').trim();
  const q = String(req.query.q || '').trim();
  const itens = await service.listar({ tipo, status, q });
  res.render('estoque/list', {
    title: 'Estoque',
    itens,
    tipo,
    status,
    q,
    tipos: TIPOS_DOACAO,
    rotulos: ROTULOS_TIPOS_DOACAO,
  });
}

async function atualizarMinimo(req, res) {
  try {
    await service.atualizarMinimo(req.params.itemId, req.body.estoque_minimo);
    req.session.flash = { type: 'success', message: 'Estoque mínimo atualizado.' };
  } catch (err) {
    req.session.flash = { type: 'error', message: err.message };
  }
  const params = new URLSearchParams();
  if (req.query.tipo) params.set('tipo', String(req.query.tipo).trim());
  if (req.query.q) params.set('q', String(req.query.q).trim());
  const suffix = params.toString();
  res.redirect(`/estoque${suffix ? `?${suffix}` : ''}`);
}

// --- CRUD de itens (escrita: ADMINISTRADOR; consulta: ambos os perfis) ---

async function formularioNovoItem(req, res) {
  res.render('estoque/item-form', {
    title: 'Novo item',
    item: null,
    tipos: tiposParaView(),
    erro: null,
    form: {},
  });
}

async function criarItem(req, res) {
  try {
    await service.criarItem(req.body);
    req.session.flash = {
      type: 'success',
      message: 'Item cadastrado. O estoque inicial é zero.',
    };
    res.redirect('/estoque');
  } catch (err) {
    res.status(400).render('estoque/item-form', {
      title: 'Novo item',
      item: null,
      tipos: tiposParaView(),
      erro: err.message,
      form: req.body,
    });
  }
}

async function formularioEditarItem(req, res) {
  const item = await service.obterItem(req.params.id);
  if (!item) {
    req.session.flash = { type: 'error', message: 'Item não encontrado.' };
    return res.redirect('/estoque');
  }
  return res.render('estoque/item-form', {
    title: 'Editar item',
    item,
    tipos: tiposParaView(),
    rotulos: ROTULOS_TIPOS_DOACAO,
    erro: null,
    form: item,
  });
}

async function atualizarItem(req, res) {
  try {
    await service.atualizarItem(req.params.id, req.body);
    req.session.flash = { type: 'success', message: 'Item atualizado.' };
    res.redirect('/estoque');
  } catch (err) {
    const item = await service.obterItem(req.params.id);
    res.status(400).render('estoque/item-form', {
      title: 'Editar item',
      item,
      tipos: tiposParaView(),
      rotulos: ROTULOS_TIPOS_DOACAO,
      erro: err.message,
      form: req.body,
    });
  }
}

async function alternarItemAtivo(req, res) {
  try {
    const ativo = req.body.ativo === '1';
    await service.alternarItemAtivo(req.params.id, ativo);
    req.session.flash = {
      type: 'success',
      message: ativo ? 'Item reativado.' : 'Item desativado.',
    };
  } catch (err) {
    req.session.flash = { type: 'error', message: err.message };
  }
  res.redirect('/estoque');
}

export {
  listar,
  atualizarMinimo,
  formularioNovoItem,
  criarItem,
  formularioEditarItem,
  atualizarItem,
  alternarItemAtivo,
};
