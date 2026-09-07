// tests/setup.js — roda antes de cada arquivo de teste (setupFiles do Vitest).
// Aponta a conexão da aplicação para o banco de teste (db-test) ANTES de o
// `src/config/db.js` ser importado, garantindo isolamento do banco de dev.
process.env.DB_HOST = process.env.DB_TEST_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_TEST_PORT || '3308';
process.env.DB_USER = process.env.DB_TEST_USER || 'conectabem_test';
process.env.DB_PASSWORD = process.env.DB_TEST_PASSWORD || 'conectabem_test_dev';
process.env.DB_NAME = process.env.DB_TEST_NAME || 'conectabem_test';
process.env.APP_ENV = 'test';