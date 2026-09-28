// dashboard.repository.js — consultas de leitura dos indicadores do painel
// (RF_29/UC14). Todos os indicadores derivam das tabelas existentes; nenhuma
// informação é duplicada em tabelas novas (Sprint 5).
import { pool } from '../../config/db.js';

/** Total de beneficiários ativos (não excluídos logicamente). */
async function totalBeneficiariosAtivos() {
  const [[row]] = await pool.query(
    'SELECT COUNT(*) AS total FROM `beneficiario` WHERE `ativo` = 1 AND `deleted_at` IS NULL',
  );
  return Number(row.total);
}

/** Nº de doações recebidas no mês corrente (RF_29). */
async function doacoesDoMes() {
  const [[row]] = await pool.query(
    `SELECT COUNT(*) AS total FROM \`doacao\`
      WHERE DATE_FORMAT(\`data_doacao\`, '%Y-%m') = DATE_FORMAT(CURDATE(), '%Y-%m')`,
  );
  return Number(row.total);
}

/** Total de voluntários ativos. */
async function totalVoluntariosAtivos() {
  const [[row]] = await pool.query(
    'SELECT COUNT(*) AS total FROM `voluntario` WHERE `ativo` = 1 AND `deleted_at` IS NULL',
  );
  return Number(row.total);
}

/** Campanhas planejadas/ativas ainda não encerradas, da mais próxima para a mais distante. */
async function proximasCampanhas(limite = 5) {
  const [rows] = await pool.query(
    `SELECT id, titulo, data_inicio, data_fim, status
       FROM \`campanha\`
      WHERE \`status\` IN ('PLANEJADA', 'ATIVA') AND \`data_fim\` >= CURDATE()
      ORDER BY \`data_inicio\` ASC, \`id\` ASC
      LIMIT ?`,
    [limite],
  );
  return rows;
}

/** Itens cujo estoque está abaixo do mínimo configurado (RF_16/RF_S04 —
 * Sprint 6: por item, não mais por tipo). Itens desativados não alertam. */
async function itensEstoqueAbaixoMinimo() {
  const [rows] = await pool.query(
    `SELECT i.id AS item_id, i.nome_item, i.tipo_doacao, e.quantidade, e.estoque_minimo
       FROM \`estoque\` e
       JOIN \`item_doacao\` i ON i.id = e.item_id
      WHERE e.\`quantidade\` < e.\`estoque_minimo\` AND i.\`ativo\` = 1
      ORDER BY i.nome_item`,
  );
  return rows;
}

export {
  totalBeneficiariosAtivos,
  doacoesDoMes,
  totalVoluntariosAtivos,
  proximasCampanhas,
  itensEstoqueAbaixoMinimo,
};
