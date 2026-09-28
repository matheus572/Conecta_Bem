// middlewares/audit.js — log de auditoria de acesso a dados pessoais (LGPD
// §11.3, RNF_04). Registra quem (usuário da sessão), quando (created_at) e
// o quê (ação + entidade + id) nas consultas e edições de beneficiários e
// doadores.
//
// O log grava apenas METADADOS da operação (entidade, id, rota) — nunca o
// payload com dados sensíveis (CPF, situação socioeconômica), evitando
// duplicar dado pessoal no log (minimização). Falhas na gravação do log não
// interrompem a requisição: são reportadas no stderr.
//
// A gravação em si está em utils/auditoria.js (compartilhada com os services
// que precisam auditar dentro de transações — ver decisões Sprint 7).
import { registrarAuditoria } from '../utils/auditoria.js';

/**
 * Devolve um middleware que registra o acesso no `audit_log` e segue adiante.
 * @param {string} entidade nome lógico da entidade auditada (ex.: 'beneficiario')
 * @param {string} acao uma das: CONSULTA | CRIACAO | EDICAO | EXCLUSAO
 */
function auditAccess(entidade, acao) {
  return async (req, res, next) => {
    try {
      await registrarAuditoria({
        usuarioId: req.session?.user?.id ?? null,
        acao,
        entidade,
        entidadeId: req.params?.id ? Number(req.params.id) : null,
        detalhe: `${req.method} ${req.originalUrl}`,
      });
    } catch (err) {
      console.error('[audit] falha ao registrar log de auditoria:', err);
    }
    return next();
  };
}

export { auditAccess };
