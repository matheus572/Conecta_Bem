// utils/auditoria.js — gravação no audit_log (LGPD §11.3), reutilizável
// tanto pelo middleware HTTP (middlewares/audit.js) quanto dentro de
// transações de negócio — ex.: criação/reativação automática de item no
// registro de doação (Sprint 7), em que o log faz rollback junto.
//
// O log grava apenas METADADOS (usuário, ação, entidade, id, rota/detalhe),
// nunca payload sensível.
import { pool } from '../config/db.js';

/**
 * Registra um acesso/alteração em dados auditados.
 * Falhas na gravação NÃO interrompem a operação (responsabilidade do chamador
 * capturar, se quiser tratá-la diferente — os usos atuais logam no stderr).
 * @param {{ usuarioId: number|null, acao: string, entidade: string, entidadeId: number|null, detalhe: string }} reg
 * @param {*} conn conexão opcional (transação); default: pool
 */
async function registrarAuditoria({ usuarioId, acao, entidade, entidadeId, detalhe }, conn = pool) {
  await conn.query(
    'INSERT INTO `audit_log` (`usuario_id`, `acao`, `entidade`, `entidade_id`, `detalhe`) VALUES (?, ?, ?, ?, ?)',
    [usuarioId ?? null, acao, entidade, entidadeId ?? null, detalhe],
  );
}

export { registrarAuditoria };
