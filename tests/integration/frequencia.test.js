import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { app } from '../../src/app.js';
import { resetDatabase, closeDatabase } from '../helpers/db.js';
import { loginAgent } from '../helpers/auth.js';
import { criarCurso, criarTurma } from '../helpers/cursos.js';

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe('Frequência — matriz §12.2 (RF_F07: X apenas para ADMINISTRADOR)', () => {
  it('COLABORADOR recebe 403 ao abrir a tela de frequência', async () => {
    const cursoId = await criarCurso({ nome: 'Frequência 403' });
    const turmaId = await criarTurma(cursoId);

    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');
    const res = await colab.get(`/frequencia/turmas/${turmaId}`);
    expect(res.status).toBe(403);
  });

  it('COLABORADOR recebe 403 ao registrar frequência (POST)', async () => {
    const cursoId = await criarCurso({ nome: 'Frequência 403 POST' });
    const turmaId = await criarTurma(cursoId);

    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');
    const res = await colab
      .post(`/frequencia/turmas/${turmaId}`)
      .type('form')
      .send({ data_aula: '2026-09-01' });
    expect(res.status).toBe(403);
  });

  it('ADMINISTRADOR acessa a tela de lançamento (GET → 200)', async () => {
    const cursoId = await criarCurso({ nome: 'Frequência Admin' });
    const turmaId = await criarTurma(cursoId);

    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    const res = await admin.get(`/frequencia/turmas/${turmaId}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Lançar frequência');
  });
});
