// tests/helpers/db.js — prepara o banco de teste para os testes de integração.
// Executa as migrations (idempotentes) e limpa as tabelas de negócio, criando
// usuários de teste com senha conhecida (admin123 / colab123).
//
// Sprint 8: nenhum item de doação ou linha de estoque é semeado — os itens
// passam a nascer exclusivamente sob demanda no registro de doação (Sprint 7)
// ou, nos testes, via helper `criarItem`.
import bcrypt from 'bcryptjs';
import { pool } from '../../src/config/db.js';
import { sessionStore } from '../../src/config/session.js';
import { runMigrations } from '../../migrations/migrate.js';

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

/** Cria item + linha de estoque zerada (o caminho da UI é o formulário de doação). */
async function criarItem(nome, tipo = 'ALIMENTOS', unidade = 'UN') {
  const [r] = await pool.query(
    'INSERT INTO `item_doacao` (`nome_item`, `tipo_doacao`, `unidade`) VALUES (?, ?, ?)',
    [nome, tipo, unidade],
  );
  await pool.query('INSERT INTO `estoque` (`item_id`, `quantidade`, `estoque_minimo`) VALUES (?, 0, 0)', [
    r.insertId,
  ]);
  return r.insertId;
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

  await seedUsuarios();
}

/** Lê o saldo atual de um item (para assertions de RN03). */
async function saldoEstoque(itemId) {
  const [rows] = await pool.query('SELECT quantidade FROM estoque WHERE item_id = ?', [itemId]);
  return Number(rows[0]?.quantidade ?? 0);
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

export { resetDatabase, closeDatabase, criarItem, saldoEstoque, pool };
