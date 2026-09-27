// middlewares/audit.js — log de auditoria de acesso a dados pessoais (LGPD
// §11.3, RNF_04). Registra quem (usuário da sessão), quando (created_at) e
// o quê (ação + entidade + id) nas consultas e edições de beneficiários e
// doadores.
//
// O log grava apenas METADADOS da operação (entidade, id, rota) — nunca o
// payload com dados sensíveis (CPF, situação socioeconômica), evitando
// duplicar dado pessoal no log (minimização). Falhas na gravação do log não
// interrompem a requisição: são reportadas no stderr.
import { pool } from '../config/db.js';

/**
 * Devolve um middleware que registra o acesso no `audit_log` e segue adiante.
 * @param {string} entidade nome lógico da entidade auditada (ex.: 'beneficiario')
 * @param {string} acao uma das: CONSULTA | CRIACAO | EDICAO | EXCLUSAO
 */
function auditAccess(entidade, acao) {
  return async (req, res, next) => {
    try {
      const usuarioId = req.session?.user?.id ?? null;
      const entidadeId = req.params?.id ? Number(req.params.id) : null;
      await pool.query(
        'INSERT INTO `audit_log` (`usuario_id`, `acao`, `entidade`, `entidade_id`, `detalhe`) VALUES (?, ?, ?, ?, ?)',
        [usuarioId, acao, entidade, entidadeId, `${req.method} ${req.originalUrl}`],
      );
    } catch (err) {
      console.error('[audit] falha ao registrar log de auditoria:', err);
    }
    return next();
  };
}

export { auditAccess };
