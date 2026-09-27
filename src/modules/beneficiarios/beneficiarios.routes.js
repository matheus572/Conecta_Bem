// beneficiarios.routes.js — rotas de beneficiários (RF_05–08). Acesso para
// ADMINISTRADOR e COLABORADOR (matriz §12.2 — Gerenciar Beneficiários X/X).
// Dados pessoais sensíveis (situação socioeconômica): as operações de
// consulta e edição são auditadas (LGPD §11.3).
import express from 'express';
import * as controller from './beneficiarios.controller.js';
import { auditAccess } from '../../middlewares/audit.js';

const router = express.Router();

router.get('/', auditAccess('beneficiario', 'CONSULTA'), controller.listar);
router.get('/novo', controller.formularioNovo);
router.post('/', auditAccess('beneficiario', 'CRIACAO'), controller.criar);
router.get('/:id/editar', auditAccess('beneficiario', 'CONSULTA'), controller.formularioEditar);
router.put('/:id', auditAccess('beneficiario', 'EDICAO'), controller.atualizar);
router.patch('/:id', auditAccess('beneficiario', 'EDICAO'), controller.atualizar);
router.delete('/:id', auditAccess('beneficiario', 'EXCLUSAO'), controller.excluir);

export default router;
