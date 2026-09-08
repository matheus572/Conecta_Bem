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

const voluntario = {
  nome: 'Ana Voluntária',
  cpf: '529.982.247-25',
  telefone: '(18) 99999-1111',
  especialidade: 'Recreação',
  disponibilidade: 'Sábados pela manhã',
};

async function idPorCpf(tabela, cpf) {
  const [rows] = await pool.query(`SELECT id FROM ${tabela} WHERE cpf = ?`, [cpf]);
  return rows[0]?.id;
}

describe('Voluntários — matriz §12.2 (RF_18–21, RF_36)', () => {
  it('COLABORADOR consulta voluntários (GET → 200)', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    await admin.post('/voluntarios').type('form').send(voluntario);

    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');
    const res = await colab.get('/voluntarios');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Ana Voluntária');
  });

  it('COLABORADOR recebe 403 em POST /voluntarios', async () => {
    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');
    const res = await colab.post('/voluntarios').type('form').send(voluntario);
    expect(res.status).toBe(403);
  });

  it('COLABORADOR recebe 403 em PUT /voluntarios/:id', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    await admin.post('/voluntarios').type('form').send(voluntario);
    const id = await idPorCpf('voluntario', '52998224725');

    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');
    const res = await colab
      .put(`/voluntarios/${id}`)
      .type('form')
      .send({ ...voluntario, nome: 'Alterado' });
    expect(res.status).toBe(403);
  });

  it('COLABORADOR recebe 403 em DELETE /voluntarios/:id', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    await admin.post('/voluntarios').type('form').send(voluntario);
    const id = await idPorCpf('voluntario', '52998224725');

    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');
    const res = await colab.delete(`/voluntarios/${id}`);
    expect(res.status).toBe(403);
  });

  it('ADMINISTRADOR tem acesso total a voluntários (criar/editar/excluir)', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');

    const novo = { ...voluntario, cpf: '111.444.777-35', nome: 'Carlos Voluntário' };
    const criar = await admin.post('/voluntarios').type('form').send(novo);
    expect(criar.status).toBe(302);

    const id = await idPorCpf('voluntario', '11144477735');
    const editar = await admin
      .put(`/voluntarios/${id}`)
      .type('form')
      .send({ ...novo, nome: 'Carlos Editado' });
    expect(editar.status).toBe(302);

    const excluir = await admin.delete(`/voluntarios/${id}`);
    expect(excluir.status).toBe(302);
  });

  it('rejeita CPF duplicado com mensagem amigável', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    await admin.post('/voluntarios').type('form').send(voluntario);

    const res = await admin
      .post('/voluntarios')
      .type('form')
      .send({ ...voluntario, nome: 'Outro Voluntário' });
    expect(res.status).toBe(400);
    expect(res.text).toContain('Já existe um voluntário com este CPF.');
  });
});