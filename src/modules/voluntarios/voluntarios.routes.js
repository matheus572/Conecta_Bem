// voluntarios.routes.js — rotas de voluntários (RF_18–21, RF_36).
// Consulta (GET) liberada para ADMINISTRADOR e COLABORADOR; escrita
// (POST/PUT/DELETE) restrita ao ADMINISTRADOR (403 para COLABORADOR), seguindo
// a matriz §12.2 ("Gerenciar Voluntários": X / Somente consulta).
import express from 'express';
import * as controller from './voluntarios.controller.js';
import { authorize } from '../../middlewares/auth.js';

const router = express.Router();

// Consulta: ambos os perfis.
router.get('/', controller.listar);

// Escrita: somente ADMINISTRADOR (rotas "novo"/"editar" antes de "/:id").
router.get('/novo', authorize('ADMINISTRADOR'), controller.formularioNovo);
router.post('/', authorize('ADMINISTRADOR'), controller.criar);
router.get('/:id/editar', authorize('ADMINISTRADOR'), controller.formularioEditar);
router.put('/:id', authorize('ADMINISTRADOR'), controller.atualizar);
router.patch('/:id', authorize('ADMINISTRADOR'), controller.atualizar);
router.delete('/:id', authorize('ADMINISTRADOR'), controller.excluir);

// Detalhe (com histórico de participação em campanhas — RF_19): ambos os perfis.
router.get('/:id', controller.detalhar);

export default router;