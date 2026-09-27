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

/**
 * POST /forgot-password (RF_03). A resposta é sempre neutra ("se o e-mail
 * estiver cadastrado..."), independentemente de a conta existir — evita vazar
 * a existência de contas (LGPD, §11.3).
 */
async function solicitarRecuperacao(req, res) {
  try {
    await service.solicitarRecuperacao(req.body?.email);
  } catch (err) {
    // Falha de envio não deve impedir a resposta neutra ao usuário.
    console.error('[auth] falha ao processar recuperação de senha:', err);
  }
  res.render('auth/forgot-password', {
    title: 'Recuperar senha',
    mensagem: 'Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.',
  });
}

async function renderResetPassword(req, res) {
  const token = String(req.query.token || '');
  const valido = await service.validarTokenReset(token);
  if (!valido) {
    return res.status(400).render('auth/reset-password', {
      title: 'Redefinir senha',
      tokenInvalido: true,
    });
  }
  return res.render('auth/reset-password', { title: 'Redefinir senha', token, tokenInvalido: false });
}

async function resetPassword(req, res) {
  const { token, senha, senha_confirmacao } = req.body || {};
  try {
    await service.redefinirSenha(token, senha, senha_confirmacao);
  } catch (err) {
    return res.status(400).render('auth/reset-password', {
      title: 'Redefinir senha',
      token: String(token || ''),
      tokenInvalido: false,
      erro: err.message,
    });
  }
  req.session.flash = {
    type: 'success',
    message: 'Senha redefinida com sucesso. Entre com a nova senha.',
  };
  return res.redirect('/login');
}

export {
  renderLoginForm,
  login,
  logout,
  forgotPassword,
  solicitarRecuperacao,
  renderResetPassword,
  resetPassword,
};