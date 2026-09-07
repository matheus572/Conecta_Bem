// app.js — bootstrap do Express (server-rendered com EJS + Bootstrap).
//
// Exporta a aplicação para permitir testes com Supertest. O servidor HTTP é
// iniciado em src/server.js (quando executado como entrypoint).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import expressLayouts from 'express-ejs-layouts';
import methodOverride from 'method-override';
import { env } from './config/env.js';
import { sessionMiddleware } from './config/session.js';
import { requireAuth, exposeCurrentUser } from './middlewares/auth.js';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.js';

import authRoutes from './modules/auth/auth.routes.js';
import usuariosRoutes from './modules/usuarios/usuarios.routes.js';
import beneficiariosRoutes from './modules/beneficiarios/beneficiarios.routes.js';
import doadoresRoutes from './modules/doadores/doadores.routes.js';
import doacoesRoutes from './modules/doacoes/doacoes.routes.js';
import estoqueRoutes from './modules/estoque/estoque.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.resolve(__dirname, 'views'));

app.use(expressLayouts);
app.set('layout', 'layouts/main');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

app.use('/public', express.static(path.resolve(__dirname, 'public')));

app.use(sessionMiddleware);
app.use(exposeCurrentUser);

// Exposição de mensagens flash (Post/Redirect/Get) nas views.
app.use((req, res, next) => {
  res.locals.flash = req.session?.flash || null;
  if (req.session?.flash) delete req.session.flash;
  next();
});

app.locals.appName = env.app.name;
app.locals.appEnv = env.app.env;

// Rotas públicas (antes do requireAuth global).
app.use(authRoutes);

// Tudo abaixo exige autenticação (RN05).
app.use(requireAuth);

app.get('/', (req, res) => {
  res.render('pages/home', { title: 'Início' });
});

app.use('/usuarios', usuariosRoutes);
app.use('/beneficiarios', beneficiariosRoutes);
app.use('/doadores', doadoresRoutes);
app.use('/doacoes', doacoesRoutes);
app.use('/estoque', estoqueRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export { app };