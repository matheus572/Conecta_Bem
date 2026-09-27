import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';
import { resetDatabase, closeDatabase, pool } from '../helpers/db.js';
import { loginAgent } from '../helpers/auth.js';
import { outbox, limparOutbox } from '../../src/utils/mailer.js';

beforeAll(async () => {
  await resetDatabase();
  limparOutbox();
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

  it('recuperação de senha (RF_03) exibe formulário de e-mail', async () => {
    const res = await request(app).get('/forgot-password');
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Enviar link de recupera/i);
  });
});

describe('RF_03 — Fluxo completo de recuperação de senha', () => {
  const extrairToken = (html) => html.match(/reset-password\?token=([0-9a-f]{64})/)?.[1];

  it('resposta é neutra mesmo para e-mail não cadastrado (LGPD, §11.3)', async () => {
    limparOutbox();
    const res = await request(app)
      .post('/forgot-password')
      .type('form')
      .send({ email: 'naoexiste@conectabem.net' });

    expect(res.status).toBe(200);
    expect(res.text).toContain('Se o e-mail estiver cadastrado');
    expect(outbox).toHaveLength(0);
  });

  it('solicitar → receber token → redefinir → logar com a nova senha', async () => {
    limparOutbox();

    // 1. Solicita a recuperação para um e-mail cadastrado.
    const req1 = await request(app)
      .post('/forgot-password')
      .type('form')
      .send({ email: 'colaborador@conectabem.net' });
    expect(req1.status).toBe(200);
    expect(req1.text).toContain('Se o e-mail estiver cadastrado');
    expect(outbox).toHaveLength(1);
    expect(outbox[0].para).toBe('colaborador@conectabem.net');

    // 2. Extrai o token do e-mail; no banco deve existir apenas o hash.
    const token = extrairToken(outbox[0].html);
    expect(token).toBeTruthy();
    const [rows] = await pool.query(
      'SELECT `token_hash` FROM `password_reset` WHERE `used_at` IS NULL',
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).not.toBe(token);

    // 3. Link válido abre o formulário de redefinição.
    const formReset = await request(app).get(`/reset-password?token=${token}`);
    expect(formReset.status).toBe(200);
    expect(formReset.text).toContain('Redefinir senha');

    // 4. Redefine a senha.
    const redefinicao = await request(app).post('/reset-password').type('form').send({
      token,
      senha: 'novaSenha123',
      senha_confirmacao: 'novaSenha123',
    });
    expect(redefinicao.status).toBe(302);
    expect(redefinicao.headers.location).toBe('/login');

    // 5. Senha antiga não funciona mais; a nova autentica.
    const antiga = await request(app)
      .post('/login')
      .type('form')
      .send({ email: 'colaborador@conectabem.net', senha: 'colab123' });
    expect(antiga.status).toBe(401);

    const nova = await request(app)
      .post('/login')
      .type('form')
      .send({ email: 'colaborador@conectabem.net', senha: 'novaSenha123' });
    expect(nova.status).toBe(302);

    // 6. O token é de uso único.
    const reuso = await request(app).post('/reset-password').type('form').send({
      token,
      senha: 'outraSenha123',
      senha_confirmacao: 'outraSenha123',
    });
    expect(reuso.status).toBe(400);
    expect(reuso.text).toContain('inválido ou expirado');
  });

  it('token inexistente abre a tela de link inválido', async () => {
    const res = await request(app).get(`/reset-password?token=${'0'.repeat(64)}`);
    expect(res.status).toBe(400);
    expect(res.text).toContain('inválido ou expirado');
  });

  it('redefinição com senha fraca retorna mensagem de validação', async () => {
    limparOutbox();
    await request(app)
      .post('/forgot-password')
      .type('form')
      .send({ email: 'admin@conectabem.net' });
    const token = extrairToken(outbox[0].html);

    const res = await request(app).post('/reset-password').type('form').send({
      token,
      senha: '123',
      senha_confirmacao: '123',
    });
    expect(res.status).toBe(400);
    expect(res.text).toContain('8 caracteres');
  });
});