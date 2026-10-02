// seed.js — dados iniciais (idempotente): apenas o usuário administrador.
//
// O usuário admin usa a tabela `usuario` real (002_usuario.sql) com senha
// hasheada em bcrypt custo 12 (RNF_02).
//
// Sprint 8: o seed NÃO cria mais itens de doação ("Outros [tipo]") nem linhas
// de estoque — desde a Sprint 7 os itens nascem sob demanda no formulário de
// registro de doação, em uma única transação (ver docs/decisoes.md, nº 44).
//
// Variáveis de ambiente: ADMIN_PASSWORD (senha), ADMIN_EMAIL (default admin@conectabem.net).
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';

dotenv.config();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@conectabem.net';
const ADMIN_NAME = process.env.ADMIN_NAME || 'Administrador';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

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
  await seedAdmin();
  await pool.end();
}

run().catch((err) => {
  console.error('[seed] erro:', err);
  process.exit(1);
});
