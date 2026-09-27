// utils/mailer.js — envio de e-mail via SMTP (nodemailer).
//
// Em desenvolvimento, o docker-compose sobe o Mailhog (captura tudo em
// http://localhost:8025). Em produção, as variáveis SMTP_* devem apontar para
// um provedor real — ver docs/deploy.md (decisão da Sprint 5: RF_03 funcional
// em dev via Mailhog, pendente configuração real em produção).
//
// Em APP_ENV=test, os e-mails NÃO são enviados: ficam disponíveis em
// `outbox` (memória do processo) para assertions dos testes de integração.
import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,
      secure: false,
    });
  }
  return transporter;
}

/** Caixa de saída em memória, usada apenas em APP_ENV=test (nunca envia). */
const outbox = [];

/**
 * Envia um e-mail (HTML e texto puro). Em teste, apenas registra na outbox.
 * @param {{ para: string, assunto: string, texto: string, html: string }} msg
 */
async function enviarEmail({ para, assunto, texto, html }) {
  if (env.app.env === 'test') {
    outbox.push({ para, assunto, texto, html });
    return { simulado: true };
  }
  return getTransporter().sendMail({
    from: env.mail.from,
    to: para,
    subject: assunto,
    text: texto,
    html,
  });
}

/** Apenas para testes: lê e limpa a outbox. */
function limparOutbox() {
  outbox.length = 0;
}

export { enviarEmail, outbox, limparOutbox };
