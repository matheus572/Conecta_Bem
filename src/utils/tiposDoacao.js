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

// Unidades aceitas na criação de item (Sprint 7 — select do formulário).
// UN é o default visual do formulário; o service aplica-o também quando o
// campo chega vazio.
export const UNIDADES_ITEM = ['UN', 'KG', 'G', 'L', 'ML', 'CX', 'PCT', 'PAR'];

export function rotuloTipo(tipo) {
  return ROTULOS_TIPOS_DOACAO[tipo] || tipo;
}

export function isTipoValido(tipo) {
  return TIPOS_DOACAO.includes(tipo);
}