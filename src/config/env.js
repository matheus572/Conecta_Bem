// config/env.js — carrega e normaliza as variáveis de ambiente.
const path = require('node:path');

// Carrega o .env da raiz do projeto, se existir (ex.: execução fora do container).
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

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
  dbTest: {
    host: process.env.DB_TEST_HOST || 'localhost',
    port: parseInt(process.env.DB_TEST_PORT || '3307', 10),
    user: process.env.DB_TEST_USER || 'conectabem_test',
    password: process.env.DB_TEST_PASSWORD || 'conectabem_test_dev',
    database: process.env.DB_TEST_NAME || 'conectabem_test',
  },
};

module.exports = { env };