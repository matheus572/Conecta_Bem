// frequencia.controller.js — handlers de frequência (RF_33, RF_34).
// Módulo restrito ao ADMINISTRADOR (matriz §12.2 — RF_F07 é X apenas para admin;
// authorize() aplicado nas rotas).
import * as service from './frequencia.service.js';
import * as cursosService from '../cursos/cursos.service.js';

function notFound(res, message) {
  res.status(404).render('pages/error', { title: 'Erro 404', status: 404, message });
}

async function formularioLancamento(req, res) {
  const turma = await cursosService.obterTurma(req.params.turmaId);
  if (!turma) return notFound(res, 'Turma não encontrada.');

  const dataAula = String(req.query.data_aula || '').trim();
  const alunos = await service.listarAlunosParaLancamento(turma.id);
  const lancamentos = dataAula ? await service.listarPorTurmaData(turma.id, dataAula) : [];
  const jaLancadas = new Set(lancamentos.map((l) => Number(l.matricula_id)));

  res.render('frequencia/form', {
    title: 'Lançar frequência',
    turma,
    alunos,
    dataAula,
    lancamentos,
    jaLancadas,
    erro: null,
  });
}

async function registrar(req, res) {
  const turmaId = req.params.turmaId;
  try {
    const { lancadas, canceladas } = await service.registrarFrequencia(turmaId, req.body);

    const mensagens = [];
    if (lancadas === 0) {
      mensagens.push('Nenhuma frequência lançada (aula já registrada para todos os alunos ativos).');
    } else {
      mensagens.push(`Frequência registrada para ${lancadas} aluno(s).`);
    }

    // RF_34: "notificação" do cancelamento automático = alerta em tela para o
    // administrador (sem SMTP no MVP — ver docs/decisoes.md, Sprint 4).
    for (const cancelada of canceladas) {
      mensagens.push(
        `Atenção: a matrícula de ${cancelada.nome} foi cancelada automaticamente ` +
          `por ${service.LIMITE_FALTAS_CONSECUTIVAS} faltas consecutivas (RN01). A vaga foi liberada.`,
      );
    }

    req.session.flash = {
      type: canceladas.length || lancadas === 0 ? 'error' : 'success',
      message: mensagens.join(' '),
    };
  } catch (err) {
    req.session.flash = { type: 'error', message: err.message };
  }
  res.redirect(`/frequencia/turmas/${turmaId}?data_aula=${req.body.data_aula || ''}`);
}

export { formularioLancamento, registrar };
