// migrate.js — runner simples de migrations sem ORM.
//
// Lê os arquivos .sql numerados da pasta migrations/ em ordem e aplica apenas
// os pendentes, registrando cada um na tabela `_migrations` (001_init.sql).
//
// Uso (CLI): node migrations/migrate.js
// Uso (programático): import { runMigrations } from './migrate.js';
//   await runMigrations(pool) — usado pelos testes de integração (db-test).
//
// O pool é usado conforme config/env.js; nos testes, o env é apontado para o
// banco de teste antes da importação.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MIGRATIONS_DIR = path.dirname(fileURLToPath(import.meta.url));

async function getAppliedMigrationNames(conn) {
  await conn.query(
    `CREATE TABLE IF NOT EXISTS \`_migrations\` (
      \`name\` VARCHAR(255) NOT NULL,
      \`applied_at\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (\`name\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  );
  const [rows] = await conn.query('SELECT `name` FROM `_migrations`');
  return new Set(rows.map((row) => row.name));
}

/** Aplica as migrations pendentes. Não encerra o pool (quem chama é dono dele). */
async function runMigrations(pool) {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+.*\.sql$/.test(f) && f !== '001_init.sql')
    .sort();

  const initFile = '001_init.sql';
  const orderedFiles = [initFile, ...files];

  const conn = await pool.getConnection();
  try {
    const applied = await getAppliedMigrationNames(conn);

    for (const file of orderedFiles) {
      if (applied.has(file)) {
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await conn.query(sql);
      await conn.query('INSERT INTO `_migrations` (`name`) VALUES (?)', [file]);
      console.log(`[migrate] aplicada: ${file}`);
    }
    console.log('[migrate] migrations em dia.');
  } finally {
    conn.release();
  }
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const { pool } = await import('../src/config/db.js');
  try {
    await runMigrations(pool);
    await pool.end();
  } catch (err) {
    console.error('[migrate] erro:', err);
    await pool.end();
    process.exit(1);
  }
}

export { runMigrations };