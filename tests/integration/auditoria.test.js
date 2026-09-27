// auditoria.test.js — log de auditoria LGPD (§11.3): quem/quando/o quê em
// consultas e edições de beneficiários e doadores.
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { app } from '../../src/app.js';
import { resetDatabase, closeDatabase, pool } from '../helpers/db.js';
import { loginAgent } from '../helpers/auth.js';

let admin;
let colaborador;

beforeAll(async () => {
  await resetDatabase();
  admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
  colaborador = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');
});

afterAll(async () => {
  await closeDatabase();
});

describe('LGPD §11.3 — log de acesso a dados sensíveis', () => {
  it('consulta à lista de beneficiários gera registro de CONSULTA', async () => {
    const res = await colaborador.get('/beneficiarios');
    expect(res.status).toBe(200);

    const [[linha]] = await pool.query(
      `SELECT acao, entidade FROM audit_log
        WHERE entidade = 'beneficiario' AND acao = 'CONSULTA' ORDER BY id DESC LIMIT 1`,
    );
    expect(linha).toBeTruthy();
  });

  it('gravações registram quem (usuario_id), quando e o quê — sem payload sensível', async () => {
    const criar = await colaborador.post('/beneficiarios').type('form').send({
      nome: 'Beneficiária Auditada',
      cpf: '52998224725',
      data_nascimento: '1980-01-01',
      telefone: '',
      endereco: '',
      situacao_social: 'Informação sensível protegida',
    });
    expect(criar.status).toBe(302);

    const [[linha]] = await pool.query(
      `SELECT usuario_id, acao, entidade, detalhe, created_at FROM audit_log
        WHERE entidade = 'beneficiario' AND acao = 'CRIACAO' ORDER BY id DESC LIMIT 1`,
    );
    const [[colab]] = await pool.query(
      `SELECT id FROM usuario WHERE email = 'colaborador@conectabem.net'`,
    );
    expect(linha.usuario_id).toBe(colab.id);
    expect(linha.created_at).toBeTruthy();
    // O log não deve conter o payload sensível enviado no formulário (LGPD).
    expect(linha.detalhe).not.toContain('Informação sensível protegida');
    expect(linha.detalhe).not.toContain('52998224725');
  });

  it('edição de beneficiário gera registro de EDICAO com o id da entidade', async () => {
    const [[b]] = await pool.query(
      `SELECT id FROM beneficiario WHERE cpf = '52998224725' LIMIT 1`,
    );
    const res = await admin.put(`/beneficiarios/${b.id}`).type('form').send({
      nome: 'Beneficiária Auditada Silva',
      cpf: '52998224725',
      data_nascimento: '1980-01-01',
      telefone: '',
      endereco: 'Rua A, 123',
      situacao_social: 'Atualizado',
    });
    expect(res.status).toBe(302);

    const [[linha]] = await pool.query(
      `SELECT acao, entidade, entidade_id FROM audit_log
        WHERE entidade = 'beneficiario' AND acao = 'EDICAO' ORDER BY id DESC LIMIT 1`,
    );
    expect(linha.entidade_id).toBe(b.id);
  });

  it('colaborador sem permissão (403) NÃO gera registro de edição em doadores', async () => {
    // Cria via colaborador (permitido) e tenta editar (proibido).
    const criar = await colaborador.post('/doadores').type('form').send({
      tipo_doador: 'PF',
      nome: 'Doador Auditado',
      documento: '39053344705',
    });
    expect(criar.status).toBe(302);

    const [[d]] = await pool.query(`SELECT id FROM doador WHERE documento = '39053344705'`);
    const proibido = await colaborador
      .put(`/doadores/${d.id}`)
      .type('form')
      .send({ tipo_doador: 'PF', nome: 'X', documento: '39053344705' });
    expect(proibido.status).toBe(403);

    const [edicaoDoador] = await pool.query(
      `SELECT id FROM audit_log WHERE entidade = 'doador' AND acao = 'EDICAO' AND entidade_id = ?`,
      [d.id],
    );
    expect(edicaoDoador).toHaveLength(0);
  });

  it('cadastro de doador pelo colaborador (permitido) é auditado como CRIACAO', async () => {
    const [criacao] = await pool.query(
      `SELECT id FROM audit_log WHERE entidade = 'doador' AND acao = 'CRIACAO'`,
    );
    expect(criacao.length).toBeGreaterThanOrEqual(1);
  });
});
