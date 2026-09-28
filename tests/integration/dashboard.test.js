// dashboard.test.js — UC14: painel de controle com a base de teste.
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { app } from '../../src/app.js';
import { resetDatabase, closeDatabase, pool } from '../helpers/db.js';
import { loginAgent } from '../helpers/auth.js';
import { NOME_ITEM_GENERICO } from '../../src/utils/tiposDoacao.js';

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

describe('UC14 — Visualizar Dashboard (RF_29/RF_S05)', () => {
  it('base vazia exibe indicadores zerados com mensagem orientativa (sem erro)', async () => {
    const res = await colaborador.get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Painel de controle');
    expect(res.text).toContain('Ainda não há dados cadastrados');
    expect(res.text).toContain('Nenhuma campanha planejada');
  });

  it('o painel é acessível aos dois perfis (matriz §12.2 — RF_S05 X/X)', async () => {
    expect((await admin.get('/')).status).toBe(200);
    expect((await colaborador.get('/')).status).toBe(200);
  });

  it('com dados semeados, os indicadores refletem os totais', async () => {
    await pool.query(
      `INSERT INTO beneficiario (nome, cpf, ativo) VALUES
        ('Maria da Silva', '11144477735', 1),
        ('João Santos', '93541134780', 1)`,
    );
    await pool.query(
      `INSERT INTO voluntario (nome, cpf, ativo) VALUES ('Voluntária Um', '52998224725', 1)`,
    );
    await pool.query(
      `INSERT INTO doador (tipo_doador, nome, documento, ativo) VALUES ('PF', 'Doador teste', '12345678901', 1)`,
    );
    const [[doador]] = await pool.query('SELECT id FROM doador LIMIT 1');
    const [[itemAli]] = await pool.query(
      `SELECT id FROM item_doacao WHERE nome_item = ? AND tipo_doacao = 'ALIMENTOS'`,
      [NOME_ITEM_GENERICO.ALIMENTOS],
    );
    await pool.query(
      'INSERT INTO doacao (doador_id, item_id, tipo_doacao, quantidade, data_doacao) VALUES (?, ?, ?, ?, CURDATE())',
      [doador.id, itemAli.id, 'ALIMENTOS', 5],
    );
    await pool.query(
      `INSERT INTO campanha (titulo, descricao, data_inicio, data_fim, status) VALUES
        ('Próxima campanha', 'Teste', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 30 DAY), 'ATIVA')`,
    );
    // Estoque abaixo do mínimo por ITEM (Sprint 6): 0 < 10 no item genérico.
    await pool.query('UPDATE estoque SET estoque_minimo = 10 WHERE item_id = ?', [itemAli.id]);

    const res = await admin.get('/');
    expect(res.status).toBe(200);
    // 2 beneficiários ativos, 1 voluntário ativo, 1 doação no mês.
    expect(res.text).toMatch(/Beneficiários ativos[\s\S]*?display-6 fw-bold">2</);
    expect(res.text).toMatch(/Doações no mês[\s\S]*?display-6 fw-bold">1</);
    expect(res.text).toMatch(/Voluntários ativos[\s\S]*?display-6 fw-bold">1</);
    // 1 item abaixo do mínimo (item genérico de ALIMENTOS: 0 < 10) com destaque
    // e lista de campanhas.
    expect(res.text).toMatch(/Estoque abaixo do mínimo[\s\S]*?display-6 fw-bold">1</);
    expect(res.text).toContain(NOME_ITEM_GENERICO.ALIMENTOS);
    expect(res.text).toContain('Próxima campanha');
  });
});
