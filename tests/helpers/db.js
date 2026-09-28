// tests/helpers/db.js — prepara o banco de teste para os testes de integração.
// Executa as migrations (idempotentes) e limpa/reseeda as tabelas de negócio,
// criando usuários de teste com senha conhecida (admin123 / colab123) e, por
// tipo de doação, o item genérico com linha de estoque zerada (Sprint 6).
import bcrypt from 'bcryptjs';
import { pool } from '../../src/config/db.js';
import { sessionStore } from '../../src/config/session.js';
import { runMigrations } from '../../migrations/migrate.js';
import { TIPOS_DOACAO, NOME_ITEM_GENERICO } from '../../src/utils/tiposDoacao.js';

const TABELAS_NEGOCIO = [
  'audit_log',
  'password_reset',
  'certificado',
  'frequencia',
  'matricula',
  'turma',
  'curso',
  'distribuicao',
  'doacao',
  'estoque',
  'item_doacao',
  'estoque_legado',
  'atendimento',
  'campanha_voluntario',
  'campanha',
  'voluntario',
  'doador',
  'beneficiario',
  'usuario',
];

/** Semeia o item genérico por tipo + linha de estoque zerada. Retorna id por tipo. */
async function seedEstoque() {
  const idsPorTipo = {};
  for (const tipo of TIPOS_DOACAO) {
    const [r] = await pool.query(
      'INSERT INTO `item_doacao` (`nome_item`, `tipo_doacao`, `unidade`) VALUES (?, ?, ?)',
      [NOME_ITEM_GENERICO[tipo], tipo, 'UN'],
    );
    await pool.query(
      'INSERT INTO `estoque` (`item_id`, `quantidade`, `estoque_minimo`) VALUES (?, 0, 0)',
      [r.insertId],
    );
    idsPorTipo[tipo] = r.insertId;
  }
  return idsPorTipo;
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
  await runMigrations();

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