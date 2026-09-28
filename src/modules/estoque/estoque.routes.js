// estoque.routes.js — rotas de estoque por item (RF_14, RF_16/RF_S04) e CRUD
// de itens (Sprint 6). Consulta: ADMINISTRADOR e COLABORADOR (matriz §12.2 —
// RF_F03/RF_S04 são X/X). Cadastro/edição/desativação de itens: somente
// ADMINISTRADOR (mesmo padrão de cursos/voluntários).
import express from 'express';
import * as controller from './estoque.controller.js';
import { authorize } from '../../middlewares/auth.js';

const router = express.Router();

router.get('/', controller.listar);

// CRUD de itens — escrita restrita ao ADMINISTRADOR.
router.get('/itens/novo', authorize('ADMINISTRADOR'), controller.formularioNovoItem);
router.post('/itens', authorize('ADMINISTRADOR'), controller.criarItem);
router.get('/itens/:id/editar', authorize('ADMINISTRADOR'), controller.formularioEditarItem);
router.put('/itens/:id', authorize('ADMINISTRADOR'), controller.atualizarItem);
router.put('/itens/:id/ativo', authorize('ADMINISTRADOR'), controller.alternarItemAtivo);

// Estoque mínimo por item (RF_16) — liberado para ambos os perfis.
router.put('/:itemId/minimo', controller.atualizarMinimo);

export default router;
