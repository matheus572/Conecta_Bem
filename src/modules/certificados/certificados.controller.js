// certificados.controller.js — handlers de certificados (RF_35, UC13).
// Módulo restrito ao ADMINISTRADOR (§13.3: prevalece o texto descritivo —
// Colaborador NÃO emite certificados; authorize() aplicado nas rotas).
import * as service from './certificados.service.js';
import * as cursosService from '../cursos/cursos.service.js';

const ROTULOS_STATUS_MATRICULA = {
  ATIVA: 'Ativa',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

function notFound(res, message) {
  res.status(404).render('pages/error', { title: 'Erro 404', status: 404, message });
}

/** Lista turmas para seleção (preferindo as ENCERRADAS, aptas à emissão). */
async function listar(req, res) {
  const turmas = await cursosService.listarTurmasGeral({});
  res.render('certificados/list', {
    title: 'Certificados',
    turmas,
    rotulosStatusTurma: cursosService.ROTULOS_STATUS_TURMA,
  });
}

/** Lista alunos da turma com sua elegibilidade (UC13 — fluxo básico, passo 3). */
async function listarPorTurma(req, res) {
  const dados = await service.listarElegibilidade(req.params.turmaId);
  if (!dados) return notFound(res, 'Turma não encontrada.');

  const emitidos = await service.listarEmitidos(dados.turma.id);
  res.render('certificados/turma', {
    title: `Certificados — ${dados.turma.curso_nome}`,
    turma: dados.turma,
    alunos: dados.alunos,
    emitidos,
    frequenciaMinima: service.FREQUENCIA_MINIMA_CERTIFICADO * 100,
    rotulosStatusTurma: cursosService.ROTULOS_STATUS_TURMA,
    rotulosStatusMatricula: ROTULOS_STATUS_MATRICULA,
  });
}

/** Emite o certificado de uma matrícula apta (UC13 — fluxo básico, passo 4). */
async function emitir(req, res) {
  try {
    const { codigoValidacao } = await service.emitir(req.body.matricula_id);
    req.session.flash = {
      type: 'success',
      message: `Certificado emitido. Código de validação: ${codigoValidacao}.`,
    };
  } catch (err) {
    req.session.flash = { type: 'error', message: err.message };
  }
  res.redirect(`/certificados/turmas/${req.body.turma_id}`);
}

export { listar, listarPorTurma, emitir };
