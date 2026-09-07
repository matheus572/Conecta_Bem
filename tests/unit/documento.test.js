import { describe, it, expect } from 'vitest';
import { somenteDigitos, validarCpf, validarCnpj } from '../../src/utils/documento.js';

describe('somenteDigitos', () => {
  it('remove pontuação e espaços', () => {
    expect(somenteDigitos('529.982.247-25')).toBe('52998224725');
    expect(somenteDigitos('11.222.333/0001-81')).toBe('11222333000181');
  });
});

describe('validarCpf', () => {
  it('aceita CPFs válidos', () => {
    expect(validarCpf('529.982.247-25')).toBe(true);
    expect(validarCpf('111.444.777-35')).toBe(true);
  });

  it('rejeita CPFs inválidos', () => {
    expect(validarCpf('529.982.247-26')).toBe(false); // dígito verificador errado
    expect(validarCpf('000.000.000-00')).toBe(false);
    expect(validarCpf('111.111.111-11')).toBe(false); // sequência repetida
    expect(validarCpf('123')).toBe(false); // tamanho incorreto
  });
});

describe('validarCnpj', () => {
  it('aceita CNPJs válidos', () => {
    expect(validarCnpj('11.222.333/0001-81')).toBe(true);
  });

  it('rejeita CNPJs inválidos', () => {
    expect(validarCnpj('11.222.333/0001-82')).toBe(false);
    expect(validarCnpj('00.000.000/0001-00')).toBe(false);
    expect(validarCnpj('1234')).toBe(false);
  });
});