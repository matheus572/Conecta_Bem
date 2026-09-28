// doacao-criacao-item.test.js — Sprint 7: concorrência na CRIAÇÃO automática
// de item (duas doações simultâneas do mesmo nome novo) e rollback integral
// (falha na doação não pode deixar item nem estoque órfãos).
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { app } from '../../src/app.js';
import { resetDatabase, closeDatabase, pool } from '../helpers/db.js';
import { loginAgent } from '../helpers/auth.js';

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

let seq = 0;
async function criarDoador() {
  seq += 1;
  const [r] = await pool.query(
    'INSERT INTO doador (nome, tipo_doador, documento) VALUES (?, ?, ?)',
    ['Doador Teste', 'PF', String(72000000000000 + seq)],
  );
  return r.insertId;
}

describe('Sprint 7 — criação automática de item: concorrência e rollback', () => {
  it('duas doações simultâneas com o mesmo nome novo criam UM item e somam os saldos', async () => {
    const [doadorA, doadorB] = await Promise.all([criarDoador(), criarDoador()]);

    const agentes = await Promise.all([
      loginAgent(app, 'admin@conectabem.net', 'admin123'),
      loginAgent(app, 'colaborador@conectabem.net', 'colab123'),
    ]);

    const resultados = await Promise.all([
      agentes[0].post('/doacoes').type('form').send({
        doador_id: String(doadorA),
        nome_item: 'Cesta básica grande',
        tipo_doacao: 'ALIMENTOS',
        unidade: 'CX',
        quantidade: '6',
      }),
      agentes[1].post('/doacoes').type('form').send({
        doador_id: String(doadorB),
        nome_item: 'Cesta básica grande',
        tipo_doacao: 'ALIMENTOS',
        unidade: 'CX',
        quantidade: '6',
      }),
    ]);

    // Nenhuma pode ter erro 500 nem erro de duplicidade — ER_DUP_ENTRY é
    // tratado com re-busca (leitura atual FOR UPDATE) no item vencedor.
    expect(resultados.map((r) => r.status).sort()).toEqual([302, 302]);

    const [itens] = await pool.query(
      "SELECT id FROM item_doacao WHERE nome_item = 'Cesta básica grande'",
    );
    expect(itens).toHaveLength(1);

    const [estoque] = await pool.query('SELECT quantidade FROM estoque WHERE item_id = ?', [
      itens[0].id,
    ]);
    expect(estoque).toHaveLength(1);
    expect(Number(estoque[0].quantidade)).toBe(12);
  });

  it('falha na inserção da doação faz rollback: não sobra item nem linha de estoque', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    const doadorId = await criarDoador();
    const descricaoInvalida = 'x'.repeat(300); // doacao.descricao é VARCHAR(255)

    const res = await admin.post('/doacoes').type('form').send({
      doador_id: String(doadorId),
      nome_item: 'Item que vira órfão se não houver transação',
      tipo_doacao: 'ALIMENTOS',
      quantidade: '1',
      descricao: descricaoInvalida,
    });
    expect(res.status).toBe(400);

    const [itens] = await pool.query(
      "SELECT id FROM item_doacao WHERE nome_item = 'Item que vira órfão se não houver transação'",
    );
    expect(itens).toHaveLength(0);

    // Nenhum saldo órfão resta.
    const [orfao] = await pool.query(
      `SELECT e.id FROM estoque e
         LEFT JOIN item_doacao i ON i.id = e.item_id
        WHERE i.id IS NULL`,
    );
    expect(orfao).toHaveLength(0);
  });

  it('COLABORADOR cria item via doação, mas recebe 403 ao editar/desativar item', async () => {
    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');
    const doadorId = await criarDoador();

    const criar = await colab.post('/doacoes').type('form').send({
      doador_id: String(doadorId),
      nome_item: 'Item criado por colaborador',
      tipo_doacao: 'OUTROS',
      quantidade: '2',
    });
    expect(criar.status).toBe(302);

    const [[item]] = await pool.query(
      "SELECT id FROM item_doacao WHERE nome_item = 'Item criado por colaborador'",
    );
    expect(item).toBeTruthy();

    // Gestão do catálogo continua restrita ao ADMINISTRADOR.
    const editar = await colab.get(`/estoque/itens/${item.id}/editar`);
    expect(editar.status).toBe(403);
    const salvar = await colab.put(`/estoque/itens/${item.id}`).type('form').send({
      nome_item: 'Outro nome',
      unidade: 'UN',
    });
    expect(salvar.status).toBe(403);
    const desativar = await colab.put(`/estoque/itens/${item.id}/ativo`).type('form').send({ ativo: '0' });
    expect(desativar.status).toBe(403);
  });

  it('o formulário de distribuição continua com <select> (sem criação de item)', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    const form = await admin.get('/doacoes/distribuicoes/nova');
    expect(form.status).toBe(200);
    expect(form.text).toContain('name="item_id"');
    expect(form.text).not.toContain('name="nome_item"');

    // POST de distribuição aceita apenas item_id.
    const beneficiario = await pool.query(
      "INSERT INTO beneficiario (nome, cpf) VALUES ('B Teste Dist', '73000000001')",
    );
    const res = await admin.post('/doacoes/distribuicoes').type('form').send({
      beneficiario_id: String(beneficiario[0].insertId),
      nome_item: 'Item inexistente que não deve ser criado',
      quantidade: '1',
    });
    expect(res.status).toBe(400);
    const [itens] = await pool.query(
      "SELECT id FROM item_doacao WHERE nome_item = 'Item inexistente que não deve ser criado'",
    );
    expect(itens).toHaveLength(0);
  });
});
