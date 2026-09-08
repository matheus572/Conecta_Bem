// doacoes.repository.js — acesso a dados de doações e distribuições (apenas SQL).
// Métodos de escrita aceitam `conn` opcional (default: pool) para rodar dentro
// da transação do service (RN03).
import { pool } from '../../config/db.js';

const COLS_DOACAO = `d.id, d.data_doacao, d.tipo_doacao, d.quantidade, d.descricao,
  d.doador_id, doa.nome AS doador_nome`;
const COLS_DISTRIBUICAO = `di.id, di.data_distribuicao, di.tipo_doacao, di.quantidade,
  di.descricao, di.beneficiario_id, b.nome AS beneficiario_nome`;

async function listarDoacoes({ tipo = '', inicio = '', fim = '' } = {}) {
  const conditions = [];
  const params = [];

  if (tipo) {
    conditions.push('d.tipo_doacao = ?');
    params.push(tipo);
  }
  if (inicio) {
    conditions.push('d.data_doacao >= ?');
    params.push(inicio);
  }
  if (fim) {
    conditions.push('d.data_doacao <= ?');
    params.push(fim);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT ${COLS_DOACAO}
       FROM doacao d
       JOIN doador doa ON doa.id = d.doador_id
       ${where}
       ORDER BY d.data_doacao DESC, d.id DESC`,
    params,
  );
  return rows;
}

async function listarDistribuicoes({ tipo = '', inicio = '', fim = '' } = {}) {
  const conditions = [];
  const params = [];

  if (tipo) {
    conditions.push('di.tipo_doacao = ?');
    params.push(tipo);
  }
  if (inicio) {
    conditions.push('di.data_distribuicao >= ?');
    params.push(inicio);
  }
  if (fim) {
    conditions.push('di.data_distribuicao <= ?');
    params.push(fim);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT ${COLS_DISTRIBUICAO}
       FROM distribuicao di
       JOIN beneficiario b ON b.id = di.beneficiario_id
       ${where}
       ORDER BY di.data_distribuicao DESC, di.id DESC`,
    params,
  );
  return rows;
}

async function criarDoacao(dados, conn = pool) {
  const [result] = await conn.query(
    'INSERT INTO doacao (doador_id, tipo_doacao, quantidade, descricao, data_doacao, usuario_id) VALUES (?, ?, ?, ?, ?, ?)',
    [dados.doadorId, dados.tipo, dados.quantidade, dados.descricao, dados.data, dados.usuarioId],
  );
  return result.insertId;
}

async function criarDistribuicao(dados, conn = pool) {
  const [result] = await conn.query(
    'INSERT INTO distribuicao (beneficiario_id, campanha_id, tipo_doacao, quantidade, descricao, data_distribuicao, usuario_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      dados.beneficiarioId,
      dados.campanhaId || null,
      dados.tipo,
      dados.quantidade,
      dados.descricao,
      dados.data,
      dados.usuarioId,
    ],
  );
  return result.insertId;
}

export { listarDoacoes, listarDistribuicoes, criarDoacao, criarDistribuicao };