import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { resetDatabase, closeDatabase } from '../helpers/db.js';
import { loginAgent } from '../helpers/auth.js';

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe('UC01 — Realizar Login', () => {
  it('login com credenciais válidas cria sessão e redireciona', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/login').type('form').send({
      email: 'admin@conectabem.net',
      senha: 'admin123',
    });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/');

    const home = await agent.get('/');
    expect(home.status).toBe(200);
    expect(home.text).toContain('Admin Teste');
  });

  it('login com credenciais inválidas retorna erro (401)', async () => {
    const res = await request(app).post('/login').type('form').send({
      email: 'admin@conectabem.net',
      senha: 'senha-errada',
    });
    expect(res.status).toBe(401);
    expect(res.text).toContain('E-mail ou senha inválidos');
  });

  it('rota protegida sem sessão redireciona para /login (RN05)', async () => {
    const res = await request(app).get('/beneficiarios');
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe('/login');
  });

  it('logout encerra a sessão', async () => {
    const agent = await loginAgent(app, 'admin@conectabem.net', 'admin123');

    const before = await agent.get('/');
    expect(before.status).toBe(200);

    await agent.post('/logout');

    const after = await agent.get('/');
    expect(after.status).toBe(302);
    expect(after.headers.location).toBe('/login');
  });

  it('recuperação de senha (RF_03) responde com stub "em breve"', async () => {
    const res = await request(app).get('/forgot-password');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/em breve|breve/i);
  });
});