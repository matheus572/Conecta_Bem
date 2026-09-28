// estoque.service.js — regras de itens e estoque por item (RF_14, RF_16/RF_S04,
// busca por item da Sprint 6; criação automática no registro de doação — Sprint 7).
import { pool } from '../../config/db.js';
import { isTipoValido, ROTULOS_TIPOS_DOACAO, UNIDADES_ITEM } from '../../utils/tiposDoacao.js';
import { registrarAuditoria } from '../../utils/auditoria.js';
import * as repository from './estoque.repository.js';

/**
 * Normaliza o nome de item digitado: trim + colapso de espaços internos.
 * Rejeita vazio e > 120 caracteres. Usada pela criação no CRUD e pela
 * criação automática no registro de doação (Sprint 7).
 */
function normalizarNomeItem(nomeBruto) {
  const nome = String(nomeBruto || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!nome) throw new Error('Informe o nome do item.');
  if (nome.length > 120) {
    throw new Error('O nome do item deve ter no máximo 120 caracteres.');
  }
  return nome;
}

function erroItemEmOutraCategoria(item) {
  return new Error(
    `Já existe o item '${item.nome_item}' na categoria ${ROTULOS_TIPOS_DOACAO[item.tipo_doacao] || item.tipo_doacao}. ` +
      'Selecione essa categoria ou use outro nome.',
  );
}

/** Reativa item desativado dentro da transação + log de auditoria (Sprint 7, decisão 3). */
async function reativarItem(item, conn, usuarioId) {
  await repository.setItemAtivo(item.id, true, conn);
  await registrarAuditoria(
    {
      usuarioId,
      acao: 'EDICAO',
      entidade: 'item_doacao',
      entidadeId: item.id,
      detalhe: 'Item reativado automaticamente no registro de doação',
    },
    conn,
  ).catch((err) => console.error('[audit] falha ao auditar reativação de item:', err));
}

/**
 * Resolve o item da movimentação, criando-o quando não existe (Sprint 7).
 * Deve ser chamada DENTRO da transação do service de doações (mesmo `conn`).
 *
 * Regras:
 * - mesma grafia (a collation ignora caixa E acentos) em categoria diferente
 *   → erro amigável (decisão 2);
 * - item existente e inativo → reativado dentro da transação, com auditoria
 *   (decisão 3);
 * - item inexistente → INSERT item + estoque zerado na mesma transação
 *   (erro ER_DUP_ENTRY — p.ex. duas doações simultâneas com o mesmo nome —
 *   é tratado re-buscando e seguindo com o item que o outro processo criou);
 * - criação e reativação são registradas no audit_log (§11.3).
 *
 * @returns {{id: number, tipo_doacao: string}} o item resolvido.
 */
async function resolverOuCriarItem({ nomeBruto, tipo, unidade }, conn, usuarioId = null) {
  if (!tipo || !isTipoValido(tipo)) {
    throw new Error('Selecione a categoria do item.');
  }
  const unidadeNormalizada = String(unidade || 'UN').trim().toUpperCase() || 'UN';
  if (!UNIDADES_ITEM.includes(unidadeNormalizada)) {
    throw new Error('Unidade inválida.');
  }
  const nome = normalizarNomeItem(nomeBruto);

  // Lookup simples (sem lock): o índice único é o ponto de serialização de
  // fato na criação; um SELECT FOR UPDATE no nome causaria deadlock quando
  // duas doações do MESMO nome novo chegassem simultaneamente (ambos travam o
  // gap e os INSERTs pedem intenção de inserção no gap um do outro).
  const existente = await repository.findItemPorNome(nome, conn);
  if (existente) {
    if (existente.tipo_doacao !== tipo) {
      throw erroItemEmOutraCategoria(existente);
    }
    if (!existente.ativo) {
      await reativarItem(existente, conn, usuarioId);
    }
    return existente;
  }

  try {
    const itemId = await repository.criarItem(
      { nome, tipo, unidade: unidadeNormalizada },
      conn,
    );
    await repository.criarEstoqueVazio(itemId, conn);
    await registrarAuditoria(
      {
        usuarioId,
        acao: 'CRIACAO',
        entidade: 'item_doacao',
        entidadeId: itemId,
        detalhe: 'Item criado automaticamente no registro de doação',
      },
      conn,
    ).catch((err) => console.error('[audit] falha ao auditar criação de item:', err));
    return { id: itemId, nome_item: nome, tipo_doacao: tipo, unidade: unidadeNormalizada, ativo: 1 };
  } catch (err) {
    // Concorrência entre doações do mesmo nome novo (ou grafia com acento):
    // o UNIQUE do banco barra o segundo INSERT (que já aguardou o commit da
    // vencedora); a re-busca FOR UPDATE força leitura ATUAL — um SELECT
    // comum usaria o snapshot REPEATABLE READ e não enxergaria o row
    // commitado pela outra transação depois que a nossa começou.
    if (err.code !== 'ER_DUP_ENTRY') throw err;
    const vencedor = await repository.findItemPorNome(nome, conn, { forUpdate: true });
    if (!vencedor) throw err;
    if (vencedor.tipo_doacao !== tipo) {
      throw erroItemEmOutraCategoria(vencedor);
    }
    if (!vencedor.ativo) {
      await reativarItem(vencedor, conn, usuarioId);
    }
    return vencedor;
  }
}

// --- Listagem/busca do estoque ---

/**
 * Lista o estoque (por item) com filtros: busca parcial por nome (`q`,
 * case-insensitive), filtro por tipo e por condição de estoque mínimo.
 * Adiciona `abaixo_minimo` quando `quantidade < estoque_minimo` (RF_S04).
 */
async function listar({ tipo = '', status = '', q = '' } = {}) {
  const tipoT = String(tipo || '').trim();
  const qT = String(q || '').trim().slice(0, 120);
  if (tipoT && !isTipoValido(tipoT)) throw new Error('Tipo de doação inválido.');

  const itens = await repository.listar({ tipo: tipoT, q: qT });

  const comIndicador = itens.map((item) => ({
    ...item,
    abaixo_minimo: item.quantidade < item.estoque_minimo,
  }));

  if (status === 'baixo') return comIndicador.filter((item) => item.abaixo_minimo);
  if (status === 'ok') return comIndicador.filter((item) => !item.abaixo_minimo);
  return comIndicador;
}

function listarItensParaSelecao() {
  return repository.listarItensAtivos();
}

async function obterItem(id) {
  return repository.findItemById(Number(id));
}

// --- CRUD de itens (RF_14; escrita restrita ao ADMINISTRADOR nas rotas) ---

function validarDadosItem(dados) {
  const nome = String(dados.nome_item || '').trim();
  const unidade = String(dados.unidade || 'UN').trim() || 'UN';
  const tipo = String(dados.tipo_doacao || '').trim();

  if (!nome || nome.length > 120) throw new Error('Informe um nome de item válido (até 120 caracteres).');
  if (!unidade || unidade.length > 20) throw new Error('Informe uma unidade válida (até 20 caracteres).');
  if (tipo && !isTipoValido(tipo)) throw new Error('Tipo de doação inválido.');

  return { nome, unidade, tipo };
}

/**
 * Cria um item com sua linha de estoque zerada — tudo na mesma transação
 * (transacionalidade, §2.1). O estoque de cada item nasce com saldo 0.
 */
async function criarItem(dados) {
  const { nome, unidade, tipo } = validarDadosItem(dados);
  if (!tipo) throw new Error('Selecione o tipo de doação do item.');

  const existente = await repository.findItemPorNomeTipo(nome, tipo);
  if (existente) throw new Error('Já existe um item com este nome neste tipo.');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const itemId = await repository.criarItem({ nome, tipo, unidade }, conn);
    await repository.criarEstoqueVazio(itemId, conn);
    await conn.commit();
    return itemId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/** Edita nome/unidade. O tipo não é editável: alterá-lo deslocaria saldos
 * entre tipos; nesse caso, desativar o item e criar outro (ver decisões). */
async function atualizarItem(id, dados) {
  const itemId = Number(id);
  if (!Number.isInteger(itemId) || itemId <= 0) throw new Error('Item inválido.');

  const item = await repository.findItemById(itemId);
  if (!item) throw new Error('Item não encontrado.');

  const { nome, unidade } = validarDadosItem({ ...dados, tipo_doacao: item.tipo_doacao });

  const duplicado = await repository.findItemPorNomeTipo(nome, item.tipo_doacao);
  if (duplicado && duplicado.id !== itemId) {
    throw new Error('Já existe um item com este nome neste tipo.');
  }

  await repository.atualizarItem(itemId, { nome, unidade });
}

async function alternarItemAtivo(id, ativo) {
  const itemId = Number(id);
  if (!Number.isInteger(itemId) || itemId <= 0) throw new Error('Item inválido.');
  const item = await repository.findItemById(itemId);
  if (!item) throw new Error('Item não encontrado.');
  await repository.setItemAtivo(itemId, ativo);
}

// --- Estoque mínimo (RF_16) ---

async function atualizarMinimo(itemId, minimo) {
  const id = Number(itemId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('Item inválido.');

  const item = await repository.findItemById(id);
  if (!item) throw new Error('Item não encontrado.');

  const valor = Number(minimo);
  if (!Number.isFinite(valor) || valor < 0) {
    throw new Error('Estoque mínimo deve ser um número maior ou igual a zero.');
  }

  await repository.atualizarMinimo(id, valor);
}

export {
  listar,
  listarItensParaSelecao,
  obterItem,
  criarItem,
  atualizarItem,
  alternarItemAtivo,
  atualizarMinimo,
  normalizarNomeItem,
  resolverOuCriarItem,
};
