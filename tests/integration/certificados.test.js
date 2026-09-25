import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { app } from '../../src/app.js';
import { resetDatabase, closeDatabase, pool } from '../helpers/db.js';
import { loginAgent } from '../helpers/auth.js';
import {
  criarCurso,
  criarTurma,
  criarBeneficiario,
  criarMatricula,
  registrarFrequenciaDireta,
} from '../helpers/cursos.js';

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

async function certificadoDaMatricula(matriculaId) {
  const [rows] = await pool.query(
    'SELECT id, codigo_validacao FROM certificado WHERE matricula_id = ?',
    [matriculaId],
  );
  return rows[0] || null;
}

describe('Certificados — RF_35 / UC13 (mínimo 75% de frequência)', () => {
  it('COLABORADOR recebe 403 em GET e POST de certificados (§13.3)', async () => {
    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');
    expect((await colab.get('/certificados')).status).toBe(403);
    expect(
      (await colab.post('/certificados').type('form').send({ matricula_id: '1', turma_id: '1' }))
        .status,
    ).toBe(403);
  });

  it('UC13: aluno sem frequência mínima NÃO recebe certificado', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    const cursoId = await criarCurso({ nome: 'Curso Elegibilidade' });
    const turmaId = await criarTurma(cursoId, { status: 'ENCERRADA' });
    const beneficiarioId = await criarBeneficiario('Aluno Irregular');
    const matriculaId = await criarMatricula(turmaId, beneficiarioId);

    // 2 presenças em 4 aulas = 50% < 75%.
    await registrarFrequenciaDireta(matriculaId, '2026-09-01', true);
    await registrarFrequenciaDireta(matriculaId, '2026-09-03', true);
    await registrarFrequenciaDireta(matriculaId, '2026-09-08', false);
    await registrarFrequenciaDireta(matriculaId, '2026-09-10', false);

    const res = await admin
      .post('/certificados')
      .type('form')
      .send({ matricula_id: String(matriculaId), turma_id: String(turmaId) });
    expect(res.status).toBe(302); // PRG: volta para a lista com flash de erro

    expect(await certificadoDaMatricula(matriculaId)).toBeNull();
    expect((await statusMatriculaDb(matriculaId))).toBe('ATIVA'); // não concluiu

    // A listagem exibe o aluno como "Não apto".
    const lista = await admin.get(`/certificados/turmas/${turmaId}`);
    expect(lista.text).toContain('Não apto');
  });

  it('UC13: aluno apto (75%) recebe certificado com código de validação único', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    const cursoId = await criarCurso({ nome: 'Curso Aprovados' });
    const turmaId = await criarTurma(cursoId, { status: 'ENCERRADA' });

    const ids = [];
    for (const nome of ['Aluna Aprovada Um', 'Aluna Aprovada Dois']) {
      const beneficiarioId = await criarBeneficiario(nome);
      const matriculaId = await criarMatricula(turmaId, beneficiarioId);
      // 3 presenças em 4 aulas = 75% exatos → apto.
      await registrarFrequenciaDireta(matriculaId, '2026-09-01', true);
      await registrarFrequenciaDireta(matriculaId, '2026-09-03', true);
      await registrarFrequenciaDireta(matriculaId, '2026-09-08', true);
      await registrarFrequenciaDireta(matriculaId, '2026-09-10', false);
      ids.push(matriculaId);
    }

    const codigos = new Set();
    for (const matriculaId of ids) {
      const res = await admin
        .post('/certificados')
        .type('form')
        .send({ matricula_id: String(matriculaId), turma_id: String(turmaId) });
      expect(res.status).toBe(302);

      const cert = await certificadoDaMatricula(matriculaId);
      expect(cert).not.toBeNull();
      expect(cert.codigo_validacao).toMatch(/^CB-/);
      codigos.add(cert.codigo_validacao);

      // A matrícula passa a CONCLUIDA.
      expect(await statusMatriculaDb(matriculaId)).toBe('CONCLUIDA');
    }
    // RF_35: códigos de validação são únicos.
    expect(codigos.size).toBe(ids.length);

    // Emissão duplicada é bloqueada.
    await admin
      .post('/certificados')
      .type('form')
      .send({ matricula_id: String(ids[0]), turma_id: String(turmaId) });
    const [count] = await pool.query('SELECT COUNT(*) AS total FROM certificado WHERE matricula_id = ?', [ids[0]]);
    expect(count[0].total).toBe(1);

    // A tela da turma exibe os códigos emitidos.
    const lista = await admin.get(`/certificados/turmas/${turmaId}`);
    for (const codigo of codigos) {
      expect(lista.text).toContain(codigo);
    }
  });

  it('não emite certificado com turma ainda não encerrada', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    const cursoId = await criarCurso({ nome: 'Curso Em Andamento' });
    const turmaId = await criarTurma(cursoId, { status: 'ATIVA' });
    const beneficiarioId = await criarBeneficiario('Aluno Em Andamento');
    const matriculaId = await criarMatricula(turmaId, beneficiarioId);
    await registrarFrequenciaDireta(matriculaId, '2026-09-01', true);

    await admin
      .post('/certificados')
      .type('form')
      .send({ matricula_id: String(matriculaId), turma_id: String(turmaId) });

    expect(await certificadoDaMatricula(matriculaId)).toBeNull();
  });
});

async function statusMatriculaDb(id) {
  const [rows] = await pool.query('SELECT status FROM matricula WHERE id = ?', [id]);
  return rows[0]?.status;
}
