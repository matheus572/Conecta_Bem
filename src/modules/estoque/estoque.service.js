// estoque.service.js — regras de estoque (RF_14, RF_16/RF_S04).
import { isTipoValido } from '../../utils/tiposDoacao.js';
import * as repository from './estoque.repository.js';

/**
 * Lista o estoque (por tipo) com filtro de tipo e indicador de estoque mínimo:
 * adiciona `abaixo_minimo` quando `quantidade < estoque_minimo` (RF_S04).
 */
async function listar({ tipo = '', status = '' } = {}) {
  if (tipo && !isTipoValido(tipo)) throw new Error('Tipo de doação inválido.');

  const itens = await repository.listar({ tipo });

  const comIndicador = itens.map((item) => ({
    ...item,
    abaixo_minimo: item.quantidade < item.estoque_minimo,
  }));

  if (status === 'baixo') return comIndicador.filter((item) => item.abaixo_minimo);
  if (status === 'ok') return comIndicador.filter((item) => !item.abaixo_minimo);
  return comIndicador;
}

async function atualizarMinimo(tipo, minimo) {
  if (!isTipoValido(tipo)) throw new Error('Tipo de doação inválido.');

  const valor = Number(minimo);
  if (!Number.isFinite(valor) || valor < 0) {
    throw new Error('Estoque mínimo deve ser um número maior ou igual a zero.');
  }

  await repository.atualizarMinimo(tipo, valor);
}

export { listar, atualizarMinimo };