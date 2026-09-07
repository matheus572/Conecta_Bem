// doacoes.routes.js — rotas de doações e distribuições (RF_13, RF_15, RF_17).
// Acesso para ADMINISTRADOR e COLABORADOR (matriz §12.2 — RF_F01/RF_F02 são X/X).
import express from 'express';
import * as controller from './doacoes.controller.js';

const router = express.Router();

router.get('/', controller.listarDoacoes);
router.get('/nova', controller.formularioNovaDoacao);
router.post('/', controller.criarDoacao);

router.get('/distribuicoes', controller.listarDistribuicoes);
router.get('/distribuicoes/nova', controller.formularioNovaDistribuicao);
router.post('/distribuicoes', controller.criarDistribuicao);

export default router;