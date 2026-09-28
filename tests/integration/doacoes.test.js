// doacoes.test.js — Sprint 6: doações e distribuições por ITEM (RN03),
// incluindo o cenário do bug relatado (duas doações do mesmo item devem
// SOMAR no mesmo saldo) e o teste de concorrência com a nova chave (item_id).
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { app } from '../../src/app.js';
import { resetDatabase, closeDatabase, pool } from '../helpers/db.js';
import { loginAgent } from '../helpers/auth.js';
import { NOME_ITEM_GENERICO } from '../../src/utils/tiposDoacao.js';

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

let seq = 0;

function proximoCpf() {
  seq += 1;
  return String(70000000000 + seq);
}

function proximoDocumento() {
  seq += 1;
  return String(71000000000000 + seq);
}

async function criarDoador() {
  const [r] = await pool.query(
    'INSERT INTO doador (nome, tipo_doador, documento) VALUES (?, ?, ?)',
    ['Doador Teste', 'PF', proximoDocumento()],
  );
  return r.insertId;
}

async function criarBeneficiario() {
  const [r] = await pool.query(
    'INSERT INTO beneficiario (nome, cpf) VALUES (?, ?)',
    ['Beneficiario Teste', proximoCpf()],
  );
  return r.insertId;
}

async function itemGenerico(tipo) {
  const [[row]] = await pool.query(
    'SELECT id FROM item_doacao WHERE nome_item = ? AND tipo_doacao = ?',
    [NOME_ITEM_GENERICO[tipo], tipo],
  );
  return row.id;
}

async function criarItem(nome, tipo = 'ALIMENTOS') {
  const [r] = await pool.query(
    'INSERT INTO item_doacao (nome_item, tipo_doacao, unidade) VALUES (?, ?, ?)',
    [nome, tipo, 'UN'],
  );
  await pool.query('INSERT INTO estoque (item_id, quantidade, estoque_minimo) VALUES (?, 0, 0)', [
    r.insertId,
  ]);
  return r.insertId;
}

async function saldoEstoque(itemId) {
  const [rows] = await pool.query('SELECT quantidade FROM estoque WHERE item_id = ?', [itemId]);
  return Number(rows[0]?.quantidade ?? 0);
}

describe('UC05 — Doações e Estoque por item (ponta a ponta)', () => {
  it('registrar doações de um item incrementa o saldo DO ITEM — e itens de tipos diferentes não se misturam', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    const doadorId = await criarDoador();

    const itemOutros = await itemGenerico('ALIMENTOS');
    const itemRoupas = await itemGenerico('ROUPAS');
    const leite = await criarItem('Leite 1L');

    // Duas doações SEPARADAS do mesmo item somam no mesmo saldo (bug relatado).
    const r1 = await admin.post('/doacoes').type('form').send({
      doador_id: String(doadorId),
      item_id: String(leite),
      quantidade: '12',
      data_doacao: '2026-09-07',
    });
    expect(r1.status).toBe(302);
    const r2 = await admin.post('/doacoes').type('form').send({
      doador_id: String(doadorId),
      item_id: String(leite),
      quantidade: '8',
      data_doacao: '2026-09-08',
    });
    expect(r2.status).toBe(302);
    expect(await saldoEstoque(leite)).toBe(20);

    const [linhas] = await pool.query('SELECT item_id, quantidade FROM estoque');
    expect(linhas.filter((l) => l.item_id === leite)).toHaveLength(1);

    // O tipo gravado na doação vem do item (derivado), não do formulário.
    const [[doacao]] = await pool.query(
      'SELECT tipo_doacao, item_id FROM doacao WHERE item_id = ? ORDER BY id DESC LIMIT 1',
      [leite],
    );
    expect(doacao.tipo_doacao).toBe('ALIMENTOS');

    // Saldo do item genérico de ALIMENTOS não é tocado.
    expect(await saldoEstoque(itemOutros)).toBe(0);
    expect(await saldoEstoque(itemRoupas)).toBe(0);
  });

  it('registrar distribuição decrementa o saldo do item', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    const beneficiarioId = await criarBeneficiario();
    const [[leite]] = await pool.query(
      "SELECT id FROM item_doacao WHERE nome_item = 'Leite 1L' AND tipo_doacao = 'ALIMENTOS'",
    );

    const res = await admin.post('/doacoes/distribuicoes').type('form').send({
      beneficiario_id: String(beneficiarioId),
      item_id: String(leite.id),
      quantidade: '8',
      data_distribuicao: '2026-09-08',
    });
    expect(res.status).toBe(302);

    expect(await saldoEstoque(leite.id)).toBe(12);
  });

  it('distribuição acima do saldo falha sem alterar o estoque (rollback)', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    const beneficiarioId = await criarBeneficiario();
    const [[leite]] = await pool.query(
      "SELECT id FROM item_doacao WHERE nome_item = 'Leite 1L' AND tipo_doacao = 'ALIMENTOS'",
    );
    const antes = await saldoEstoque(leite.id);

    const res = await admin.post('/doacoes/distribuicoes').type('form').send({
      beneficiario_id: String(beneficiarioId),
      item_id: String(leite.id),
      quantidade: '999999',
      data_distribuicao: '2026-09-08',
    });
    expect(res.status).toBe(400);
    expect(res.text).toContain('Estoque insuficiente para esta distribuição.');

    expect(await saldoEstoque(leite.id)).toBe(antes);
  });
});

describe('UC05 — Concorrência por item (SELECT ... FOR UPDATE)', () => {
  it('duas distribuições simultâneas do MESMO item nunca deixam o estoque negativo', async () => {
    const itemId = await criarItem('Item concorrente', 'OUTROS');
    await pool.query('UPDATE estoque SET quantidade = 10 WHERE item_id = ?', [itemId]);

    const [beneficiarioA, beneficiarioB] = await Promise.all([criarBeneficiario(), criarBeneficiario()]);

    const agentes = await Promise.all([
      loginAgent(app, 'admin@conectabem.net', 'admin123'),
      loginAgent(app, 'admin@conectabem.net', 'admin123'),
    ]);

    const resultados = await Promise.all([
      agentes[0].post('/doacoes/distribuicoes').type('form').send({
        beneficiario_id: String(beneficiarioA),
        item_id: String(itemId),
        quantidade: '6',
      }),
      agentes[1].post('/doacoes/distribuicoes').type('form').send({
        beneficiario_id: String(beneficiarioB),
        item_id: String(itemId),
        quantidade: '6',
      }),
    ]);

    const statusSet = resultados.map((r) => r.status).sort();
    expect(statusSet).toEqual([302, 400]);

    const saldo = await saldoEstoque(itemId);
    expect(saldo).toBe(4);
    expect(saldo).toBeGreaterThanOrEqual(0);
  });
});

describe('Matriz §12.2 — acesso do COLABORADOR a doações/estoque', () => {
  it('COLABORADOR tem acesso completo (listagens, formulários e registros)', async () => {
    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');
    const doadorId = await criarDoador();
    const beneficiarioId = await criarBeneficiario();
    const itemId = await itemGenerico('ROUPAS');

    expect((await colab.get('/doacoes')).status).toBe(200);
    expect((await colab.get('/doacoes/nova')).status).toBe(200);
    expect((await colab.get('/doacoes/distribuicoes')).status).toBe(200);
    expect((await colab.get('/doacoes/distribuicoes/nova')).status).toBe(200);
    expect((await colab.get('/estoque')).status).toBe(200);

    const doacao = await colab.post('/doacoes').type('form').send({
      doador_id: String(doadorId),
      item_id: String(itemId),
      quantidade: '5',
    });
    expect(doacao.status).toBe(302);

    const distribuicao = await colab.post('/doacoes/distribuicoes').type('form').send({
      beneficiario_id: String(beneficiarioId),
      item_id: String(itemId),
      quantidade: '2',
    });
    expect(distribuicao.status).toBe(302);

    const minimo = await colab.put(`/estoque/${itemId}/minimo`).type('form').send({ estoque_minimo: '3' });
    expect(minimo.status).toBe(302);
  });
});
