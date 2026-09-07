# Decisões de Implementação — Changelog

Registro das decisões técnicas tomadas durante o desenvolvimento que **não
estavam explícitas** em `docs/plano-desenvolvimento.md` ou na
`documentacao_conectabem.md`. Cada entrada indica o que foi decidido, o
motivo e onde isso se reflete no código.

---

## Sprint 1 — Autenticação + Cadastros-base

### 1. Beneficiário recebeu soft delete (`ativo` + `deleted_at`)
- **Decisão**: aplicada exclusão lógica também a `beneficiario`.
- **Motivo**: o plano (§2.1) listava "soft delete" para beneficiário, mas a
  documentação (§11.2) exigia exclusão lógica apenas para doadores e
  voluntários, e os RF_05–08 não preveem "excluir". Foi **confirmado com o
  time** (pergunta na conversa) que se usaria `ativo` + `deleted_at`.
- **Detalhamento**: o campo "status" citado na documentação (RF_08, busca por
  status) foi representado pelo próprio `ativo` (TINYINT), usado como filtro
  "ativo/inativo" na listagem. Não foi criado um segundo campo `status` para
  evitar redundância com o `ativo`.
- **Onde**: `migrations/003_beneficiario.sql`, `src/modules/beneficiarios/*`.

### 2. Tabela `atendimento` criada para o histórico (RF_07)
- **Decisão**: nova tabela `atendimento` (`beneficiario_id FK`,
  `data_atendimento`, `descricao`, `observacao`, `usuario_id FK NULL`).
- **Motivo**: RF_07 exige "histórico de atendimentos", mas o modelo conceitual
  (§10) não define essa entidade. Ficou pronta (vazia) para sprints futuras.
- **Onde**: `migrations/005_atendimento.sql`.

### 3. Migração do backend de CommonJS para ESM
- **Decisão**: todo o código-fonte passou de `require`/`module.exports` para
  `import`/`export`, com `"type": "module"` em `package.json`.
- **Motivo**: o `vi.mock` do Vitest não intercepta chamadas `require()` nativas
  em módulos CJS, o que impedia os testes unitários "mockando o repository".
  A conversão para ESM foi a correção definitiva.
- **Detalhes**:
  - `__dirname` substituído por `fileURLToPath(import.meta.url)`.
  - Novo entrypoint `src/server.js` (faz o `listen`); `src/app.js` apenas
    exporta `app` (para Supertest).
  - `migrations/migrate.js` exporta `runMigrations(pool)` e só roda em CLI via
    checagem `import.meta.url === pathToFileURL(process.argv[1])`.
- **Onde**: todo `src/`, `migrations/`, `tests/`, `eslint.config.js`.

### 4. Busca normaliza pontuação de CPF/CNPJ
- **Decisão**: na listagem, quando a busca contém dígitos, o CPF/documento é
  comparado pelo valor apenas numérico (`somenteDigitos(q)`).
- **Motivo**: o CPF/CNPJ é armazenado sem pontuação; buscar por
  `529.982.247-25` não encontrava `52998224725`.
- **Onde**: `beneficiarios.repository.js` (método `list`) e
  `doadores.repository.js` (método `list`).

### 5. Volume anônimo de `node_modules` removido do Docker Compose
- **Decisão**: removido o volume `/app/node_modules`; o entrypoint do `app`
  agora roda `npm install` antes de `migrate`/`seed`/`nodemon`.
- **Motivo**: o volume anônimo persistia dependências desatualizadas entre
  builds (mascarava as novas depêndencias), causando `ERR_MODULE_NOT_FOUND`.
- **Onde**: `docker-compose.yml` (serviço `app`).

### 6. `bcryptjs` (custo 12) em vez de `bcrypt` nativo
- **Decisão**: manutenção do `bcryptjs` (já adotado na Sprint 0).
- **Motivo**: implementação em JS puro, sem compilação nativa, evitando atrito
  com a imagem Alpine.
- **Onde**: `package.json`, `migrations/seed.js`,
  `src/modules/{auth,usuarios}/*` e helpers de teste.

### 7. Recuperação de senha (RF_03) permanece como stub
- **Decisão**: apenas rota `GET /forgot-password` exibindo "em breve", sem
  envio de e-mail.
- **Motivo**: RF_03 depende de SMTP, listado como fora de escopo na
  documentação (§6) e tratado como pergunta em aberto no plano (§9.1).
- **Onde**: `src/modules/auth/auth.routes.js`,
  `src/views/auth/forgot-password.ejs`.

---

## Combinados na conversa, ainda não totalmente refletidos em código

- **Reset de senha manual pelo admin no MVP (RF_03 adiado)**: combinação
  implícita na conversa; ainda **não** há um fluxo de reset no módulo de
  usuários (edição de usuário não altera senha). A confirmar se deve entrar
  como ação do admin em sprint futura.
- **Interpretação de "registro básico" de doadores (§12.2)**: confirmada a
  regra intermediária implementada (Colaborador cadastra/consulta; não
  edita/exclui — 403). Já refletida no código e coberta por teste de
  integração; permanece listada como pergunta em aberto no plano (§9.7) para
  validação final com o stakeholder.