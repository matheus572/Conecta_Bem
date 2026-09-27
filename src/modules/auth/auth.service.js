// auth.service.js — lógica de autenticação (RF_01) e recuperação de senha (RF_03).
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import * as mailer from '../../utils/mailer.js';
import * as repository from './auth.repository.js';

/** Validade curta do link de recuperação (RF_03) — decisão Sprint 5. */
const TOKEN_TTL_MINUTOS = 30;

/** Hash SHA-256 do token em claro — é o que fica persistido no banco. */
function sha256Hash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

/**
 * Gera um token de recuperação criptograficamente aleatório. Retorna o token
 * em claro (para o e-mail), seu hash (para o banco) e a data de expiração.
 * Função pura (determinística quanto ao formato; testável por injeção).
 */
function gerarTokenReset(agora = new Date()) {
  const token = crypto.randomBytes(32).toString('hex');
  return {
    token,
    tokenHash: sha256Hash(token),
    expiraEm: new Date(agora.getTime() + TOKEN_TTL_MINUTOS * 60 * 1000),
  };
}

/** Diz se um registro de reset está expirado na data de referência. */
function tokenExpirado(expiresAt, agora = new Date()) {
  return new Date(expiresAt).getTime() <= agora.getTime();
}

/** Força mínima da senha: 8 caracteres, com letra e número (mesma regra de usuários). */
function senhaForte(senha) {
  return typeof senha === 'string' && senha.length >= 8 && /[a-zA-Z]/.test(senha) && /\d/.test(senha);
}

/**
 * Autentica um usuário por e-mail/senha. Retorna os dados do usuário (sem o
 * hash) em caso de sucesso, ou null quando as credenciais são inválidas.
 */
async function autenticar(email, senha) {
  const emailNormalizado = String(email || '').trim().toLowerCase();
  if (!emailNormalizado || !senha) return null;

  const usuario = await repository.findByEmail(emailNormalizado);
  if (!usuario) return null;

  const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
  if (!senhaValida) return null;

  return {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    perfil: usuario.perfil,
  };
}

/**
 * Inicia o fluxo de recuperação de senha (RF_03). Resolve silenciosamente
 * mesmo quando o e-mail não existe — a resposta ao usuário é sempre a mesma,
 * para não vazar a existência de contas (LGPD, §11.3).
 */
async function solicitarRecuperacao(email) {
  const emailNormalizado = String(email || '').trim().toLowerCase();
  if (!emailNormalizado) return;

  const usuario = await repository.findByEmail(emailNormalizado);
  if (!usuario) return;

  const { token, tokenHash, expiraEm } = gerarTokenReset();
  // Só o link mais recente pode ser usado.
  await repository.invalidarResetsPendentes(usuario.id);
  await repository.criarReset({ usuarioId: usuario.id, tokenHash, expiraEm });

  const link = `${env.mail.baseUrl}/reset-password?token=${token}`;
  await mailer.enviarEmail({
    para: usuario.email,
    assunto: `${env.app.name} — Recuperação de senha`,
    texto:
      `Olá, ${usuario.nome}.\n\n` +
      `Recebemos uma solicitação de recuperação de senha. Para definir uma nova senha, acesse:\n` +
      `${link}\n\n` +
      `O link é válido por ${TOKEN_TTL_MINUTOS} minutos. Se você não solicitou, ignore este e-mail.\n`,
    html:
      `<p>Olá, <strong>${usuario.nome}</strong>.</p>` +
      `<p>Recebemos uma solicitação de recuperação de senha. Para definir uma nova senha, acesse o link abaixo:</p>` +
      `<p><a href="${link}">${link}</a></p>` +
      `<p>O link é válido por ${TOKEN_TTL_MINUTOS} minutos. Se você não solicitou, ignore este e-mail.</p>`,
  });
}

/**
 * Valida um token de recuperação (em claro). Retorna o registro de reset
 * quando válido, ou null quando inexistente, usado ou expirado.
 */
async function validarTokenReset(token) {
  if (!token) return null;
  const reset = await repository.findResetPorHash(sha256Hash(token));
  if (!reset || reset.used_at || tokenExpirado(reset.expires_at)) return null;
  return reset;
}

/**
 * Redefine a senha do usuário a partir de um token válido. Lança Error com
 * mensagem amigável em caso de token inválido ou senha fraca/divergente.
 */
async function redefinirSenha(token, senha, senhaConfirmacao) {
  if (!senhaForte(senha)) {
    throw new Error('A senha deve ter ao menos 8 caracteres, com letras e números.');
  }
  if (senha !== senhaConfirmacao) {
    throw new Error('As senhas não conferem.');
  }

  const reset = await validarTokenReset(token);
  if (!reset) {
    throw new Error('Link de recuperação inválido ou expirado. Solicite um novo.');
  }

  const senhaHash = await bcrypt.hash(senha, 12);
  await repository.atualizarSenha(reset.usuario_id, senhaHash);
  await repository.marcarResetUsado(reset.id);
}

export {
  autenticar,
  solicitarRecuperacao,
  validarTokenReset,
  redefinirSenha,
  gerarTokenReset,
  sha256Hash,
  tokenExpirado,
  TOKEN_TTL_MINUTOS,
};