// utils/tiposDoacao.js — tipos de doação/vocabulário compartilhado (RF_13).
// Mantém em um único lugar o ENUM usado em doação, distribuição e estoque,
// com rótulos de exibição para as views.
export const TIPOS_DOACAO = ['ALIMENTOS', 'ROUPAS', 'MOVEIS_UTENSILIOS', 'OUTROS'];

export const ROTULOS_TIPOS_DOACAO = {
  ALIMENTOS: 'Alimentos',
  ROUPAS: 'Roupas',
  MOVEIS_UTENSILIOS: 'Móveis e utensílios',
  OUTROS: 'Outros',
};

export function rotuloTipo(tipo) {
  return ROTULOS_TIPOS_DOACAO[tipo] || tipo;
}

export function isTipoValido(tipo) {
  return TIPOS_DOACAO.includes(tipo);
}