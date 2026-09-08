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

const beneficiario = {
  nome: 'Maria Assistida',
  cpf: '111.444.777-35',
};

const campanha = {
  titulo: 'Campanha do Agasalho',
  descricao: 'Arrecadação de agasalhos',
  data_inicio: '2026-09-01',
  data_fim: '2026-09-30',
  status: 'ATIVA',
};

async function idPorCpf(tabela, cpf) {
  const [rows] = await pool.query(`SELECT id FROM ${tabela} WHERE cpf = ?`, [cpf]);
  return rows[0]?.id;
}

describe('Campanhas — matriz §12.2 (módulo admin-only)', () => {
  it('COLABORADOR não acessa nenhuma rota de gestão de /campanhas (403)', async () => {
    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');

    const rotas = [
      ['get', '/campanhas'],
      ['post', '/campanhas'],
      ['put', '/campanhas/1'],
      ['delete', '/campanhas/1'],
      ['get', '/campanhas/1/voluntarios'],
      ['post', '/campanhas/1/voluntarios'],
      ['get', '/campanhas/1/resultados'],
      ['post', '/campanhas/1/atendimentos'],
    ];

    for (const [method, url] of rotas) {
      const res = await colab[method](url).type('form').send(campanha);
      expect(res.status).toBe(403);
    }
  });

  it('rejeita data de término anterior à de início com mensagem amigável', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');
    const res = await admin
      .post('/campanhas')
      .type('form')
      .send({ ...campanha, data_inicio: '2026-09-30', data_fim: '2026-09-01' });
    expect(res.status).toBe(400);
    expect(res.text).toContain('A data de término deve ser igual ou posterior à data de início.');
  });
});

describe('UC11 ponta-a-ponta — campanha, voluntário e resultados', () => {
  it('cria campanha, associa voluntário, registra resultados e os consulta', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');

    await admin.post('/voluntarios').type('form').send(voluntario);
    await admin.post('/beneficiarios').type('form').send(beneficiario);

    const voluntarioId = await idPorCpf('voluntario', '52998224725');
    const beneficiarioId = await idPorCpf('beneficiario', '11144477735');
    expect(voluntarioId).toBeTruthy();
    expect(beneficiarioId).toBeTruthy();

    await pool.query("UPDATE estoque SET quantidade = 100 WHERE tipo_doacao = 'ALIMENTOS'");

    // 1. Criar campanha.
    const criarCampanha = await admin.post('/campanhas').type('form').send(campanha);
    expect(criarCampanha.status).toBe(302);
    const [camRow] = await pool.query('SELECT id FROM campanha WHERE titulo = ?', [campanha.titulo]);
    const campanhaId = camRow[0].id;

    // 2. Associar voluntário.
    const associar = await admin
      .post(`/campanhas/${campanhaId}/voluntarios`)
      .type('form')
      .send({ voluntario_id: voluntarioId });
    expect(associar.status).toBe(302);

    // 3. Registrar resultado: beneficiário atendido.
    const atendimento = await admin
      .post(`/campanhas/${campanhaId}/atendimentos`)
      .type('form')
      .send({ beneficiario_id: beneficiarioId, data_atendimento: '2026-09-15', descricao: 'Entrega de agasalho' });
    expect(atendimento.status).toBe(302);

    // 4. Registrar resultado: doação distribuída.
    const distribuicao = await admin
      .post(`/campanhas/${campanhaId}/distribuicoes`)
      .type('form')
      .send({
        beneficiario_id: beneficiarioId,
        tipo_doacao: 'ALIMENTOS',
        quantidade: '5',
        data_distribuicao: '2026-09-15',
      });
    expect(distribuicao.status).toBe(302);

    // 5. Consultar campanha e ver voluntário e resultado vinculados.
    const consulta = await admin.get(`/campanhas/${campanhaId}`);
    expect(consulta.status).toBe(200);
    expect(consulta.text).toContain('Ana Voluntária');
    expect(consulta.text).toContain('Maria Assistida');

    const [vinculos] = await pool.query(
      'SELECT COUNT(*) AS total FROM campanha_voluntario WHERE campanha_id = ?',
      [campanhaId],
    );
    expect(vinculos[0].total).toBe(1);

    const [dist] = await pool.query('SELECT campanha_id FROM distribuicao WHERE campanha_id = ?', [
      campanhaId,
    ]);
    expect(dist.length).toBe(1);
  });

  it('rejeita associação duplicada sem erro de banco não tratado', async () => {
    const admin = await loginAgent(app, 'admin@conectabem.net', 'admin123');

    await admin.post('/voluntarios').type('form').send(voluntario);
    const voluntarioId = await idPorCpf('voluntario', '52998224725');

    const criar = await admin.post('/campanhas').type('form').send(campanha);
    expect(criar.status).toBe(302);
    const [camRow] = await pool.query('SELECT id FROM campanha WHERE titulo = ?', [campanha.titulo]);
    const campanhaId = camRow[0].id;

    const primeira = await admin
      .post(`/campanhas/${campanhaId}/voluntarios`)
      .type('form')
      .send({ voluntario_id: voluntarioId });
    expect(primeira.status).toBe(302);

    const duplicada = await admin
      .post(`/campanhas/${campanhaId}/voluntarios`)
      .type('form')
      .send({ voluntario_id: voluntarioId });
    expect(duplicada.status).toBe(302);

    const [rows] = await pool.query(
      'SELECT COUNT(*) AS total FROM campanha_voluntario WHERE campanha_id = ? AND voluntario_id = ?',
      [campanhaId, voluntarioId],
    );
    expect(rows[0].total).toBe(1);
  });
});