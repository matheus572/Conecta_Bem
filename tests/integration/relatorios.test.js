// relatorios.test.js — UC12: integração dos relatórios com db-test.
// Cobre a matriz §12.2 (RF_S01/S02/S03), os valores esperados com dados
// semeados e a exportação em PDF/.xlsx (RF_29a).
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { app } from '../../src/app.js';
import { resetDatabase, closeDatabase, criarItem, pool } from '../helpers/db.js';
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

async function seedDadosRelatorio() {
  await pool.query(
    `INSERT INTO doador (tipo_doador, nome, documento, ativo) VALUES ('PF', 'Doador teste', '12345678901', 1)`,
  );
  const [[doador]] = await pool.query('SELECT id FROM doador LIMIT 1');

  await pool.query(
    `INSERT INTO beneficiario (nome, cpf, ativo) VALUES
      ('Maria da Silva', '11144477735', 1),
      ('João Santos', '93541134780', 1)`,
  );

  // Item específico (2 doações separadas) + item de roupas (Sprint 8: não há
  // mais genéricos semeados — os itens são criados explicitamente).
  const leiteId = await criarItem('Leite 1L', 'ALIMENTOS', 'L');
  const roupasId = await criarItem('Calça jeans', 'ROUPAS', 'UN');

  await pool.query(
    `INSERT INTO doacao (doador_id, item_id, tipo_doacao, quantidade, data_doacao) VALUES
      (?, ?, 'ALIMENTOS', 10, '2026-09-05'),
      (?, ?, 'ROUPAS', 4, '2026-09-06')`,
    [doador.id, leiteId, doador.id, roupasId],
  );
  await pool.query('UPDATE estoque SET quantidade = quantidade + 10 WHERE item_id = ?', [leiteId]);
  await pool.query('UPDATE estoque SET quantidade = quantidade + 4 WHERE item_id = ?', [roupasId]);

  await pool.query(
    `INSERT INTO distribuicao (beneficiario_id, item_id, tipo_doacao, quantidade, data_distribuicao) VALUES
      (1, ?, 'ALIMENTOS', 3, '2026-09-10'),
      (2, ?, 'ALIMENTOS', 2, '2026-09-11')`,
    [leiteId, leiteId],
  );
  await pool.query('UPDATE estoque SET quantidade = quantidade - 5 WHERE item_id = ?', [leiteId]);
  await pool.query(
    `INSERT INTO atendimento (beneficiario_id, data_atendimento, descricao) VALUES
      (1, '2026-09-10 10:00:00', 'Atendimento inicial')`,
  );
  await pool.query(
    `INSERT INTO campanha (titulo, descricao, data_inicio, data_fim, status) VALUES
      ('Campanha Setembro', 'Teste', '2026-09-01', '2026-09-30', 'ENCERRADA')`,
  );
}

describe('UC12 — matriz de permissões (§12.2)', () => {
  it('COLABORADOR recebe 403 no relatório de doações (RF_S01)', async () => {
    const res = await colaborador.get('/relatorios/doacoes');
    expect(res.status).toBe(403);
  });

  it('COLABORADOR recebe 403 no relatório de campanhas (RF_S03)', async () => {
    const res = await colaborador.get('/relatorios/campanhas');
    expect(res.status).toBe(403);
  });

  it('COLABORADOR acessa o relatório de atendimentos (RF_S02, versão básica)', async () => {
    const res = await colaborador.get('/relatorios/atendimentos');
    expect(res.status).toBe(200);
  });

  it('ADMINISTRADOR acessa todos os relatórios', async () => {
    for (const rota of ['doacoes', 'atendimentos', 'campanhas']) {
      const res = await admin.get(`/relatorios/${rota}`);
      expect(res.status).toBe(200);
    }
  });
});

describe('UC12 — geração com dados semeados', () => {
  beforeAll(seedDadosRelatorio);

  it('relatório de doações por período retorna os totais esperados (por tipo e por item)', async () => {
    const res = await admin.get('/relatorios/doacoes?inicio=2026-09-01&fim=2026-09-30');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Alimentos');
    expect(res.text).toContain('Roupas');
    // Total recebido: 10 alimentos + 4 roupas = 14.
    expect(res.text).toContain('14');
    // Total distribuído: 3 + 2 = 5.
    expect(res.text).toContain('>5<');

    // Nível de detalhe por item (Sprint 6).
    expect(res.text).toContain('Detalhamento por item');
    expect(res.text).toContain('Leite 1L');
    expect(res.text).toContain('Calça jeans');
  });

  it('relatório de doações fora do período não retorna dados', async () => {
    const res = await admin.get('/relatorios/doacoes?inicio=2026-01-01&fim=2026-01-31');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Nenhum dado encontrado');
  });

  it('relatório de atendimentos por período lista os beneficiários esperados', async () => {
    const res = await admin.get('/relatorios/atendimentos?inicio=2026-09-01&fim=2026-09-30');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Maria da Silva');
    expect(res.text).toContain('João Santos');
  });

  it('relatório de campanhas consolida o encerramento', async () => {
    const res = await admin.get('/relatorios/campanhas?inicio=2026-09-01&fim=2026-09-30');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Campanha Setembro');
    expect(res.text).toContain('ENCERRADA');
  });

  it('exportação PDF gera arquivo não vazio com content-type correto (RF_29a)', async () => {
    const res = await admin
      .get('/relatorios/doacoes?formato=pdf&inicio=2026-09-01&fim=2026-09-30')
      .buffer(true)
      .parse((r, cb) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.length).toBeGreaterThan(500);
    // Assinatura de PDF válida.
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('exportação .xlsx gera arquivo não vazio e válido (RF_29a)', async () => {
    const res = await admin
      .get('/relatorios/atendimentos?formato=xlsx&inicio=2026-09-01&fim=2026-09-30')
      .buffer(true)
      .parse((r, cb) => {
        const chunks = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
    expect(res.body.length).toBeGreaterThan(1000);
    // .xlsx é um ZIP: assinatura PK.
    expect(res.body.subarray(0, 2).toString()).toBe('PK');
  });

  it('COLABORADOR tem 403 também na exportação de doações', async () => {
    const res = await colaborador.get('/relatorios/doacoes?formato=pdf');
    expect(res.status).toBe(403);
  });
});
