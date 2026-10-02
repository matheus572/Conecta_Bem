// itens.test.js — Sprint 6: CRUD de itens, busca parcial por nome no estoque
// e matriz §12.2 (escrita em itens: somente ADMINISTRADOR).
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { app } from '../../src/app.js';
import { resetDatabase, closeDatabase, pool } from '../helpers/db.js';
import { loginAgent } from '../helpers/auth.js';

let admin;
let colaborador;

beforeAll(async () => {
  await resetDatabase();
  admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
  colaborador = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');
});

afterAll(async () => {
  await closeDatabase();
});

async function saldoDoItem(itemId) {
  const [[row]] = await pool.query('SELECT quantidade FROM estoque WHERE item_id = ?', [itemId]);
  return Number(row?.quantidade ?? 0);
}

async function criarItemEspecifico(nome, tipo = 'ALIMENTOS', unidade = 'UN') {
  const [r] = await pool.query(
    'INSERT INTO item_doacao (nome_item, tipo_doacao, unidade) VALUES (?, ?, ?)',
    [nome, tipo, unidade],
  );
  await pool.query('INSERT INTO estoque (item_id, quantidade, estoque_minimo) VALUES (?, 0, 0)', [
    r.insertId,
  ]);
  return r.insertId;
}

describe('CRUD de itens — matriz §12.2', () => {
  it('ADMINISTRADOR cadastra item e a linha de estoque nasce zerada', async () => {
    const res = await admin.post('/estoque/itens').type('form').send({
      nome_item: 'Leite 1L',
      tipo_doacao: 'ALIMENTOS',
      unidade: 'L',
    });
    expect(res.status).toBe(302);

    const [[item]] = await pool.query(
      "SELECT id FROM item_doacao WHERE nome_item = 'Leite 1L' AND tipo_doacao = 'ALIMENTOS'",
    );
    expect(item).toBeTruthy();
    expect(await saldoDoItem(item.id)).toBe(0);
  });

  it('duplicar nome no mesmo tipo falha com mensagem amigável', async () => {
    const res = await admin.post('/estoque/itens').type('form').send({
      nome_item: 'Leite 1L',
      tipo_doacao: 'ALIMENTOS',
      unidade: 'L',
    });
    expect(res.status).toBe(400);
    expect(res.text).toContain('Já existe um item com este nome neste tipo');
  });

  it('mesmo nome em tipo diferente é permitido', async () => {
    const res = await admin.post('/estoque/itens').type('form').send({
      nome_item: 'Leite 1L',
      tipo_doacao: 'OUTROS',
      unidade: 'L',
    });
    expect(res.status).toBe(302);
  });

  it('COLABORADOR recebe 403 ao cadastrar item (mas consulta a lista)', async () => {
    expect((await colaborador.get('/estoque')).status).toBe(200);

    const criar = await colaborador.post('/estoque/itens').type('form').send({
      nome_item: 'Item proibido',
      tipo_doacao: 'ALIMENTOS',
      unidade: 'UN',
    });
    expect(criar.status).toBe(403);

    const [[tab]] = await pool.query(
      "SELECT id FROM item_doacao WHERE nome_item = 'Item proibido'",
    );
    expect(tab).toBeUndefined();
  });

  it('item desativado some dos <select> de movimentação mas continua na listagem', async () => {
    const [[item]] = await pool.query(
      "SELECT id FROM item_doacao WHERE nome_item = 'Leite 1L' AND tipo_doacao = 'ALIMENTOS' LIMIT 1",
    );

    const desativar = await admin
      .put(`/estoque/itens/${item.id}/ativo`)
      .type('form')
      .send({ ativo: '0' });
    expect(desativar.status).toBe(302);

    // Form de doação (datalist — Sprint 7): item desativado some das opções
    // do seu TIPO (o homônimo em OUTROS continua aparecendo).
    const formDoacao = await colaborador.get('/doacoes/nova');
    expect(formDoacao.status).toBe(200);
    expect(formDoacao.text).not.toContain('value="Leite 1L" data-tipo="ALIMENTOS"');
    expect(formDoacao.text).toContain('value="Leite 1L" data-tipo="OUTROS"');

    const lista = await admin.get('/estoque');
    expect(lista.text).toMatch(/Leite 1L[\s\S]*?Inativo/);
  });
});

describe('Busca de estoque por nome do item (parcial, case-insensitive)', () => {
  it('"lei" encontra os "Leite 1L" dos dois tipos; filtro de tipo refina', async () => {
    const todos = await colaborador.get('/estoque?q=lei');
    expect(todos.status).toBe(200);
    expect((todos.text.match(/Leite 1L/g) || []).length).toBeGreaterThanOrEqual(2);

    // Refinando por OUTROS, resta apenas UMA linha do homônimo nesse tipo — a
    // view repete o nome em duas marcas por linha (célula e aria-label do
    // input de mínimo), então 2 ocorrências = 1 item.
    const porTipo = await colaborador.get('/estoque?q=lei&tipo=OUTROS');
    expect(porTipo.status).toBe(200);
    expect((porTipo.text.match(/Leite 1L/g) || []).length).toBe(2);

    // Sem o refinamento, aparecem as duas linhas (ALIMENTOS inativo + OUTROS).
    expect((todos.text.match(/Leite 1L/g) || []).length).toBeGreaterThanOrEqual(4);
  });

  it('busca sem correspondência informa estado vazio (sem erro)', async () => {
    const res = await colaborador.get('/estoque?q=xyz-inexistente');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Nenhum item encontrado');
  });

  it('estoque mínimo por item e badge de alerta por item', async () => {
    const arrozId = await criarItemEspecifico('Arroz 5kg', 'ALIMENTOS', 'KG');

    const minimo = await colaborador
      .put(`/estoque/${arrozId}/minimo`)
      .type('form')
      .send({ estoque_minimo: '10' });
    expect(minimo.status).toBe(302);

    const lista = await colaborador.get('/estoque?q=arroz');
    expect(lista.status).toBe(200);
    expect(lista.text).toMatch(/Arroz 5kg[\s\S]*?Estoque abaixo do mínimo/);
  });
});
