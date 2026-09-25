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

const curso = {
  nome: 'Informática Básica',
  descricao: 'Noções de computador',
  carga_horaria: '40',
  quantidade_vagas: '20',
  status: 'ATIVO',
};

describe('Cursos/Turmas — matriz §12.2 (RF_30, RF_31, RF_36)', () => {
  it('COLABORADOR consulta cursos (GET → 200)', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    await admin.post('/cursos').type('form').send(curso);

    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');
    const res = await colab.get('/cursos');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Informática Básica');
  });

  it('COLABORADOR consulta detalhe de curso e de turma (GET → 200)', async () => {
    const cursoId = await criarCurso({ nome: 'Corte e Costura' });
    const turmaId = await criarTurma(cursoId);

    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');
    expect((await colab.get(`/cursos/${cursoId}`)).status).toBe(200);
    const res = await colab.get(`/cursos/turmas/${turmaId}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Corte e Costura');
  });

  it('COLABORADOR recebe 403 em POST/PUT/DELETE de cursos', async () => {
    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');
    const cursoId = await criarCurso({ nome: 'Curso 403' });

    expect((await colab.post('/cursos').type('form').send(curso)).status).toBe(403);
    expect((await colab.put(`/cursos/${cursoId}`).type('form').send(curso)).status).toBe(403);
    expect((await colab.delete(`/cursos/${cursoId}`)).status).toBe(403);
    expect((await colab.get('/cursos/novo')).status).toBe(403);
  });

  it('COLABORADOR recebe 403 em POST/PUT/DELETE de turmas', async () => {
    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');
    const cursoId = await criarCurso({ nome: 'Curso Turmas 403' });
    const turmaId = await criarTurma(cursoId);
    const turma = {
      periodo: '01/10 a 30/11/2026',
      horario: '9h às 11h',
      dias_semana: 'terças',
      capacidade: '10',
      status: 'ATIVA',
    };

    expect((await colab.post(`/cursos/${cursoId}/turmas`).type('form').send(turma)).status).toBe(403);
    expect((await colab.put(`/cursos/turmas/${turmaId}`).type('form').send(turma)).status).toBe(403);
    expect((await colab.delete(`/cursos/turmas/${turmaId}`)).status).toBe(403);
  });

  it('ADMINISTRADOR tem acesso total a cursos e turmas', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');

    const criar = await admin.post('/cursos').type('form').send(curso);
    expect(criar.status).toBe(302);
    const cursoId = Number(criar.headers.location.split('/').pop());

    const turma = {
      periodo: '01/09 a 15/12/2026',
      horario: '14h às 16h',
      dias_semana: 'segundas e quartas',
      capacidade: '5',
      status: 'ATIVA',
    };
    const criarTurmaRes = await admin.post(`/cursos/${cursoId}/turmas`).type('form').send(turma);
    expect(criarTurmaRes.status).toBe(302);
    const turmaId = Number(criarTurmaRes.headers.location.split('/').pop());

    expect(
      (await admin.put(`/cursos/turmas/${turmaId}`).type('form').send({ ...turma, capacidade: '6' }))
        .status,
    ).toBe(302);
    expect((await admin.put(`/cursos/${cursoId}`).type('form').send({ ...curso, nome: 'Informática Avançada' })).status).toBe(302);
    expect((await admin.delete(`/cursos/turmas/${turmaId}`)).status).toBe(302);
    expect((await admin.delete(`/cursos/${cursoId}`)).status).toBe(302);
  });

  it('não exclui curso com turmas vinculadas (mensagem clara)', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    const cursoId = await criarCurso({ nome: 'Curso Com Turma' });
    await criarTurma(cursoId);

    await admin.delete(`/cursos/${cursoId}`);
    const res = await admin.get('/cursos');
    expect(res.text).toContain('possui turmas vinculadas');
  });
});
