import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { app } from '../../src/app.js';
import { resetDatabase, closeDatabase, pool } from '../helpers/db.js';
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

async function saldoEstoque(tipo) {
  const [rows] = await pool.query('SELECT quantidade FROM estoque WHERE tipo_doacao = ?', [tipo]);
  return Number(rows[0]?.quantidade ?? 0);
}

describe('UC05 — Doações e Estoque (ponta a ponta)', () => {
  it('registrar doação incrementa o estoque', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    const doadorId = await criarDoador();

    const res = await admin.post('/doacoes').type('form').send({
      doador_id: String(doadorId),
      tipo_doacao: 'ALIMENTOS',
      quantidade: '20',
      data_doacao: '2026-09-07',
    });
    expect(res.status).toBe(302);

    expect(await saldoEstoque('ALIMENTOS')).toBe(20);
  });

  it('registrar distribuição decrementa o estoque', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    const beneficiarioId = await criarBeneficiario();

    const res = await admin.post('/doacoes/distribuicoes').type('form').send({
      beneficiario_id: String(beneficiarioId),
      tipo_doacao: 'ALIMENTOS',
      quantidade: '8',
      data_distribuicao: '2026-09-08',
    });
    expect(res.status).toBe(302);

    expect(await saldoEstoque('ALIMENTOS')).toBe(12);
  });

  it('distribuição acima do saldo falha sem alterar o estoque (rollback)', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    const beneficiarioId = await criarBeneficiario();
    const antes = await saldoEstoque('ALIMENTOS');

    const res = await admin.post('/doacoes/distribuicoes').type('form').send({
      beneficiario_id: String(beneficiarioId),
      tipo_doacao: 'ALIMENTOS',
      quantidade: '999999',
      data_distribuicao: '2026-09-08',
    });
    expect(res.status).toBe(400);
    expect(res.text).toContain('Estoque insuficiente para esta distribuição.');

    expect(await saldoEstoque('ALIMENTOS')).toBe(antes);
  });
});

describe('UC05 — Concorrência (SELECT ... FOR UPDATE)', () => {
  it('duas distribuições simultâneas nunca deixam o estoque negativo', async () => {
    // Garante um saldo conhecido para o tipo OUTROS, sem afetar demais testes.
    await pool.query("UPDATE estoque SET quantidade = 10 WHERE tipo_doacao = 'OUTROS'");

    const [beneficiarioA, beneficiarioB] = await Promise.all([criarBeneficiario(), criarBeneficiario()]);

    const agentes = await Promise.all([
      loginAgent(app, 'admin@conectabem.net', 'admin123'),
      loginAgent(app, 'admin@conectabem.net', 'admin123'),
    ]);

    const resultados = await Promise.all([
      agentes[0].post('/doacoes/distribuicoes').type('form').send({
        beneficiario_id: String(beneficiarioA),
        tipo_doacao: 'OUTROS',
        quantidade: '6',
      }),
      agentes[1].post('/doacoes/distribuicoes').type('form').send({
        beneficiario_id: String(beneficiarioB),
        tipo_doacao: 'OUTROS',
        quantidade: '6',
      }),
    ]);

    const statusSet = resultados.map((r) => r.status).sort();
    expect(statusSet).toEqual([302, 400]);

    const saldo = await saldoEstoque('OUTROS');
    expect(saldo).toBe(4);
    expect(saldo).toBeGreaterThanOrEqual(0);
  });
});

describe('Matriz §12.2 — acesso do COLABORADOR a doações/estoque', () => {
  it('COLABORADOR tem acesso completo (listagens, formulários e registros)', async () => {
    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');
    const doadorId = await criarDoador();
    const beneficiarioId = await criarBeneficiario();

    expect((await colab.get('/doacoes')).status).toBe(200);
    expect((await colab.get('/doacoes/nova')).status).toBe(200);
    expect((await colab.get('/doacoes/distribuicoes')).status).toBe(200);
    expect((await colab.get('/doacoes/distribuicoes/nova')).status).toBe(200);
    expect((await colab.get('/estoque')).status).toBe(200);

    const doacao = await colab.post('/doacoes').type('form').send({
      doador_id: String(doadorId),
      tipo_doacao: 'ROUPAS',
      quantidade: '5',
    });
    expect(doacao.status).toBe(302);

    const distribuicao = await colab.post('/doacoes/distribuicoes').type('form').send({
      beneficiario_id: String(beneficiarioId),
      tipo_doacao: 'ROUPAS',
      quantidade: '2',
    });
    expect(distribuicao.status).toBe(302);

    const minimo = await colab.put('/estoque/ROUPAS/minimo').type('form').send({ estoque_minimo: '3' });
    expect(minimo.status).toBe(302);
  });
});