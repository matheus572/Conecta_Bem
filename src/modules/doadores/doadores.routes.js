// doadores.routes.js — rotas de doadores (RF_09–12) com a regra intermediária
// de permissão (§12.2): GET/POST liberados para ambos os perfis; edição e
// exclusão (PUT/PATCH/DELETE) restritas ao ADMINISTRADOR.
// Dados pessoais (CPF/CNPJ): as operações são auditadas (LGPD §11.3).
import express from 'express';
import * as controller from './doadores.controller.js';
import { authorize } from '../../middlewares/auth.js';
import { auditAccess } from '../../middlewares/audit.js';

const router = express.Router();

// Consulta/pesquisa e cadastro: ADMINISTRADOR e COLABORADOR.
router.get('/', auditAccess('doador', 'CONSULTA'), controller.listar);
router.get('/novo', controller.formularioNovo);
router.post('/', auditAccess('doador', 'CRIACAO'), controller.criar);

// Edição e exclusão: somente ADMINISTRADOR (403 para COLABORADOR). O log de
// auditoria fica APÓS o authorize, para registrar apenas acessos autorizados.
router.get('/:id/editar', authorize('ADMINISTRADOR'), auditAccess('doador', 'CONSULTA'), controller.formularioEditar);
router.put('/:id', authorize('ADMINISTRADOR'), auditAccess('doador', 'EDICAO'), controller.atualizar);
router.patch('/:id', authorize('ADMINISTRADOR'), auditAccess('doador', 'EDICAO'), controller.atualizar);
router.delete('/:id', authorize('ADMINISTRADOR'), auditAccess('doador', 'EXCLUSAO'), controller.excluir);

export default router;
