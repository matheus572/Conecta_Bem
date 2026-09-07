// doadores.routes.js — rotas de doadores (RF_09–12) com a regra intermediária
// de permissão (§12.2): GET/POST liberados para ambos os perfis; edição e
// exclusão (PUT/PATCH/DELETE) restritas ao ADMINISTRADOR.
import express from 'express';
import * as controller from './doadores.controller.js';
import { authorize } from '../../middlewares/auth.js';

const router = express.Router();

// Consulta/pesquisa e cadastro: ADMINISTRADOR e COLABORADOR.
router.get('/', controller.listar);
router.get('/novo', controller.formularioNovo);
router.post('/', controller.criar);

// Edição e exclusão: somente ADMINISTRADOR (403 para COLABORADOR).
router.get('/:id/editar', authorize('ADMINISTRADOR'), controller.formularioEditar);
router.put('/:id', authorize('ADMINISTRADOR'), controller.atualizar);
router.patch('/:id', authorize('ADMINISTRADOR'), controller.atualizar);
router.delete('/:id', authorize('ADMINISTRADOR'), controller.excluir);

export default router;