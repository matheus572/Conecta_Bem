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

const doadorPf = {
  nome: 'João Doador',
  tipo_doador: 'PF',
  documento: '529.982.247-25',
  telefone: '(18) 99999-0000',
  endereco: 'Rua B, 2',
};

async function idDoadorPorDocumento(documento) {
  const [rows] = await pool.query('SELECT id FROM doador WHERE documento = ?', [documento]);
  return rows[0]?.id;
}

describe('Doadores — regra intermediária de permissão (RF_09–12, §12.2)', () => {
  it('COLABORADOR cadastra e consulta doador', async () => {
    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');

    const res = await colab.post('/doadores').type('form').send(doadorPf);
    expect(res.status).toBe(302);

    const lista = await colab.get('/doadores');
    expect(lista.status).toBe(200);
    expect(lista.text).toContain('João Doador');
  });

  it('COLABORADOR recebe 403 ao editar doador (PUT)', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    await admin.post('/doadores').type('form').send(doadorPf);
    const id = await idDoadorPorDocumento('52998224725');

    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');
    const res = await colab
      .put(`/doadores/${id}`)
      .type('form')
      .send({ ...doadorPf, nome: 'Alterado pelo colaborador' });
    expect(res.status).toBe(403);
  });

  it('COLABORADOR recebe 403 ao excluir doador (DELETE)', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    await admin.post('/doadores').type('form').send(doadorPf);
    const id = await idDoadorPorDocumento('52998224725');

    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');
    const res = await colab.delete(`/doadores/${id}`);
    expect(res.status).toBe(403);
  });

  it('ADMINISTRADOR edita doador (PUT)', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    await admin.post('/doadores').type('form').send(doadorPf);
    const id = await idDoadorPorDocumento('52998224725');

    const res = await admin
      .put(`/doadores/${id}`)
      .type('form')
      .send({ ...doadorPf, nome: 'João Atualizado' });
    expect(res.status).toBe(302);

    const lista = await admin.get('/doadores');
    expect(lista.text).toContain('João Atualizado');
  });

  it('rejeita documento duplicado com mensagem amigável', async () => {
    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');
    await colab.post('/doadores').type('form').send(doadorPf);

    const res = await colab.post('/doadores').type('form').send({
      ...doadorPf,
      nome: 'Outro Doador',
    });
    expect(res.status).toBe(400);
    expect(res.text).toContain('Já existe um doador com este CPF/CNPJ.');
  });
});