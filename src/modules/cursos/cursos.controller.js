// cursos.controller.js — handlers de cursos e turmas (RF_30, RF_31).
// Permissão (§12.2 / RF_36): ADMINISTRADOR gerencia; COLABORADOR só consulta
// (a restrição de escrita é aplicada nas rotas via authorize()).
import {
  STATUS_CURSO,
  STATUS_TURMA,
  ROTULOS_STATUS_CURSO,
  ROTULOS_STATUS_TURMA,
} from './cursos.service.js';
import * as service from './cursos.service.js';

function notFound(res, message) {
  res.status(404).render('pages/error', { title: 'Erro 404', status: 404, message });
}

// --- Curso (RF_30) ---

async function listar(req, res) {
  const q = String(req.query.q || '').trim();
  const status = String(req.query.status || '').trim();
  const cursos = await service.listarCursos({ q, status });
  res.render('cursos/list', {
    title: 'Cursos e Oficinas',
    cursos,
    q,
    status,
    statusCurso: STATUS_CURSO,
    rotulosStatus: ROTULOS_STATUS_CURSO,
  });
}

function formularioNovo(req, res) {
  res.render('cursos/form', {
    title: 'Novo curso',
    curso: null,
    erro: null,
    form: {},
    statusCurso: STATUS_CURSO,
    rotulosStatus: ROTULOS_STATUS_CURSO,
  });
}

async function criar(req, res) {
  try {
    const id = await service.criarCurso(req.body);
    req.session.flash = { type: 'success', message: 'Curso cadastrado.' };
    res.redirect(`/cursos/${id}`);
  } catch (err) {
    res.status(400).render('cursos/form', {
      title: 'Novo curso',
      curso: null,
      erro: err.message,
      form: req.body,
      statusCurso: STATUS_CURSO,
      rotulosStatus: ROTULOS_STATUS_CURSO,
    });
  }
}

async function detalhar(req, res) {
  const curso = await service.obterCurso(req.params.id);
  if (!curso) return notFound(res, 'Curso não encontrado.');

  const turmas = await service.listarTurmas(curso.id);
  res.render('cursos/detalhe', {
    title: curso.nome,
    curso,
    turmas,
    rotulosStatusCurso: ROTULOS_STATUS_CURSO,
    rotulosStatusTurma: ROTULOS_STATUS_TURMA,
  });
}

async function formularioEditar(req, res) {
  const curso = await service.obterCurso(req.params.id);
  if (!curso) return notFound(res, 'Curso não encontrado.');
  res.render('cursos/form', {
    title: 'Editar curso',
    curso,
    erro: null,
    form: curso,
    statusCurso: STATUS_CURSO,
    rotulosStatus: ROTULOS_STATUS_CURSO,
  });
}

async function atualizar(req, res) {
  try {
    await service.atualizarCurso(req.params.id, req.body);
    req.session.flash = { type: 'success', message: 'Curso atualizado.' };
    res.redirect(`/cursos/${req.params.id}`);
  } catch (err) {
    const curso = { ...req.body, id: req.params.id };
    res.status(400).render('cursos/form', {
      title: 'Editar curso',
      curso,
      erro: err.message,
      form: req.body,
      statusCurso: STATUS_CURSO,
      rotulosStatus: ROTULOS_STATUS_CURSO,
    });
  }
}

async function excluir(req, res) {
  try {
    await service.excluirCurso(req.params.id);
    req.session.flash = { type: 'success', message: 'Curso excluído.' };
  } catch (err) {
    req.session.flash = { type: 'error', message: err.message };
  }
  res.redirect('/cursos');
}

// --- Turma (RF_31) ---

async function formularioNovaTurma(req, res) {
  const curso = await service.obterCurso(req.params.id);
  if (!curso) return notFound(res, 'Curso não encontrado.');

  const voluntarios = await service.listarVoluntariosAtivos();
  res.render('cursos/turma-form', {
    title: 'Nova turma',
    curso,
    turma: null,
    voluntarios,
    erro: null,
    form: {},
    statusTurma: STATUS_TURMA,
    rotulosStatus: ROTULOS_STATUS_TURMA,
  });
}

async function criarTurma(req, res) {
  try {
    const turmaId = await service.criarTurma(req.params.id, req.body);
    req.session.flash = { type: 'success', message: 'Turma cadastrada.' };
    res.redirect(`/cursos/turmas/${turmaId}`);
  } catch (err) {
    const curso = await service.obterCurso(req.params.id);
    const voluntarios = await service.listarVoluntariosAtivos();
    res.status(400).render('cursos/turma-form', {
      title: 'Nova turma',
      curso,
      turma: null,
      voluntarios,
      erro: err.message,
      form: req.body,
      statusTurma: STATUS_TURMA,
      rotulosStatus: ROTULOS_STATUS_TURMA,
    });
  }
}

async function detalharTurma(req, res) {
  const turma = await service.obterTurma(req.params.turmaId);
  if (!turma) return notFound(res, 'Turma não encontrada.');
  res.render('cursos/turma-detalhe', {
    title: `Turma — ${turma.curso_nome}`,
    turma,
    matriculas: [],
    vagasOcupadas: 0,
    vagasDisponiveis: turma.capacidade,
    rotulosStatusTurma: ROTULOS_STATUS_TURMA,
  });
}

async function formularioEditarTurma(req, res) {
  const turma = await service.obterTurma(req.params.turmaId);
  if (!turma) return notFound(res, 'Turma não encontrada.');

  const curso = await service.obterCurso(turma.curso_id);
  const voluntarios = await service.listarVoluntariosAtivos();
  res.render('cursos/turma-form', {
    title: 'Editar turma',
    curso,
    turma,
    voluntarios,
    erro: null,
    form: turma,
    statusTurma: STATUS_TURMA,
    rotulosStatus: ROTULOS_STATUS_TURMA,
  });
}

async function atualizarTurma(req, res) {
  try {
    await service.atualizarTurma(req.params.turmaId, req.body);
    req.session.flash = { type: 'success', message: 'Turma atualizada.' };
    res.redirect(`/cursos/turmas/${req.params.turmaId}`);
  } catch (err) {
    const turma = await service.obterTurma(req.params.turmaId);
    const curso = turma ? await service.obterCurso(turma.curso_id) : null;
    const voluntarios = await service.listarVoluntariosAtivos();
    res.status(400).render('cursos/turma-form', {
      title: 'Editar turma',
      curso,
      turma,
      voluntarios,
      erro: err.message,
      form: req.body,
      statusTurma: STATUS_TURMA,
      rotulosStatus: ROTULOS_STATUS_TURMA,
    });
  }
}

async function excluirTurma(req, res) {
  const turma = await service.obterTurma(req.params.turmaId);
  try {
    await service.excluirTurma(req.params.turmaId);
    req.session.flash = { type: 'success', message: 'Turma excluída.' };
  } catch (err) {
    req.session.flash = { type: 'error', message: err.message };
  }
  res.redirect(turma ? `/cursos/${turma.curso_id}` : '/cursos');
}

export {
  listar,
  formularioNovo,
  criar,
  detalhar,
  formularioEditar,
  atualizar,
  excluir,
  formularioNovaTurma,
  criarTurma,
  detalharTurma,
  formularioEditarTurma,
  atualizarTurma,
  excluirTurma,
};
