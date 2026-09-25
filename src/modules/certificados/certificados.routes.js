// certificados.routes.js — rotas de certificados (RF_35, UC13).
// Restrito ao ADMINISTRADOR (matriz §12.2 — RF_S06: X apenas para admin,
// conforme decisão confirmada na seção 13.3 da documentação).
import express from 'express';
import * as controller from './certificados.controller.js';
import { authorize } from '../../middlewares/auth.js';

const router = express.Router();

router.use(authorize('ADMINISTRADOR'));

router.get('/', controller.listar);
router.get('/turmas/:turmaId', controller.listarPorTurma);
router.post('/', controller.emitir);

export default router;
