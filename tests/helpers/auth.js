// tests/helpers/auth.js — helpers de autenticação para os testes de integração.
import request from 'supertest';

/** Cria um agente (superta) já autenticado com as credenciais informadas. */
async function loginAgent(app, email, senha) {
  const agent = request.agent(app);
  await agent.post('/login').type('form').send({ email, senha });
  return agent;
}

export { loginAgent };