// catalogo-vazio.test.js — Sprint 8: sem itens genéricos semeados, o catálogo
// nasce vazio e o sistema exibe estado vazio (sem erro) em estoque, relatórios
// e dashboard, até o primeiro item ser criado pelo registro de doação (Sprint 7).
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { app } from '../../src/app.js';
import { resetDatabase, closeDatabase, pool } from '../helpers/db.js';
import { loginAgent } from '../helpers/auth.js';

const execFileAsync = promisify(execFile);
const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let admin;

beforeAll(async () => {
  await resetDatabase();
  admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
});

afterAll(async () => {
  await closeDatabase();
});

describe('Sprint 8 — sem itens genéricos', () => {
  it('catálogo nasce vazio após migrations: zero itens e zero linhas de estoque', async () => {
    const [[i]] = await pool.query('SELECT COUNT(*) AS n FROM item_doacao');
    const [[e]] = await pool.query('SELECT COUNT(*) AS n FROM estoque');
    expect(i.n).toBe(0);
    expect(e.n).toBe(0);
  });

  it('rodar a migration 024 em base nova não cria itens genéricos', async () => {
    // 024 já rodou no resetDatabase (db-test recém-migrado): se ainda criasse
    // os genéricos, haveria 4 registros "Outros ...".
    const [genericos] = await pool.query(
      "SELECT id FROM item_doacao WHERE nome_item LIKE 'Outros%'",
    );
    expect(genericos).toHaveLength(0);
  });

  it('o seed do zero cria apenas o administrador (nenhum item no processo)', async () => {
    // Reaproveita o banco de teste: seed deve ser idempotente e não criar itens.
    const { stdout, stderr } = await execFileAsync('node', ['migrations/seed.js'], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, ADMIN_PASSWORD: 'senha-do-teste-123' },
    });
    expect(`${stdout}${stderr}`).not.toMatch(/erro/i);

    const [[i]] = await pool.query('SELECT COUNT(*) AS n FROM item_doacao');
    const [[e]] = await pool.query('SELECT COUNT(*) AS n FROM estoque');
    expect(i.n).toBe(0);
    expect(e.n).toBe(0);

    // O admin pré-semeado pelo helper já existia; o seed apenas o reportou.
    const [[u]] = await pool.query(
      "SELECT COUNT(*) AS n FROM usuario WHERE email = 'admin@conectabem.net'",
    );
    expect(u.n).toBeGreaterThanOrEqual(1);
  });

  it('estoque vazio renderiza estado vazio (200), sem erro', async () => {
    const res = await admin.get('/estoque');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Nenhum item encontrado');
  });

  it('dashboard com catálogo vazio exibe indicadores zerados (UC14 — fluxo alternativo)', async () => {
    const res = await admin.get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Ainda não há dados cadastrados');
    expect(res.text).toContain('Nenhuma campanha planejada');
  });

  it('relatório de doações com catálogo vazio informa que não há dados (RF_26/UC12)', async () => {
    const res = await admin.get('/relatorios/doacoes');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Nenhum dado encontrado/);
  });

  it('o alerta RF_16 não dispara com catálogo vazio (zero itens abaixo do mínimo)', async () => {
    const res = await admin.get('/');
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('Atenção:');
  });
});
