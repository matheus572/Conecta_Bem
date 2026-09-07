// seed.js — dados iniciais (idempotente): usuário administrador e estoque por
// tipo de doação.
//
// O usuário admin usa a tabela `usuario` real (002_usuario.sql) com senha
// hasheada em bcrypt custo 12 (RNF_02). O estoque (007_estoque.sql) recebe uma
// linha por tipo com saldo zero, garantindo que a tela de estoque exiba os 4
// tipos e que a distribuição encontre registro para `SELECT ... FOR UPDATE`.
//
// Variáveis de ambiente: ADMIN_PASSWORD (senha), ADMIN_EMAIL (default admin@conectabem.net).
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';

dotenv.config();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@conectabem.net';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrador';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const TIPOS_ESTOQUE = ['ALIMENTOS', 'ROUPAS', 'MOVEIS_UTENSILIOS', 'OUTROS'];

async function seedEstoque() {
  for (const tipo of TIPOS_ESTOQUE) {
    await pool.query(
      'INSERT IGNORE INTO `estoque` (`tipo_doacao`, `quantidade`, `estoque_minimo`) VALUES (?, 0, 0)',
      [tipo],
    );
  }
}

async function seedAdmin() {
  if (!ADMIN_PASSWORD) {
    console.warn('[seed] ADMIN_PASSWORD não definida; usuário admin NÃO será criado.');
    return;
  }

  const [rows] = await pool.query('SELECT `id` FROM `usuario` WHERE `email` = ?', [ADMIN_EMAIL]);

  if (rows.length > 0) {
    console.log(`[seed] usuário admin já existe (${ADMIN_EMAIL}); nada a fazer.`);
    return;
  }

  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await pool.query(
    'INSERT INTO `usuario` (`nome`, `email`, `senha_hash`, `perfil`, `ativo`) VALUES (?, ?, ?, ?, 1)',
    [ADMIN_NAME, ADMIN_EMAIL, hash, 'ADMINISTRADOR'],
  );

  console.log(`[seed] usuário administrador criado: ${ADMIN_EMAIL}`);
}

async function run() {
  await seedEstoque();
  await seedAdmin();
  await pool.end();
}

run().catch((err) => {
  console.error('[seed] erro:', err);
  process.exit(1);
});