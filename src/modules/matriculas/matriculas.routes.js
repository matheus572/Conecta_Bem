// matriculas.routes.js — rotas de matrícula (RF_32).
// Acesso liberado para ADMINISTRADOR e COLABORADOR (matriz §12.2 — RF_F06 X/X).
import express from 'express';
import * as controller from './matriculas.controller.js';

const router = express.Router();

router.get('/nova', controller.formularioNova);
router.post('/', controller.criar);

export default router;
