// cursos.routes.js — rotas de cursos e turmas (RF_30, RF_31, RF_36).
// Consulta (GET) liberada para ADMINISTRADOR e COLABORADOR (RF_36); escrita
// (POST/PUT/DELETE) restrita ao ADMINISTRADOR, seguindo a matriz §12.2
// ("Gerenciar Cursos e Oficinas": X / Somente consulta) — mesmo padrão dos
// voluntários (Sprint 3). Rotas mais específicas ("novo", "turmas/...") vêm
// sempre antes de "/:id".
import express from 'express';
import * as controller from './cursos.controller.js';
import { authorize } from '../../middlewares/auth.js';

const router = express.Router();

// Consulta de cursos: ambos os perfis (RF_36).
router.get('/', controller.listar);

// Escrita em cursos: somente ADMINISTRADOR.
router.get('/novo', authorize('ADMINISTRADOR'), controller.formularioNovo);
router.post('/', authorize('ADMINISTRADOR'), controller.criar);

// Turmas de um curso (escrita: ADMINISTRADOR).
router.get('/:id/turmas/nova', authorize('ADMINISTRADOR'), controller.formularioNovaTurma);
router.post('/:id/turmas', authorize('ADMINISTRADOR'), controller.criarTurma);

// Turmas (consulta: ambos; escrita: ADMINISTRADOR).
router.get('/turmas/:turmaId', controller.detalharTurma);
router.get('/turmas/:turmaId/editar', authorize('ADMINISTRADOR'), controller.formularioEditarTurma);
router.put('/turmas/:turmaId', authorize('ADMINISTRADOR'), controller.atualizarTurma);
router.patch('/turmas/:turmaId', authorize('ADMINISTRADOR'), controller.atualizarTurma);
router.delete('/turmas/:turmaId', authorize('ADMINISTRADOR'), controller.excluirTurma);

// Cursos (edição/exclusão: ADMINISTRADOR; detalhe: ambos).
router.get('/:id/editar', authorize('ADMINISTRADOR'), controller.formularioEditar);
router.put('/:id', authorize('ADMINISTRADOR'), controller.atualizar);
router.patch('/:id', authorize('ADMINISTRADOR'), controller.atualizar);
router.delete('/:id', authorize('ADMINISTRADOR'), controller.excluir);
router.get('/:id', controller.detalhar);

export default router;
