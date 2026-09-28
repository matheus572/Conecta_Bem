// relatorios.service.js — consolidação dos relatórios (RF_26–28).
// Sem SQL: recebe agregados do repository e monta as linhas prontas para a
// view e para a exportação (PDF/.xlsx — RF_29a).

import * as repository from './relatorios.repository.js';
import { isTipoValido, ROTULOS_TIPOS_DOACAO } from '../../utils/tiposDoacao.js';

const DATA_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const STATUS_CAMPANHA = ['PLANEJADA', 'ATIVA', 'ENCERRADA'];

/** Valida e normaliza os filtros de período; lança Error amigável em falha. */
function normalizarPeriodo({ inicio, fim }) {
  const ini = String(inicio || '').trim();
  const fimV = String(fim || '').trim();

  if (ini && !DATA_REGEX.test(ini)) throw new Error('Data inicial inválida (use AAAA-MM-DD).');
  if (fimV && !DATA_REGEX.test(fimV)) throw new Error('Data final inválida (use AAAA-MM-DD).');
  if (ini && fimV && ini > fimV) throw new Error('A data inicial não pode ser maior que a final.');

  return { inicio: ini || null, fim: fimV || null };
}

/** Formata data ('YYYY-MM-DD' ou Date do mysql2) para dd/mm/aaaa. */
function formatarData(data) {
  if (!data) return '';
  const iso = data instanceof Date ? data.toISOString().slice(0, 10) : String(data).slice(0, 10);
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** RF_26 — doações recebidas e distribuídas por período. Dois níveis
 * (decisão da Sprint 6): consolidado por tipo (compatível com Sprint 5) +
 * detalhamento por item. */
async function relatorioDoacoes(filtros = {}) {
  const { inicio, fim } = normalizarPeriodo(filtros);
  const tipo = String(filtros.tipo || '').trim();
  if (tipo && !isTipoValido(tipo)) throw new Error('Tipo de doação inválido.');

  const [recebidas, distribuidas, recebidasPorItem, distribuidasPorItem] = await Promise.all([
    repository.resumoDoacoesRecebidas({ inicio, fim, tipo }),
    repository.resumoDoacoesDistribuidas({ inicio, fim, tipo }),
    repository.resumoDoacoesRecebidasPorItem({ inicio, fim, tipo }),
    repository.resumoDoacoesDistribuidasPorItem({ inicio, fim, tipo }),
  ]);

  // Junta os dois agregados em uma linha por tipo (LEFT/RIGHT não suportado em
  // um único GROUP BY com tabelas diferentes — o merge é feito aqui).
  const linhas = [];
  const porTipo = new Map();
  for (const r of recebidas) {
    porTipo.set(r.tipo_doacao, {
      tipo: r.tipo_doacao,
      rotulo: ROTULOS_TIPOS_DOACAO[r.tipo_doacao] || r.tipo_doacao,
      num_doacoes: Number(r.num_doacoes),
      total_recebida: Number(r.total_recebida),
      num_doadores: Number(r.num_doadores),
      num_distribuicoes: 0,
      total_distribuida: 0,
      num_beneficiarios: 0,
    });
  }
  for (const d of distribuidas) {
    if (!porTipo.has(d.tipo_doacao)) {
      porTipo.set(d.tipo_doacao, {
        tipo: d.tipo_doacao,
        rotulo: ROTULOS_TIPOS_DOACAO[d.tipo_doacao] || d.tipo_doacao,
        num_doacoes: 0,
        total_recebida: 0,
        num_doadores: 0,
        num_distribuicoes: 0,
        total_distribuida: 0,
        num_beneficiarios: 0,
      });
    }
    const linha = porTipo.get(d.tipo_doacao);
    linha.num_distribuicoes = Number(d.num_distribuicoes);
    linha.total_distribuida = Number(d.total_distribuida);
    linha.num_beneficiarios = Number(d.num_beneficiarios);
  }
  linhas.push(...[...porTipo.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR')));

  // Detalhamento por item (mesma lógica de merge, chaveada por tipo+item).
  const porItem = new Map();
  const garantirItem = (r) => {
    const chave = `${r.tipo_doacao}|${r.nome_item}`;
    if (!porItem.has(chave)) {
      porItem.set(chave, {
        rotulo_tipo: ROTULOS_TIPOS_DOACAO[r.tipo_doacao] || r.tipo_doacao,
        nome_item: r.nome_item,
        num_doacoes: 0,
        total_recebida: 0,
        num_distribuicoes: 0,
        total_distribuida: 0,
      });
    }
    return porItem.get(chave);
  };
  for (const r of recebidasPorItem) {
    const linha = garantirItem(r);
    linha.num_doacoes = Number(r.num_doacoes);
    linha.total_recebida = Number(r.total_recebida);
  }
  for (const d of distribuidasPorItem) {
    const linha = garantirItem(d);
    linha.num_distribuicoes = Number(d.num_distribuicoes);
    linha.total_distribuida = Number(d.total_distribuida);
  }
  const linhasItens = [...porItem.values()].sort(
    (a, b) => a.rotulo_tipo.localeCompare(b.rotulo_tipo, 'pt-BR') || a.nome_item.localeCompare(b.nome_item, 'pt-BR'),
  );

  const totais = linhas.reduce(
    (acc, l) => ({
      num_doacoes: acc.num_doacoes + l.num_doacoes,
      total_recebida: acc.total_recebida + l.total_recebida,
      num_distribuicoes: acc.num_distribuicoes + l.num_distribuicoes,
      total_distribuida: acc.total_distribuida + l.total_distribuida,
    }),
    { num_doacoes: 0, total_recebida: 0, num_distribuicoes: 0, total_distribuida: 0 },
  );

  return { inicio, fim, tipo, linhas, linhasItens, totais };
}

/** RF_27 — atendimentos realizados por período, por beneficiário. */
async function relatorioAtendimentos(filtros = {}) {
  const { inicio, fim } = normalizarPeriodo(filtros);

  const [atendimentos, distribuicoes, matriculas] = await Promise.all([
    repository.atendimentosPorBeneficiario({ inicio, fim }),
    repository.distribuicoesPorBeneficiario({ inicio, fim }),
    repository.matriculasPorBeneficiario({ inicio, fim }),
  ]);

  const porBeneficiario = new Map();
  const garantir = (id) => {
    if (!porBeneficiario.has(id)) {
      porBeneficiario.set(id, {
        beneficiario_id: id,
        nome: '',
        num_atendimentos: 0,
        num_distribuicoes: 0,
        itens_recebidos: 0,
        num_matriculas: 0,
      });
    }
    return porBeneficiario.get(id);
  };
  for (const a of atendimentos) garantir(a.beneficiario_id).num_atendimentos = Number(a.num_atendimentos);
  for (const d of distribuicoes) {
    const linha = garantir(d.beneficiario_id);
    linha.num_distribuicoes = Number(d.num_distribuicoes);
    linha.itens_recebidos = Number(d.itens_recebidos);
  }
  for (const m of matriculas) garantir(m.beneficiario_id).num_matriculas = Number(m.num_matriculas);

  const nomes = await repository.nomesBeneficiarios([...porBeneficiario.keys()]);
  for (const b of nomes) garantir(b.id).nome = b.nome;

  const linhas = [...porBeneficiario.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  const totais = linhas.reduce(
    (acc, l) => ({
      num_atendimentos: acc.num_atendimentos + l.num_atendimentos,
      num_distribuicoes: acc.num_distribuicoes + l.num_distribuicoes,
      itens_recebidos: acc.itens_recebidos + l.itens_recebidos,
      num_matriculas: acc.num_matriculas + l.num_matriculas,
    }),
    { num_atendimentos: 0, num_distribuicoes: 0, itens_recebidos: 0, num_matriculas: 0 },
  );

  return { inicio, fim, linhas, totais };
}

/** RF_28 — campanhas com resultados consolidados. */
async function relatorioCampanhas(filtros = {}) {
  const { inicio, fim } = normalizarPeriodo(filtros);
  const status = String(filtros.status || '').trim();
  if (status && !STATUS_CAMPANHA.includes(status)) throw new Error('Status de campanha inválido.');

  const linhas = (await repository.campanhasConsolidadas({ inicio, fim, status })).map((c) => ({
    id: c.id,
    titulo: c.titulo,
    status: c.status,
    periodo: `${formatarData(c.data_inicio)} a ${formatarData(c.data_fim)}`,
    num_voluntarios: Number(c.num_voluntarios),
    beneficiarios_atendidos: Number(c.beneficiarios_atendidos),
    itens_distribuidos: Number(c.itens_distribuidos),
  }));

  const totais = linhas.reduce(
    (acc, l) => ({
      beneficiarios_atendidos: acc.beneficiarios_atendidos + l.beneficiarios_atendidos,
      itens_distribuidos: acc.itens_distribuidos + l.itens_distribuidos,
    }),
    { beneficiarios_atendidos: 0, itens_distribuidos: 0 },
  );

  return { inicio, fim, status, linhas, totais };
}

export { relatorioDoacoes, relatorioAtendimentos, relatorioCampanhas, formatarData };
