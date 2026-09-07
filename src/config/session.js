// config/session.js — sessão server-side (express-session) com store MySQL.
// Cookie: HttpOnly + SameSite=Lax (Secure em produção). Expiração de 8h.
import session from 'express-session';
import createMySQLStore from 'express-mysql-session';
import { env } from './env.js';

const ONE_HOUR_MS = 60 * 60 * 1000;

const MySQLStore = createMySQLStore(session);

const sessionStore = new MySQLStore({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  createDatabaseTable: true,
  clearExpired: true,
  checkExpirationInterval: 15 * 60 * 1000,
  expiration: 8 * ONE_HOUR_MS,
});

const sessionMiddleware = session({
  name: 'conectabem.sid',
  secret: env.session.secret,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: env.app.env === 'production',
    sameSite: 'lax',
    maxAge: 8 * ONE_HOUR_MS,
  },
});

export { sessionMiddleware, sessionStore };