// doacoes.test.js — Sprint 7: doação por NOME de item com criação automática,
// e distribuição por item existente (RN03). Cobre o bug relatado (duas doações
// do mesmo item devem SOMAR no mesmo saldo) e a concorrência por item.
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { app } from '../../src/app.js';
import { resetDatabase, closeDatabase, criarItem, pool } from '../helpers/db.js';
import { loginAgent } from '../helpers/auth.js';

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

async function saldoEstoque(itemId) {
  const [rows] = await pool.query('SELECT quantidade FROM estoque WHERE item_id = ?', [itemId]);
  return Number(rows[0]?.quantidade ?? 0);
}

describe('UC05 — Doações com nome digitado e criação automática de item (Sprint 7)', () => {
  it('doar item novo cria item+estoque+doação; duas doações do MESMO nome somam no mesmo saldo', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    const doadorId = await criarDoador();

    // Duas doações SEPARADAS do mesmo item digitado somam no mesmo saldo (bug relatado).
    const r1 = await admin.post('/doacoes').type('form').send({
      doador_id: String(doadorId),
      nome_item: 'Leite 1L',
      tipo_doacao: 'ALIMENTOS',
      unidade: 'L',
      quantidade: '12',
      data_doacao: '2026-09-07',
    });
    expect(r1.status).toBe(302);
    const r2 = await admin.post('/doacoes').type('form').send({
      doador_id: String(doadorId),
      nome_item: 'Leite 1L',
      tipo_doacao: 'ALIMENTOS',
      unidade: 'L',
      quantidade: '8',
      data_doacao: '2026-09-08',
    });
    expect(r2.status).toBe(302);

    const [[leite]] = await pool.query(
      "SELECT id FROM item_doacao WHERE nome_item = 'Leite 1L' AND tipo_doacao = 'ALIMENTOS'",
    );
    expect(leite).toBeTruthy();

    const [linhas] = await pool.query('SELECT item_id, quantidade FROM estoque WHERE item_id = ?', [
      leite.id,
    ]);
    expect(linhas).toHaveLength(1);
    expect(Number(linhas[0].quantidade)).toBe(20);

    // O tipo gravado na doação vem do item (derivado), não do formulário.
    const [[doacao]] = await pool.query(
      'SELECT tipo_doacao, item_id FROM doacao WHERE item_id = ? ORDER BY id DESC LIMIT 1',
      [leite.id],
    );
    expect(doacao.tipo_doacao).toBe('ALIMENTOS');
  });

  it('grafia diferente — caixa, espaços E ACENTOS — casa no mesmo item (collation verificada)', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    const doadorId = await criarDoador();

    await admin.post('/doacoes').type('form').send({
      doador_id: String(doadorId),
      nome_item: 'Feijão 1kg',
      tipo_doacao: 'ALIMENTOS',
      quantidade: '10',
    });

    const r = await admin.post('/doacoes').type('form').send({
      doador_id: String(doadorId),
      nome_item: '  FEIJAO 1kg ',
      tipo_doacao: 'ALIMENTOS',
      quantidade: '3',
    });
    expect(r.status).toBe(302);

    const [itens] = await pool.query(
      "SELECT id FROM item_doacao WHERE nome_item = 'Feijão 1kg'",
    );
    expect(itens).toHaveLength(1);
    expect(await saldoEstoque(itens[0].id)).toBe(13);
  });

  it('mesmo nome em categoria diferente é rejeitado com mensagem clara', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    const doadorId = await criarDoador();

    const res = await admin.post('/doacoes').type('form').send({
      doador_id: String(doadorId),
      nome_item: 'Leite 1L',
      tipo_doacao: 'OUTROS',
      quantidade: '5',
    });
    expect(res.status).toBe(400);
    expect(res.text).toContain("Já existe o item &#39;Leite 1L&#39; na categoria Alimentos");

    const [dup] = await pool.query(
      "SELECT id FROM item_doacao WHERE nome_item = 'Leite 1L' AND tipo_doacao = 'OUTROS'",
    );
    expect(dup).toHaveLength(0);
  });

  it('item desativado é reativado na transação e registrado em auditoria', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    const doadorId = await criarDoador();

    await admin.post('/doacoes').type('form').send({
      doador_id: String(doadorId),
      nome_item: 'Sabão em pó',
      tipo_doacao: 'OUTROS',
      quantidade: '3',
    });
    const [[item]] = await pool.query(
      "SELECT id FROM item_doacao WHERE nome_item = 'Sabão em pó'",
    );
    await pool.query('UPDATE item_doacao SET ativo = 0 WHERE id = ?', [item.id]);

    const res = await admin.post('/doacoes').type('form').send({
      doador_id: String(doadorId),
      nome_item: 'sabão em pó',
      tipo_doacao: 'OUTROS',
      quantidade: '2',
    });
    expect(res.status).toBe(302);

    const [[depois]] = await pool.query('SELECT ativo FROM item_doacao WHERE id = ?', [item.id]);
    expect(depois.ativo).toBe(1);
    expect(await saldoEstoque(item.id)).toBe(5);

    const [[audit]] = await pool.query(
      `SELECT id FROM audit_log
        WHERE entidade = 'item_doacao' AND entidade_id = ? AND acao = 'EDICAO'
        ORDER BY id DESC LIMIT 1`,
      [item.id],
    );
    expect(audit).toBeTruthy();
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
  it('COLABORADOR registra doação com item NOVO (Sprint 7) e mantém demais acessos', async () => {
    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');
    const doadorId = await criarDoador();
    const beneficiarioId = await criarBeneficiario();
    const itemId = await criarItem('Roupas para mínimo', 'ROUPAS');

    expect((await colab.get('/doacoes')).status).toBe(200);
    expect((await colab.get('/doacoes/nova')).status).toBe(200);
    expect((await colab.get('/doacoes/distribuicoes')).status).toBe(200);
    expect((await colab.get('/doacoes/distribuicoes/nova')).status).toBe(200);
    expect((await colab.get('/estoque')).status).toBe(200);

    const doacao = await colab.post('/doacoes').type('form').send({
      doador_id: String(doadorId),
      nome_item: 'Roupas infantis',
      tipo_doacao: 'ROUPAS',
      unidade: 'CX',
      quantidade: '5',
    });
    expect(doacao.status).toBe(302);

    // A distribuição sai do item criado pela doação (saldo 5).
    const [[itemCriado]] = await pool.query(
      "SELECT id FROM item_doacao WHERE nome_item = 'Roupas infantis'",
    );
    const distribuicao = await colab.post('/doacoes/distribuicoes').type('form').send({
      beneficiario_id: String(beneficiarioId),
      item_id: String(itemCriado.id),
      quantidade: '2',
    });
    expect(distribuicao.status).toBe(302);

    // E o mínimo por item (RF_16) segue configurável pelo COLABORADOR.
    expect(itemId).toBeTruthy();
    const minimo = await colab.put(`/estoque/${itemId}/minimo`).type('form').send({ estoque_minimo: '3' });
    expect(minimo.status).toBe(302);
  });
});
