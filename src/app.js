// app.js — bootstrap do Express (server-rendered com EJS + Bootstrap).
//
// Aplicação exportada para permitir testes com Supertest. O `listen` só ocorre
// quando o módulo é executado diretamente (node src/app.js).
const path = require('node:path');
const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const { env } = require('./config/env');
const { notFoundHandler, errorHandler } = require('./middlewares/errorHandler');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.resolve(__dirname, 'views'));

app.use(expressLayouts);
app.set('layout', 'layouts/main');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use('/public', express.static(path.resolve(__dirname, 'public')));

app.locals.appName = env.app.name;
app.locals.appEnv = env.app.env;

// Rotas (por ora, somente a página inicial de smoke-test).
app.get('/', (req, res) => {
  res.render('pages/home', { title: 'Início' });
});

app.use(notFoundHandler);
app.use(errorHandler);

if (require.main === module) {
  app.listen(env.app.port, () => {
    console.log(`[app] ${env.app.name} rodando em http://localhost:${env.app.port}`);
  });
}

module.exports = { app };