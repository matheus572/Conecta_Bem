// config/env.js — carrega e normaliza as variáveis de ambiente.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Carrega o .env da raiz do projeto, se existir (ex.: execução fora do container).
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

const env = {
  app: {
    port: parseInt(process.env.APP_PORT || '3000', 10),
    name: 'ConectaBem.net',
    env: process.env.APP_ENV || 'development',
  },
  session: {
    secret: process.env.SESSION_SECRET || 'troque-por-um-segredo-aleatorio',
  },
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'conectabem',
    password: process.env.DB_PASSWORD || 'conectabem_dev',
    database: process.env.DB_NAME || 'conectabem',
  },
  mail: {
    host: process.env.SMTP_HOST || 'mailhog',
    port: parseInt(process.env.SMTP_PORT || '1025', 10),
    from: process.env.MAIL_FROM || 'ConectaBem <no-reply@conectabem.net>',
    // URL pública usada nos links de e-mail (recuperação de senha).
    baseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
  },
};

export { env };