// matriculas.controller.js — handlers de matrícula (RF_32, RN02).
// Acesso: ADMINISTRADOR e COLABORADOR (matriz §12.2 — RF_F06 é X/X).
import * as service from './matriculas.service.js';
import * as cursosService from '../cursos/cursos.service.js';
import * as beneficiariosService from '../beneficiarios/beneficiarios.service.js';

function notFound(res, message) {
  res.status(404).render('pages/error', { title: 'Erro 404', status: 404, message });
}

async function formularioNova(req, res) {
  const turma = await cursosService.obterTurma(req.query.turma_id);
  if (!turma) return notFound(res, 'Turma não encontrada.');

  const beneficiarios = await beneficiariosService.listar({});
  res.render('matriculas/form', {
    title: 'Nova matrícula',
    turma,
    beneficiarios,
    erro: null,
    form: {},
  });
}

async function criar(req, res) {
  try {
    await service.realizarMatricula(req.body);
    req.session.flash = { type: 'success', message: 'Matrícula realizada com sucesso.' };
    res.redirect(`/cursos/turmas/${req.body.turma_id}`);
  } catch (err) {
    const turma = await cursosService.obterTurma(req.body.turma_id);
    if (!turma) return notFound(res, 'Turma não encontrada.');
    const beneficiarios = await beneficiariosService.listar({});
    res.status(400).render('matriculas/form', {
      title: 'Nova matrícula',
      turma,
      beneficiarios,
      erro: err.message,
      form: req.body,
    });
  }
}

export { formularioNova, criar };
