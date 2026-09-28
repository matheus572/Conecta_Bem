// migracao-estoque.test.js — Sprint 6: testa a MIGRAÇÃO DE DADOS de estoque
// por tipo → por item (migrations 021–024) contra um banco descartável que
// reproduz exatamente o schema legado da Sprint 2.
//
// Cenário: saldo agregado e movimentações pré-Sprint 6 (só com tipo_doacao)
// devem aparecer, após a migração, vinculados ao item genérico "Outros
// [tipo]", com o saldo total preservado.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import mysql from 'mysql2/promise';

import { NOME_ITEM_GENERICO } from '../../src/utils/tiposDoacao.js';

const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../migrations',
);
const NOVAS_MIGRATIONS = [
  '021_item_doacao.sql',
  '022_movimentacao_item.sql',
  '023_estoque_por_item.sql',
  '024_backfill_item_generico.sql',
];

let conn;
const DB_NAME = `conectabem_mig_${Math.floor(Math.random() * 1e9)}`;

async function queryFile(file) {
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
  await conn.query(sql);
}

beforeAll(async () => {
  // O schema descartável exige CREATE/DROP DATABASE — usa o usuário root do
  // db-test (mesmas credenciais do docker-compose), que só existe em teste.
  conn = await mysql.createConnection({
    host: process.env.DB_TEST_HOST || 'localhost',
    port: Number(process.env.DB_TEST_PORT || 3308),
    user: 'root',
    password: process.env.MYSQL_ROOT_PASSWORD || 'root_dev_somente',
    multipleStatements: true,
  });
  await conn.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\`; CREATE DATABASE \`${DB_NAME}\``);
  await conn.changeUser({ database: DB_NAME });

  // Schema legado (Sprint 2): estoque por tipo + movimentações sem item.
  await conn.query(`
    CREATE TABLE \`estoque\` (
      \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`tipo_doacao\` ENUM('ALIMENTOS','ROUPAS','MOVEIS_UTENSILIOS','OUTROS') NOT NULL,
      \`quantidade\` DECIMAL(10,2) NOT NULL DEFAULT 0,
      \`estoque_minimo\` DECIMAL(10,2) NOT NULL DEFAULT 0,
      \`created_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updated_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`id\`),
      UNIQUE KEY \`uq_estoque_tipo\` (\`tipo_doacao\`),
      CONSTRAINT \`chk_leg_qtd\` CHECK (\`quantidade\` >= 0),
      CONSTRAINT \`chk_leg_min\` CHECK (\`estoque_minimo\` >= 0)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE \`doacao\` (
      \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`tipo_doacao\` ENUM('ALIMENTOS','ROUPAS','MOVEIS_UTENSILIOS','OUTROS') NOT NULL,
      \`quantidade\` DECIMAL(10,2) NOT NULL,
      \`data_doacao\` DATE NOT NULL,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

    CREATE TABLE \`distribuicao\` (
      \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
      \`tipo_doacao\` ENUM('ALIMENTOS','ROUPAS','MOVEIS_UTENSILIOS','OUTROS') NOT NULL,
      \`quantidade\` DECIMAL(10,2) NOT NULL,
      \`data_distribuicao\` DATE NOT NULL,
      PRIMARY KEY (\`id\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Histórico pré-Sprint 6 (sem item).
  await conn.query(`
    INSERT INTO \`estoque\` (\`tipo_doacao\`, \`quantidade\`, \`estoque_minimo\`) VALUES
      ('ALIMENTOS', 15, 3),
      ('ROUPAS', 20, 5);
    INSERT INTO \`doacao\` (\`tipo_doacao\`, \`quantidade\`, \`data_doacao\`) VALUES
      ('ALIMENTOS', 10, '2026-08-01'),
      ('ALIMENTOS', 10, '2026-08-15'),
      ('ROUPAS', 3, '2026-08-02');
    INSERT INTO \`distribuicao\` (\`tipo_doacao\`, \`quantidade\`, \`data_distribuicao\`) VALUES
      ('ALIMENTOS', 5, '2026-08-20');
  `);

  for (const file of NOVAS_MIGRATIONS) {
    await queryFile(file);
  }
});

afterAll(async () => {
  if (conn) {
    await conn.query(`DROP DATABASE IF EXISTS \`${DB_NAME}\``);
    await conn.end();
  }
});

describe('migração de dados Sprint 2 → Sprint 6 (saldo por tipo → por item)', () => {
  it('cria um item genérico "Outros [tipo]" para cada tipo existente', async () => {
    const [rows] = await conn.query(
      'SELECT nome_item, tipo_doacao FROM `item_doacao` ORDER BY tipo_doacao',
    );
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.nome_item).sort()).toEqual(
      Object.values(NOME_ITEM_GENERICO).sort(),
    );
  });

  it('preserva o saldo agregado e o mínimo no item genérico do tipo', async () => {
    const [rows] = await conn.query(
      `SELECT i.tipo_doacao, e.quantidade, e.estoque_minimo
         FROM \`estoque\` e
         JOIN \`item_doacao\` i ON i.id = e.item_id
        ORDER BY i.tipo_doacao`,
    );
    const porTipo = Object.fromEntries(rows.map((r) => [r.tipo_doacao, r]));
    expect(Number(porTipo.ALIMENTOS.quantidade)).toBe(15);
    expect(Number(porTipo.ALIMENTOS.estoque_minimo)).toBe(3);
    expect(Number(porTipo.ROUPAS.quantidade)).toBe(20);
    expect(Number(porTipo.ROUPAS.estoque_minimo)).toBe(5);
    // Tipos sem saldo prévio não recebem linha de estoque aqui (o seed/app
    // garante a linha quando o item for criado/usado).
    expect(rows).toHaveLength(2);
  });

  it('vincula retroativamente as doações históricas ao item genérico do tipo', async () => {
    const [rows] = await conn.query(
      `SELECT d.tipo_doacao, i.nome_item, d.quantidade, d.data_doacao
         FROM \`doacao\` d
         JOIN \`item_doacao\` i ON i.id = d.item_id
        ORDER BY d.id`,
    );
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.nome_item)).toEqual([
      NOME_ITEM_GENERICO.ALIMENTOS,
      NOME_ITEM_GENERICO.ALIMENTOS,
      NOME_ITEM_GENERICO.ROUPAS,
    ]);
    // Soma das quantidades preservada.
    const total = rows.reduce((acc, r) => acc + Number(r.quantidade), 0);
    expect(total).toBe(23);
  });

  it('vincula retroativamente as distribuições históricas ao item genérico', async () => {
    const [rows] = await conn.query(
      `SELECT i.nome_item, d.quantidade
         FROM \`distribuicao\` d
         JOIN \`item_doacao\` i ON i.id = d.item_id`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].nome_item).toBe(NOME_ITEM_GENERICO.ALIMENTOS);
    expect(Number(rows[0].quantidade)).toBe(5);
  });

  it('a tabela legada é preservada como estoque_legado (referência auditável)', async () => {
    const [rows] = await conn.query(
      `SELECT tipo_doacao, quantidade FROM \`estoque_legado\` ORDER BY tipo_doacao`,
    );
    expect(rows).toHaveLength(2);
  });
});
