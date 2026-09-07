// auth.controller.js — handlers de login/logout e recuperação de senha.
import * as service from './auth.service.js';

function renderLoginForm(req, res) {
  res.render('auth/login', { title: 'Entrar', email: '' });
}

async function login(req, res) {
  const { email, senha } = req.body || {};
  const usuario = await service.autenticar(email, senha);

  if (!usuario) {
    return res.status(401).render('auth/login', {
      title: 'Entrar',
      email: email || '',
      erro: 'E-mail ou senha inválidos.',
    });
  }

  // Regenera o id de sessão ao autenticar (mitiga fixation).
  req.session.regenerate((err) => {
    if (err) {
      return res.status(500).render('pages/error', {
        title: 'Erro 500',
        status: 500,
        message: 'Não foi possível iniciar a sessão.',
      });
    }
    req.session.user = usuario;
    return res.redirect('/');
  });
}

function logout(req, res) {
  req.session.destroy(() => {
    res.redirect('/login');
  });
}

function forgotPassword(req, res) {
  res.render('auth/forgot-password', { title: 'Recuperar senha' });
}

export { renderLoginForm, login, logout, forgotPassword };