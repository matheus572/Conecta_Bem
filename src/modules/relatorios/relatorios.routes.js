// relatorios.routes.js — rotas dos relatórios (RF_26–28, RF_29a; UC12).
// Matriz §12.2: RF_S01 (doações) e RF_S03 (campanhas) só ADMINISTRADOR;
// RF_S02 (atendimentos) liberado ao COLABORADOR (versão básica = mesmo
// relatório, único acessível ao perfil — decisão da Sprint 5).
import express from 'express';
import * as controller from './relatorios.controller.js';
import { authorize } from '../../middlewares/auth.js';

const router = express.Router();

router.get('/', controller.index);
router.get('/doacoes', authorize('ADMINISTRADOR'), controller.doacoes);
router.get('/atendimentos', controller.atendimentos);
router.get('/campanhas', authorize('ADMINISTRADOR'), controller.campanhas);

export default router;
