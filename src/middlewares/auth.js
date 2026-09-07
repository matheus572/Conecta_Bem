// middlewares/auth.js — controle de autenticação (RN05) e autorização (§12.2).

/**
 * Exige usuário autenticado. Redireciona para /login quando não há sessão
 * (requisições HTML); responde 401 para requisições que pedem JSON.
 */
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  if (req.accepts('html') && !req.path.startsWith('/api')) {
    return res.redirect('/login');
  }
  return res.status(401).json({ error: 'Não autenticado.' });
}

/**
 * Restringe o acesso a um ou mais perfis. Devolve 403 quando o usuário
 * autenticado não possui nenhum dos perfis permitidos.
 * @param  {...string} perfis perfis permitidos (ex.: 'ADMINISTRADOR')
 */
function authorize(...perfis) {
  return (req, res, next) => {
    const perfil = req.session?.user?.perfil;
    if (!perfil || !perfis.includes(perfil)) {
      if (req.accepts('html')) {
        return res.status(403).render('pages/error', {
          title: 'Acesso negado',
          status: 403,
          message: 'Você não tem permissão para acessar este recurso.',
        });
      }
      return res.status(403).json({ error: 'Acesso negado.' });
    }
    return next();
  };
}

/**
 * Disponibiliza `req.session.user` em `res.locals.currentUser` para as views
 * (controle de visibilidade na navegação).
 */
function exposeCurrentUser(req, res, next) {
  res.locals.currentUser = req.session?.user || null;
  next();
}

export { requireAuth, authorize, exposeCurrentUser };