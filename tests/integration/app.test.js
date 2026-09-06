import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../src/app.js';

describe('GET /', () => {
  it('responde 200 com a página inicial', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('ConectaBem.net');
  });

  it('responde 404 em rota inexistente', async () => {
    const res = await request(app).get('/rota-inexistente');
    expect(res.status).toBe(404);
  });
});