// middlewares/errorHandler.js — tratamento central de erros HTTP.
import createError from 'http-errors';

function notFoundHandler(req, res, next) {
  next(createError(404));
}

// `next` é obrigatório na assinatura (4 argumentos) para o Express reconhecer
// este middleware como handler de erro.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const isProd = process.env.APP_ENV === 'production';

  res.status(status);

  if (req.accepts('html')) {
    res.render('pages/error', {
      title: `Erro ${status}`,
      status,
      message: isProd && status >= 500 ? 'Erro interno do servidor.' : err.message,
    });
    return;
  }

  res.json({ error: { status, message: err.message } });
}

export { notFoundHandler, errorHandler };