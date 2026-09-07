// usuarios.routes.js — rotas de gestão de usuários (RF_04), restritas ao admin.
import express from 'express';
import * as controller from './usuarios.controller.js';
import { authorize } from '../../middlewares/auth.js';

const router = express.Router();

router.get('/', authorize('ADMINISTRADOR'), controller.listar);
router.get('/novo', authorize('ADMINISTRADOR'), controller.formularioNovo);
router.post('/', authorize('ADMINISTRADOR'), controller.criar);
router.get('/:id/editar', authorize('ADMINISTRADOR'), controller.formularioEditar);
router.put('/:id', authorize('ADMINISTRADOR'), controller.atualizar);
router.post('/:id/ativo', authorize('ADMINISTRADOR'), controller.alternarAtivo);
router.delete('/:id', authorize('ADMINISTRADOR'), controller.excluir);

export default router;