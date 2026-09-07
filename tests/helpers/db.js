// tests/helpers/db.js — prepara o banco de teste para os testes de integração.
// Executa as migrations (idempotentes) e limpa/reseeda as tabelas de negócio,
// criando usuários de teste com senha conhecida (admin123 / colab123).
import bcrypt from 'bcryptjs';
import { pool } from '../../src/config/db.js';
import { sessionStore } from '../../src/config/session.js';
import { runMigrations } from '../../migrations/migrate.js';

const TABELAS_NEGOCIO = [
  'distribuicao',
  'doacao',
  'estoque',
  'atendimento',
  'doador',
  'beneficiario',
  'usuario',
];

async function seedEstoque() {
  await pool.query(
    `INSERT INTO \`estoque\` (\`tipo_doacao\`, \`quantidade\`, \`estoque_minimo\`) VALUES
      ('ALIMENTOS', 0, 0),
      ('ROUPAS', 0, 0),
      ('MOVEIS_UTENSILIOS', 0, 0),
      ('OUTROS', 0, 0)`,
  );
}

async function seedUsuarios() {
  const adminHash = await bcrypt.hash('admin123', 12);
  await pool.query(
    'INSERT INTO `usuario` (`nome`, `email`, `senha_hash`, `perfil`, `ativo`) VALUES (?, ?, ?, ?, 1)',
    ['Admin Teste', 'admin@conectabem.net', adminHash, 'ADMINISTRADOR'],
  );

  const colabHash = await bcrypt.hash('colab123', 12);
  await pool.query(
    'INSERT INTO `usuario` (`nome`, `email`, `senha_hash`, `perfil`, `ativo`) VALUES (?, ?, ?, ?, 1)',
    ['Colaborador Teste', 'colaborador@conectabem.net', colabHash, 'COLABORADOR'],
  );
}

async function resetDatabase() {
  await runMigrations(pool);

  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const tabela of TABELAS_NEGOCIO) {
    await pool.query(`TRUNCATE TABLE \`${tabela}\``);
  }
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');

  await seedEstoque();
  await seedUsuarios();
}

/** Encerra conexões (pool de dados e store de sessão) e permite o processo sair. */
async function closeDatabase() {
  try {
    await pool.end();
  } catch {
    /* ignorar */
  }
  try {
    await sessionStore.close();
  } catch {
    /* ignorar */
  }
}

export { resetDatabase, closeDatabase, pool };