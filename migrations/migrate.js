// migrate.js — runner simples de migrations sem ORM.
//
// Lê os arquivos .sql numerados da pasta migrations/ em ordem e aplica apenas
// os pendentes, registrando cada um na tabela `_migrations` (001_init.sql).
//
// Uso: node migrations/migrate.js
// Variáveis de ambiente: ver config/env.js (DB_*).

const fs = require('node:fs');
const path = require('node:path');
const { pool } = require('../src/config/db');

const MIGRATIONS_DIR = __dirname;

async function getAppliedMigrationNames(conn) {
  // Garante que a tabela de controle exista antes de consultar (caso ela
  // própria ainda não tenha sido aplicada por outro caminho).
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

async function run() {
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d+.*\.sql$/.test(f) && f !== '001_init.sql')
    .sort();

  // 001_init.sql roda primeiro e sempre, pois cria a própria tabela de controle.
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
    await pool.end();
  }
}

run().catch((err) => {
  console.error('[migrate] erro:', err);
  process.exit(1);
});