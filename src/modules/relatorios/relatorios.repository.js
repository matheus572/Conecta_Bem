// relatorios.repository.js — consultas de leitura/agregação dos relatórios
// (RF_26–28). Apenas SQL; os relatórios leem os dados já existentes, sem
// nenhuma tabela nova (consolidação e saída de dados — Sprint 5).

import { pool } from '../../config/db.js';

/** Monta filtro de período (inicio/fim em 'YYYY-MM-DD') sobre uma coluna de data. */
function filtroPeriodo(coluna, { inicio, fim }) {
  const conditions = [];
  const params = [];
  if (inicio) {
    conditions.push(`${coluna} >= ?`);
    params.push(inicio);
  }
  if (fim) {
    conditions.push(`${coluna} <= ?`);
    params.push(fim);
  }
  return { conditions, params };
}

// --- RF_26: doações recebidas e distribuídas por período ---

async function resumoDoacoesRecebidas({ inicio, fim, tipo }) {
  const { conditions, params } = filtroPeriodo('d.data_doacao', { inicio, fim });
  if (tipo) {
    conditions.push('d.tipo_doacao = ?');
    params.push(tipo);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT d.tipo_doacao,
            COUNT(*) AS num_doacoes,
            COALESCE(SUM(d.quantidade), 0) AS total_recebida,
            COUNT(DISTINCT d.doador_id) AS num_doadores
       FROM \`doacao\` d
       ${where}
      GROUP BY d.tipo_doacao
      ORDER BY d.tipo_doacao`,
    params,
  );
  return rows;
}

async function resumoDoacoesDistribuidas({ inicio, fim, tipo }) {
  const { conditions, params } = filtroPeriodo('di.data_distribuicao', { inicio, fim });
  if (tipo) {
    conditions.push('di.tipo_doacao = ?');
    params.push(tipo);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT di.tipo_doacao,
            COUNT(*) AS num_distribuicoes,
            COALESCE(SUM(di.quantidade), 0) AS total_distribuida,
            COUNT(DISTINCT di.beneficiario_id) AS num_beneficiarios
       FROM \`distribuicao\` di
       ${where}
      GROUP BY di.tipo_doacao
      ORDER BY di.tipo_doacao`,
    params,
  );
  return rows;
}

// --- RF_27: atendimentos realizados por período ---
// Três agregações por beneficiário (atendimentos, distribuições, matrículas);
// a junção por beneficiário acontece no service, evitando contagem duplicada
// por produto cartesiano de JOIN.

async function atendimentosPorBeneficiario({ inicio, fim }) {
  const { conditions, params } = filtroPeriodo('a.data_atendimento', { inicio, fim });
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT a.beneficiario_id, COUNT(*) AS num_atendimentos
       FROM \`atendimento\` a
       ${where}
      GROUP BY a.beneficiario_id`,
    params,
  );
  return rows;
}

async function distribuicoesPorBeneficiario({ inicio, fim }) {
  const { conditions, params } = filtroPeriodo('di.data_distribuicao', { inicio, fim });
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT di.beneficiario_id,
            COUNT(*) AS num_distribuicoes,
            COALESCE(SUM(di.quantidade), 0) AS itens_recebidos
       FROM \`distribuicao\` di
       ${where}
      GROUP BY di.beneficiario_id`,
    params,
  );
  return rows;
}

async function matriculasPorBeneficiario({ inicio, fim }) {
  const { conditions, params } = filtroPeriodo('m.data_matricula', { inicio, fim });
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT m.beneficiario_id, COUNT(*) AS num_matriculas
       FROM \`matricula\` m
       ${where}
      GROUP BY m.beneficiario_id`,
    params,
  );
  return rows;
}

/** Nomes dos beneficiários citados em um agregado (para o relatório). */
async function nomesBeneficiarios(ids) {
  if (!ids.length) return [];
  const [rows] = await pool.query(
    `SELECT id, nome FROM \`beneficiario\` WHERE id IN (${ids.map(() => '?').join(',')})`,
    ids,
  );
  return rows;
}

// --- RF_28: campanhas com resultados consolidados ---

async function campanhasConsolidadas({ inicio, fim, status }) {
  const conditions = [];
  const params = [];
  if (status) {
    conditions.push('c.status = ?');
    params.push(status);
  }
  // Período = sobreposição com o intervalo [data_inicio, data_fim] da campanha.
  if (inicio) {
    conditions.push('c.data_fim >= ?');
    params.push(inicio);
  }
  if (fim) {
    conditions.push('c.data_inicio <= ?');
    params.push(fim);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT c.id, c.titulo, c.status, c.data_inicio, c.data_fim,
            (SELECT COUNT(*) FROM \`campanha_voluntario\` cv WHERE cv.campanha_id = c.id) AS num_voluntarios,
            (SELECT COUNT(*) FROM \`atendimento\` a WHERE a.campanha_id = c.id) AS beneficiarios_atendidos,
            (SELECT COALESCE(SUM(di.quantidade), 0) FROM \`distribuicao\` di WHERE di.campanha_id = c.id) AS itens_distribuidos
       FROM \`campanha\` c
       ${where}
      ORDER BY c.data_inicio DESC, c.id DESC`,
    params,
  );
  return rows;
}

export {
  resumoDoacoesRecebidas,
  resumoDoacoesDistribuidas,
  atendimentosPorBeneficiario,
  distribuicoesPorBeneficiario,
  matriculasPorBeneficiario,
  nomesBeneficiarios,
  campanhasConsolidadas,
};
