// server.js — entrypoint HTTP da aplicação (inicia o servidor).
import { app } from './app.js';
import { env } from './config/env.js';

app.listen(env.app.port, () => {
  console.log(`[app] ${env.app.name} rodando em http://localhost:${env.app.port}`);
});