// utils/documento.js — validação de CPF e CNPJ (dígitos verificadores).
// Usado na validação de unicidade/documento (RN04) antes de persistir.

/** Remove todos os caracteres não numéricos de um documento. */
function somenteDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

function calcularDigito(base, pesos) {
  let soma = 0;
  for (let i = 0; i < base.length; i += 1) {
    soma += parseInt(base[i], 10) * pesos[i];
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/**
 * Valida um CPF (11 dígitos) incluindo os dígitos verificadores.
 * @param {string} cpf
 * @returns {boolean}
 */
function validarCpf(cpf) {
  const dig = somenteDigitos(cpf);
  if (dig.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(dig)) return false; // rejeita sequências repetidas

  const base9 = dig.slice(0, 9);
  const dv1 = calcularDigito(base9, [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const base10 = base9 + dv1;
  const dv2 = calcularDigito(base10, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);

  return dv1 === parseInt(dig[9], 10) && dv2 === parseInt(dig[10], 10);
}

/**
 * Valida um CNPJ (14 dígitos) incluindo os dígitos verificadores.
 * @param {string} cnpj
 * @returns {boolean}
 */
function validarCnpj(cnpj) {
  const dig = somenteDigitos(cnpj);
  if (dig.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(dig)) return false;

  const base12 = dig.slice(0, 12);
  const dv1 = calcularDigito(base12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const base13 = base12 + dv1;
  const dv2 = calcularDigito(base13, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);

  return dv1 === parseInt(dig[12], 10) && dv2 === parseInt(dig[13], 10);
}

export { somenteDigitos, validarCpf, validarCnpj };