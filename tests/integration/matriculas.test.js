import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { app } from '../../src/app.js';
import { resetDatabase, closeDatabase } from '../helpers/db.js';
import { loginAgent } from '../helpers/auth.js';
import {
  criarCurso,
  criarTurma,
  criarBeneficiario,
  statusMatricula,
  idMatricula,
} from '../helpers/cursos.js';

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe('Matrículas — RF_32 / RN02 e UC09 → UC10', () => {
  it('RN02: turma lotada rejeita nova matrícula com mensagem clara', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    const cursoId = await criarCurso({ nome: 'Turma Lotada' });
    const turmaId = await criarTurma(cursoId, { capacidade: 1 });
    const b1 = await criarBeneficiario('Aluno Um');
    const b2 = await criarBeneficiario('Aluno Dois');

    const primeira = await admin
      .post('/matriculas')
      .type('form')
      .send({ turma_id: String(turmaId), beneficiario_id: String(b1) });
    expect(primeira.status).toBe(302);

    const lotada = await admin
      .post('/matriculas')
      .type('form')
      .send({ turma_id: String(turmaId), beneficiario_id: String(b2) });
    expect(lotada.status).toBe(400);
    expect(lotada.text).toContain('Turma sem vagas disponíveis.');
  });

  it('COLABORADOR também realiza matrícula (RF_F06: X/X)', async () => {
    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');
    const cursoId = await criarCurso({ nome: 'Matrícula Colab' });
    const turmaId = await criarTurma(cursoId, { capacidade: 5 });
    const beneficiarioId = await criarBeneficiario('Aluno Colab');

    const res = await colab
      .post('/matriculas')
      .type('form')
      .send({ turma_id: String(turmaId), beneficiario_id: String(beneficiarioId) });
    expect(res.status).toBe(302);
  });

  it('Concorrência: duas matrículas simultâneas na última vaga — apenas UMA tem sucesso', async () => {
    const cursoId = await criarCurso({ nome: 'Concorrência' });
    const turmaId = await criarTurma(cursoId, { capacidade: 1 });
    const b1 = await criarBeneficiario('Concorrente A');
    const b2 = await criarBeneficiario('Concorrente B');

    const admin1 = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    const admin2 = await loginAgent(app, 'admin@conectabem.net', 'admin123');

    const [r1, r2] = await Promise.all([
      admin1.post('/matriculas').type('form').send({ turma_id: String(turmaId), beneficiario_id: String(b1) }),
      admin2.post('/matriculas').type('form').send({ turma_id: String(turmaId), beneficiario_id: String(b2) }),
    ]);

    const status = [r1.status, r2.status].sort();
    expect(status).toEqual([302, 400]); // uma matriculou (redirect), a outra falhou (RN02)
  });

  it('UC09 → UC10: matricular → 3 faltas consecutivas → cancelada e vaga liberada (RN01)', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    const cursoId = await criarCurso({ nome: 'Fluxo UC09-UC10' });
    const turmaId = await criarTurma(cursoId, { capacidade: 1 });
    const b1 = await criarBeneficiario('Aluno Faltoso');
    const b2 = await criarBeneficiario('Aluno da Vaga');

    // UC09: matrícula do primeiro aluno ocupa a única vaga.
    const matricula = await admin
      .post('/matriculas')
      .type('form')
      .send({ turma_id: String(turmaId), beneficiario_id: String(b1) });
    expect(matricula.status).toBe(302);

    // Segundo aluno não entra: turma lotada.
    const bloqueado = await admin
      .post('/matriculas')
      .type('form')
      .send({ turma_id: String(turmaId), beneficiario_id: String(b2) });
    expect(bloqueado.status).toBe(400);

    // UC10: 3 aulas sem marcar presença (todos os ativos recebem falta).
    for (const data of ['2026-09-01', '2026-09-03', '2026-09-08']) {
      const res = await admin
        .post(`/frequencia/turmas/${turmaId}`)
        .type('form')
        .send({ data_aula: data });
      expect(res.status).toBe(302);
    }

    // RN01: matrícula cancelada automaticamente após a 3ª falta consecutiva…
    expect(await statusMatricula(await idMatricula(turmaId, b1))).toBe('CANCELADA');

    // …e a vaga foi liberada: o segundo aluno agora consegue se matricular.
    const liberado = await admin
      .post('/matriculas')
      .type('form')
      .send({ turma_id: String(turmaId), beneficiario_id: String(b2) });
    expect(liberado.status).toBe(302);
  });

  it('RN01: sequência falta-presença-falta NÃO cancela a matrícula', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    const cursoId = await criarCurso({ nome: 'Sequência Quebrada' });
    const turmaId = await criarTurma(cursoId, { capacidade: 2 });
    const beneficiarioId = await criarBeneficiario('Aluno Intercalado');

    await admin
      .post('/matriculas')
      .type('form')
      .send({ turma_id: String(turmaId), beneficiario_id: String(beneficiarioId) });
    const matriculaId = await idMatricula(turmaId, beneficiarioId);

    // falta, presença, falta, falta → nunca 3 consecutivas.
    await admin.post(`/frequencia/turmas/${turmaId}`).type('form').send({ data_aula: '2026-09-01' });
    await admin
      .post(`/frequencia/turmas/${turmaId}`)
      .type('form')
      .send({ data_aula: '2026-09-03', presentes: [String(matriculaId)] });
    await admin.post(`/frequencia/turmas/${turmaId}`).type('form').send({ data_aula: '2026-09-08' });
    await admin.post(`/frequencia/turmas/${turmaId}`).type('form').send({ data_aula: '2026-09-10' });

    expect(await statusMatricula(matriculaId)).toBe('ATIVA');
  });
});
