// auth.service.js — lógica de autenticação (RF_01).
import bcrypt from 'bcryptjs';
import * as repository from './auth.repository.js';

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

export { autenticar };