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

const dadosBeneficiario = {
  nome: 'Maria da Silva',
  cpf: '529.982.247-25',
  telefone: '(18) 99999-0000',
  endereco: 'Rua A, 1',
  situacao_social: 'Vulnerabilidade social',
};

describe('Beneficiários — CRUD e busca (RF_05–08, RN04)', () => {
  it('COLABORADOR cadastra e consulta beneficiário', async () => {
    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');

    const res = await colab.post('/beneficiarios').type('form').send(dadosBeneficiario);
    expect(res.status).toBe(302);

    const lista = await colab.get('/beneficiarios');
    expect(lista.status).toBe(200);
    expect(lista.text).toContain('Maria da Silva');
  });

  it('rejeita CPF duplicado com mensagem amigável (RN04)', async () => {
    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');
    await colab.post('/beneficiarios').type('form').send(dadosBeneficiario);

    const res = await colab.post('/beneficiarios').type('form').send({
      ...dadosBeneficiario,
      nome: 'Outra Pessoa',
    });
    expect(res.status).toBe(400);
    expect(res.text).toContain('Já existe um beneficiário com este CPF.');
  });

  it('rejeita CPF inválido (dígitos verificadores)', async () => {
    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');
    const res = await colab.post('/beneficiarios').type('form').send({
      ...dadosBeneficiario,
      cpf: '111.111.111-11',
    });
    expect(res.status).toBe(400);
    expect(res.text).toContain('CPF inválido');
  });

  it('busca por CPF (RF_08)', async () => {
    const colab = await loginAgent(app, 'colaborador@conectabem.net', 'colab123');
    await colab.post('/beneficiarios').type('form').send(dadosBeneficiario);

    const res = await colab.get('/beneficiarios?q=529.982.247-25');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Maria da Silva');
  });
});