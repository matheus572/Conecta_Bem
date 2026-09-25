// frequencia.routes.js — rotas de frequência (RF_33, RF_34).
// Restrito ao ADMINISTRADOR (matriz §12.2 — RF_F07: X apenas para admin).
import express from 'express';
import * as controller from './frequencia.controller.js';
import { authorize } from '../../middlewares/auth.js';

const router = express.Router();

router.use(authorize('ADMINISTRADOR'));

router.get('/turmas/:turmaId', controller.formularioLancamento);
router.post('/turmas/:turmaId', controller.registrar);

export default router;
