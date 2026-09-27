// dashboard.controller.js — painel de controle (RF_29/UC14).
import * as service from './dashboard.service.js';

async function exibir(req, res) {
  const dados = await service.indicadores();
  res.render('dashboard/index', { title: 'Painel de controle', ...dados });
}

export { exibir };
