// beneficiarios.routes.js — rotas de beneficiários (RF_05–08). Acesso para
// ADMINISTRADOR e COLABORADOR (matriz §12.2).
import express from 'express';
import * as controller from './beneficiarios.controller.js';

const router = express.Router();

router.get('/', controller.listar);
router.get('/novo', controller.formularioNovo);
router.post('/', controller.criar);
router.get('/:id/editar', controller.formularioEditar);
router.put('/:id', controller.atualizar);
router.delete('/:id', controller.excluir);

export default router;