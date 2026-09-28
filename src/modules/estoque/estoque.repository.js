// estoque.repository.js — acesso a dados de itens e estoque POR ITEM (Sprint
// 6 — granularidade; substitui o controle por tipo da Sprint 2).
//
// Todo método de escrita de saldo aceita uma `conn` opcional (default: pool)
// para rodar dentro da transação do service (RN03). A leitura com
// `FOR UPDATE` (obterSaldoParaAtualizacao) é sempre chamada com a conexão da
// transação para bloquear a linha do item e evitar condição de corrida.
import { pool } from '../../config/db.js';

// --- Listagem do estoque (por item) ---

/**
 * Lista o estoque por item com busca parcial por nome (`q`, case-insensitive)
 * e filtro por tipo (`tipo_doacao` fica em item_doacao — agrupamento para
 * relatórios/filtros segue disponível).
 */
async function listar({ tipo = '', q = '' } = {}) {
  const conditions = [];
  const params = [];
  if (tipo) {
    conditions.push('i.`tipo_doacao` = ?');
    params.push(tipo);
  }
  if (q) {
    conditions.push('LOWER(i.`nome_item`) LIKE LOWER(?)');
    params.push(`%${q}%`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT i.id AS item_id, i.nome_item, i.tipo_doacao, i.unidade, i.ativo,
            e.quantidade, e.estoque_minimo
       FROM \`item_doacao\` i
       JOIN \`estoque\` e ON e.item_id = i.id
       ${where}
      ORDER BY i.tipo_doacao, i.nome_item`,
    params,
  );
  return rows;
}

/** Lista itens ativos (para os <select> de doação/distribuição), com tipo. */
async function listarItensAtivos() {
  const [rows] = await pool.query(
    `SELECT id, nome_item, tipo_doacao, unidade
       FROM \`item_doacao\`
      WHERE \`ativo\` = 1
      ORDER BY \`tipo_doacao\`, \`nome_item\``,
  );
  return rows;
}

/** Busca um item pelo id (com dados de exibição). */
async function findItemById(id) {
  const [rows] = await pool.query(
    'SELECT `id`, `nome_item`, `tipo_doacao`, `unidade`, `ativo` FROM `item_doacao` WHERE `id` = ? LIMIT 1',
    [id],
  );
  return rows[0] || null;
}

/** Busca item pelo par nome+tipo (régua de unicidade — mensagem amigável). */
async function findItemPorNomeTipo(nome, tipo, conn = pool) {
  const [rows] = await conn.query(
    'SELECT `id` FROM `item_doacao` WHERE `nome_item` = ? AND `tipo_doacao` = ? LIMIT 1',
    [nome, tipo],
  );
  return rows[0] || null;
}

/**
 * Busca item pelo nome em QUALQUER tipo (a collation `utf8mb4_unicode_ci` da
 * coluna ignora caixa E acentos — verificado em banco na Sprint 7 e registrado
 * em docs/decisoes.md). Usado na criação automática via registro de doação.
 *
 * `forUpdate = true` (CHAMAR DENTRO DA TRANSAÇÃO, Sprint 7): força leitura
 * atual e bloqueia o índice único — necessary porque, em REPEATABLE READ, um
 * SELECT simples usa o snapshot da transação e NÃO enxerga o item recém-criado
 * por outra transação ainda não commitada (corrida entre duas doações
 * simultâneas do mesmo nome novo).
 */
async function findItemPorNome(nome, conn = pool, { forUpdate = false } = {}) {
  const lock = forUpdate ? ' FOR UPDATE' : '';
  const [rows] = await conn.query(
    'SELECT `id`, `nome_item`, `tipo_doacao`, `unidade`, `ativo` FROM `item_doacao` WHERE `nome_item` = ? LIMIT 1' + lock,
    [nome],
  );
  return rows[0] || null;
}

// --- Escrita de itens (transacional com a linha de estoque) ---

/** Cria o item. Recebe `conn` da transação do service. */
async function criarItem({ nome, tipo, unidade }, conn) {
  const [result] = await conn.query(
    'INSERT INTO `item_doacao` (`nome_item`, `tipo_doacao`, `unidade`) VALUES (?, ?, ?)',
    [nome, tipo, unidade],
  );
  return result.insertId;
}

/** Cria a linha de estoque zerada de um item. Recebe `conn` da transação. */
async function criarEstoqueVazio(itemId, conn) {
  await conn.query(
    'INSERT INTO `estoque` (`item_id`, `quantidade`, `estoque_minimo`) VALUES (?, 0, 0)',
    [itemId],
  );
}

/** Atualiza nome/unidade do item (o tipo não é editável — ver decisões). */
async function atualizarItem(id, { nome, unidade }) {
  await pool.query('UPDATE `item_doacao` SET `nome_item` = ?, `unidade` = ? WHERE `id` = ?', [
    nome,
    unidade,
    id,
  ]);
}

async function setItemAtivo(id, ativo, conn = pool) {
  await conn.query('UPDATE `item_doacao` SET `ativo` = ? WHERE `id` = ?', [ativo ? 1 : 0, id]);
}

// --- Saldo por item (RN03) ---

/**
 * Lê o saldo atual de um ITEM DENTRO da transação, bloqueando a linha
 * (`FOR UPDATE`) até o COMMIT/ROLLBACK — evita que duas distribuições
 * simultâneas do mesmo item leiam o mesmo saldo e gerem estoque negativo.
 */
async function obterSaldoParaAtualizacao(itemId, conn) {
  const [rows] = await conn.query(
    'SELECT quantidade FROM `estoque` WHERE `item_id` = ? LIMIT 1 FOR UPDATE',
    [itemId],
  );
  return rows.length ? rows[0].quantidade : null;
}

async function incrementar(itemId, quantidade, conn) {
  await conn.query('UPDATE `estoque` SET `quantidade` = `quantidade` + ? WHERE `item_id` = ?', [
    quantidade,
    itemId,
  ]);
}

async function decrementar(itemId, quantidade, conn) {
  await conn.query('UPDATE `estoque` SET `quantidade` = `quantidade` - ? WHERE `item_id` = ?', [
    quantidade,
    itemId,
  ]);
}

async function atualizarMinimo(itemId, minimo) {
  await pool.query('UPDATE `estoque` SET `estoque_minimo` = ? WHERE `item_id` = ?', [
    minimo,
    itemId,
  ]);
}

export {
  listar,
  listarItensAtivos,
  findItemById,
  findItemPorNome,
  findItemPorNomeTipo,
  criarItem,
  criarEstoqueVazio,
  atualizarItem,
  setItemAtivo,
  obterSaldoParaAtualizacao,
  incrementar,
  decrementar,
  atualizarMinimo,
};
