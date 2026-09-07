import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { app } from '../../src/app.js';
import { resetDatabase, closeDatabase } from '../helpers/db.js';
import { loginAgent } from '../helpers/auth.js';

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe('UC02 / matriz §12.2 — Gestão de usuários (ADMINISTRADOR-only)', () => {
  it('administrador lista usuários', async () => {
    const agent = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    const res = await agent.get('/usuarios');
    expect(res.status).toBe(200);
    expect(res.text).toContain('colaborador@conectabem.net');
  });

  it('administrador cria um colaborador', async () => {
    const agent = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    const res = await agent.post('/usuarios').type('form').send({
      nome: 'Novo Colab',
      email: 'novo@conectabem.net',
      senha: 'senha1234',
      perfil: 'COLABORADOR',
    });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/usuarios');

    const lista = await agent.get('/usuarios');
    expect(lista.text).toContain('novo@conectabem.net');
  });

  it('administrador não cria usuário com e-mail duplicado (400, sem erro de banco)', async () => {
    const agent = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    const res = await agent.post('/usuarios').type('form').send({
      nome: 'Duplicado',
      email: 'admin@conectabem.net',
      senha: 'senha1234',
      perfil: 'COLABORADOR',
    });
    expect(res.status).toBe(400);
    expect(res.text).toContain('Já existe um usuário com este e-mail.');
  });

  it('COLABORADOR recebe 403 ao acessar gestão de usuários', async () => {
    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');
    const res = await colab.get('/usuarios');
    expect(res.status).toBe(403);
  });

  it('COLABORADOR recebe 403 ao tentar criar usuário', async () => {
    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');
    const res = await colab.post('/usuarios').type('form').send({
      nome: 'Invasor',
      email: 'invasor@conectabem.net',
      senha: 'senha1234',
      perfil: 'ADMINISTRADOR',
    });
    expect(res.status).toBe(403);
  });
});