import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    setupFiles: ['tests/setup.js'],
    // Os testes de integração compartilham o mesmo banco (db-test); a execução
    // sequencial evita interferência entre arquivos (truncate/reseed).
    fileParallelism: false,
    hookTimeout: 20000,
    testTimeout: 20000,
  },
});