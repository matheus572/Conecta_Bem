import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

vi.mock('../../src/modules/usuarios/usuarios.repository.js', () => ({
  findByEmail: vi.fn(),
  create: vi.fn(),
}));

import * as repository from '../../src/modules/usuarios/usuarios.repository.js';
import * as service from '../../src/modules/usuarios/usuarios.service.js';

const mockedFindByEmail = vi.mocked(repository.findByEmail);
const mockedCreate = vi.mocked(repository.create);

describe('usuarios.service — criar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreate.mockResolvedValue(1);
    mockedFindByEmail.mockResolvedValue(null);
  });

  it('rejeita e-mail duplicado (unicidade)', async () => {
    mockedFindByEmail.mockResolvedValue({ id: 99 });
    await expect(
      service.criar({
        nome: 'Fulano',
        email: 'fulano@conectabem.net',
        senha: 'senha1234',
        perfil: 'COLABORADOR',
      }),
    ).rejects.toThrow('Já existe um usuário com este e-mail.');
  });

  it('rejeita senha fraca', async () => {
    await expect(
      service.criar({
        nome: 'Fulano',
        email: 'fulano@conectabem.net',
        senha: 'curta',
        perfil: 'COLABORADOR',
      }),
    ).rejects.toThrow('A senha deve ter ao menos 8 caracteres');
  });

  it('rejeita perfil inválido', async () => {
    await expect(
      service.criar({ nome: 'Fulano', email: 'fulano@conectabem.net', senha: 'senha1234', perfil: 'X' }),
    ).rejects.toThrow('Perfil inválido.');
  });

  it('grava a senha como hash bcrypt (custo 12)', async () => {
    await service.criar({
      nome: 'Fulano',
      email: 'fulano@conectabem.net',
      senha: 'senha1234',
      perfil: 'COLABORADOR',
    });

    const chamada = mockedCreate.mock.calls[0][0];
    expect(chamada.senhaHash).toBeTruthy();
    expect(chamada.senhaHash).not.toContain('senha1234');
    expect(await bcrypt.compare('senha1234', chamada.senhaHash)).toBe(true);
  });
});