// estoque.routes.js — rotas de estoque (RF_14, RF_16/RF_S04). Acesso para
// ADMINISTRADOR e COLABORADOR (matriz §12.2 — RF_F03/RF_S04 são X/X).
import express from 'express';
import * as controller from './estoque.controller.js';

const router = express.Router();

router.get('/', controller.listar);
router.put('/:tipo/minimo', controller.atualizarMinimo);

export default router;