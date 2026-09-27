// auth.reset.test.js — testes unitários do token de recuperação de senha
// (RF_03): formato, hash e expiração. Sem banco (funções puras do service).
import { describe, it, expect } from 'vitest';
import {
  gerarTokenReset,
  sha256Hash,
  tokenExpirado,
  TOKEN_TTL_MINUTOS,
} from '../../src/modules/auth/auth.service.js';

describe('recuperação de senha (RF_03) — token', () => {
  it('gera token aleatório de 64 caracteres hexadecimais', () => {
    const { token } = gerarTokenReset();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('tokens gerados em sequência são distintos', () => {
    const a = gerarTokenReset();
    const b = gerarTokenReset();
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });

  it('persiste apenas o hash SHA-256 do token (nunca o token em claro)', () => {
    const { token, tokenHash } = gerarTokenReset();
    expect(tokenHash).toBe(sha256Hash(token));
    expect(tokenHash).not.toContain(token);
    expect(tokenHash).toHaveLength(64);
  });

  it('expiração fica 30 minutos após a geração', () => {
    const agora = new Date('2026-09-27T12:00:00Z');
    const { expiraEm } = gerarTokenReset(agora);
    expect(expiraEm.getTime() - agora.getTime()).toBe(TOKEN_TTL_MINUTOS * 60 * 1000);
  });

  it('tokenExpirado reconhece expiração no limite exato e após', () => {
    const agora = new Date('2026-09-27T12:00:00Z');
    const { expiraEm } = gerarTokenReset(agora);

    expect(tokenExpirado(expiraEm, agora)).toBe(false);
    expect(tokenExpirado(expiraEm, new Date('2026-09-27T12:30:00Z'))).toBe(true);
    expect(tokenExpirado(expiraEm, new Date('2026-09-27T12:31:00Z'))).toBe(true);
  });
});
