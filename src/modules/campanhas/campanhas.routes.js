// campanhas.routes.js — rotas de campanhas (RF_22–25), restritas ao
// ADMINISTRADOR (matriz §12.2 / UC11: ator Administrador). O COLABORADOR não
// acessa nenhuma rota deste módulo (403), conforme registrado em docs/decisoes.md.
import express from 'express';
import * as controller from './campanhas.controller.js';
import { authorize } from '../../middlewares/auth.js';

const router = express.Router();

router.use(authorize('ADMINISTRADOR'));

// CRUD de campanha.
router.get('/', controller.listar);
router.get('/nova', controller.formularioNova);
router.post('/', controller.criar);
router.get('/:id', controller.detalhar);
router.get('/:id/editar', controller.formularioEditar);
router.put('/:id', controller.atualizar);
router.delete('/:id', controller.excluir);

// Associação de voluntários (RF_23).
router.get('/:id/voluntarios', controller.formularioAssociar);
router.post('/:id/voluntarios', controller.associarVoluntario);
router.delete('/:id/voluntarios/:voluntarioId', controller.removerVoluntario);

// Resultados (RF_24): beneficiários atendidos e doações distribuídas.
router.get('/:id/resultados', controller.formularioResultados);
router.post('/:id/atendimentos', controller.registrarAtendimento);
router.post('/:id/distribuicoes', controller.registrarDistribuicao);

export default router;