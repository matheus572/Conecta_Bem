// estoque.repository.js — acesso a dados de estoque por tipo (apenas SQL).
//
// Todo método de escrita aceita uma `conn` opcional (default: pool) para que o
// service possa executá-lo dentro de uma transação (RN03). A leitura com
// `FOR UPDATE` (obterSaldoParaAtualizacao) é sempre chamada com a conexão da
// transação para bloquear a linha e evitar condição de corrida (seção 2 do plano).
import { pool } from '../../config/db.js';

async function listar({ tipo = '' } = {}) {
  const conditions = [];
  const params = [];
  if (tipo) {
    conditions.push('`tipo_doacao` = ?');
    params.push(tipo);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT id, tipo_doacao, quantidade, estoque_minimo FROM estoque ${where} ORDER BY tipo_doacao ASC`,
    params,
  );
  return rows;
}

/**
 * Lê o saldo atual de um tipo DENTRO da transação, bloqueando a linha
 * (`FOR UPDATE`) até o COMMIT/ROLLBACK — evita que duas distribuições
 * simultâneas leiam o mesmo saldo e gerem estoque negativo.
 */
async function obterSaldoParaAtualizacao(tipo, conn) {
  const [rows] = await conn.query(
    'SELECT quantidade FROM estoque WHERE tipo_doacao = ? LIMIT 1 FOR UPDATE',
    [tipo],
  );
  return rows.length ? rows[0].quantidade : null;
}

async function incrementar(tipo, quantidade, conn) {
  await conn.query('UPDATE estoque SET quantidade = quantidade + ? WHERE tipo_doacao = ?', [
    quantidade,
    tipo,
  ]);
}

async function decrementar(tipo, quantidade, conn) {
  await conn.query('UPDATE estoque SET quantidade = quantidade - ? WHERE tipo_doacao = ?', [
    quantidade,
    tipo,
  ]);
}

async function atualizarMinimo(tipo, minimo) {
  await pool.query('UPDATE estoque SET estoque_minimo = ? WHERE tipo_doacao = ?', [minimo, tipo]);
}

export { listar, obterSaldoParaAtualizacao, incrementar, decrementar, atualizarMinimo };