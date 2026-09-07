// usuarios.service.js — regras de gestão de usuários (RF_04).
import bcrypt from 'bcryptjs';
import * as repository from './usuarios.repository.js';

const PERFIS = ['ADMINISTRADOR', 'COLABORADOR'];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Valida a força mínima da senha: mínimo 8 caracteres, letra e número. */
function senhaForte(senha) {
  return typeof senha === 'string' && senha.length >= 8 && /[a-zA-Z]/.test(senha) && /\d/.test(senha);
}

function emailValido(email) {
  return EMAIL_REGEX.test(String(email || '').trim());
}

/** Normaliza e valida os dados; lança Error com mensagem amigável em falha. */
function validarDados(dados, { obrigaSenha }) {
  const nome = String(dados.nome || '').trim();
  const email = String(dados.email || '').trim().toLowerCase();
  const perfil = dados.perfil;
  const senha = dados.senha;

  if (!nome) throw new Error('Nome é obrigatório.');
  if (!emailValido(email)) throw new Error('E-mail inválido.');
  if (!PERFIS.includes(perfil)) throw new Error('Perfil inválido.');
  if ((obrigaSenha || senha) && !senhaForte(senha)) {
    throw new Error('A senha deve ter ao menos 8 caracteres, com letras e números.');
  }

  return { nome, email, perfil, senha: senha || null };
}

async function listar() {
  return repository.list();
}

async function obter(id) {
  return repository.findById(id);
}

async function criar(dados) {
  const normalizado = validarDados(dados, { obrigaSenha: true });

  const existente = await repository.findByEmail(normalizado.email);
  if (existente) throw new Error('Já existe um usuário com este e-mail.');

  const senhaHash = await bcrypt.hash(normalizado.senha, 12);
  return repository.create({
    nome: normalizado.nome,
    email: normalizado.email,
    senhaHash,
    perfil: normalizado.perfil,
  });
}

async function atualizar(id, dados) {
  const normalizado = validarDados(dados, { obrigaSenha: false });

  const existente = await repository.findByEmail(normalizado.email, id);
  if (existente) throw new Error('Já existe outro usuário com este e-mail.');

  await repository.update(id, {
    nome: normalizado.nome,
    email: normalizado.email,
    perfil: normalizado.perfil,
  });
}

async function alternarAtivo(id, ativo) {
  await repository.setAtivo(id, ativo);
}

async function excluir(id) {
  await repository.softDelete(id);
}

export { listar, obter, criar, atualizar, alternarAtivo, excluir };