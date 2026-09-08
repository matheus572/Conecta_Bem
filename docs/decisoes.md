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

## Sprint 2 — Doações e Estoque

Antes de codar, os três pontos listados como risco no plano (§8 e §9) foram
**confirmados com o time** por meio de pergunta direta. As respostas estão
abaixo e detalham o desenho adotado.

### 8. Estoque controlado por TIPO de doação (não por item)
- **Decisão**: `estoque` é agregado por `tipo_doacao`
  (`ALIMENTOS`, `ROUPAS`, `MOVEIS_UTENSILIOS`, `OUTROS`), com uma linha por
  tipo, `quantidade` (saldo) e `estoque_minimo` (RF_16). Não há `item_doacao`.
- **Motivo**: interpretação mais simples e conservadora que preserva a
  documentação — RF_13 lista apenas tipos (não itens), e o DER (§10.2) liga
  "Uma doação pode atualizar vários itens do estoque" sem nunca modelar os
  itens (pergunta em aberto nº 2 do plano). O controle por item, se necessário,
  fica para sprint futura.
- **Consequência**: os campos `nome_item`/`unidade`/`localizacao` do modelo
  conceitual (§10.1) foram substituídos por uma linha por tipo; `unidade` é
  tratada como "unidades" genéricas.
- **Onde**: `migrations/007_estoque.sql`, `src/modules/estoque/*`.

### 9. Doações em dinheiro fora do escopo desta sprint
- **Decisão**: doação monetária **não** entra na Sprint 2. A coluna `valor`
  existe em `doacao` (NULL, não exposta nas telas) para preservar o modelo
  conceitual, mas não há fluxo de entrada de dinheiro.
- **Motivo**: RF_13 lista apenas bens (alimentos, roupas, móveis e utensílios,
  outros); "doação monetária" já estava como pergunta em aberto no plano
  (§9.6/§8.6). Além disso, dinheiro não gera estoque por tipo, o que exigiria
  regras próprias fora do escopo atual.
- **Onde**: `migrations/006_doacao.sql` (coluna `valor` reservada).

### 10. Estoque mínimo (RF_16/RF_S04) por TIPO
- **Decisão**: `estoque_minimo` é um valor por tipo de doação, editável na tela
  de estoque. Alerta visual ("Estoque abaixo do mínimo") quando
  `quantidade < estoque_minimo`; sem notificação por e-mail (SMTP fora do MVP).
- **Motivo**: acompanha a granularidade por tipo decidida acima; RF_16 fala em
  "estoque de determinado tipo de doação".
- **Onde**: `src/modules/estoque/*`, `src/views/estoque/list.ejs`.

### 11. "Status" do RF_17 interpretado como status do estoque
- **Decisão**: a filtragem por "tipo, período e **status**" (RF_17) foi
  distribuída da seguinte forma: listas de doações e de distribuições filtram
  por tipo + período (data inicial/final); a tela de estoque filtra por tipo +
  status ("dentro do mínimo" / "abaixo do mínimo").
- **Motivo**: com estoque agregado por tipo, a doação/distribuição não possui
  um campo "status" próprio no modelo; o "status" mais natural do módulo é a
  condição do estoque (RF_S04). Registrado como interpretação a validar.
- **Onde**: `src/modules/doacoes/doacoes.controller.js`,
  `src/modules/estoque/estoque.controller.js`.

### 12. Transações com `conn` opcional nos repositories
- **Decisão**: os métodos de escrita dos repositories de doações/estoque
  recebem uma `conn` opcional (default `pool`); o service obtém
  `pool.getConnection()` → `beginTransaction` → operações → `commit`/`rollback`,
  e a leitura de saldo da distribuição usa `SELECT ... FOR UPDATE`.
- **Motivo**: manter "SQL só no repository" (§1.3) e ao mesmo tempo permitir
  transações reais e bloqueio de linha (RN03 / seção 2 do plano), evitando
  condição de corrida entre duas distribuições simultâneas.
- **Onde**: `src/modules/estoque/estoque.repository.js`,
  `src/modules/doacoes/doacoes.{repository,service}.js`.

### 13. `decimalNumbers: true` no pool do mysql2
- **Decisão**: habilitado `decimalNumbers: true` na configuração do pool.
- **Motivo**: colunas `DECIMAL` (quantidade/estoque_minimo) retornavam como
  string por padrão no mysql2, complicando comparações (saldo vs. quantidade) e
  soma/subtração. A conversão nativa para `Number` simplificou a lógica de RN03.
- **Onde**: `src/config/db.js`.

---

## Sprint 3 — Voluntários e Campanhas

### 14. Colaborador sem NENHUM acesso ao módulo de campanhas (nem leitura)
- **Decisão**: todas as rotas de `/campanhas` exigem `authorize('ADMINISTRADOR')`;
  o Colaborador recebe 403 em qualquer rota (inclusive `GET`).
- **Motivo**: o plano (§5) declara campanhas como "Admin-only (UC11)"; o ator do
  UC11 é apenas o Administrador. A matriz §12.2 de "Funções do Produto" indica
  "Somente consulta/participação" para o Colaborador, mas diverge do texto
  descritivo (§13.3) e do plano — prevaleceu a leitura mais restritiva do plano.
  Também reforçado pelo critério de aceite desta sprint ("não consegue acessar
  nenhuma rota de gestão de campanhas").
- **Ponto a confirmar**: se o stakeholder quiser liberar alguma visualização
  básica de campanhas ao Colaborador, basta trocar o `router.use(authorize(...))`
  por `authorize` apenas nas rotas de escrita.
- **Onde**: `src/modules/campanhas/campanhas.routes.js`.

### 15. Voluntários: Colaborador somente leitura (RF_36/§12.2)
- **Decisão**: `GET` de voluntários liberado para ambos os perfis; escrita
  (`POST`/`PUT`/`DELETE`) restrita ao Administrador (403 para Colaborador).
- **Motivo**: matriz §12.2 ("Gerenciar Voluntários": X / Somente consulta) e
  RF_36 ("Colaboradores consultam, sem gerenciar, voluntários"). Diferente de
  doadores, o Colaborador **não** cadastra voluntários.
- **Onde**: `src/modules/voluntarios/voluntarios.routes.js`.

### 16. Nomenclatura e campos de voluntário/campanha
- **Decisão**: `voluntario.especialidade` representa as "habilidades" (RF_18) e
  `voluntario.disponibilidade` os "horários" (RF_18); `campanha.titulo` em vez
  de `nome_campanha` (o RF_22 fala em "título"), com `descricao`, `data_inicio`,
  `data_fim` e `status ENUM('PLANEJADA','ATIVA','ENCERRADA')`.
- **Motivo**: seguir o texto dos RF/UC em vez do modelo conceitual (§10),
  mantendo o vocabulário do requisito.
- **Busca (RF_21)**: um único campo `q` pesquisa por nome, habilidade
  (especialidade), disponibilidade e CPF — cobrindo "nome/habilidade/
  disponibilidade" sem sobrecarregar a tela com três filtros.
- **Onde**: `migrations/009_voluntario.sql`, `migrations/010_campanha.sql`,
  `src/modules/voluntarios/*`.

### 17. Resultados de campanha reaproveitam `atendimento` e `distribuicao`
- **Decisão**: RF_24 (beneficiários atendidos + doações distribuídas) é atendido
  adicionando FK opcional `campanha_id` nas tabelas existentes `atendimento`
  (beneficiário atendido) e `distribuicao` (doação distribuída) — sem nova
  entidade redundante.
- **Motivo**: "reaproveite as entidades já existentes, apenas referencie/
  associe" (instrução da sprint). A distribuição reusa o fluxo transacional de
  `doacoes` (RN03, `registrarDistribuicao` ganhou um parâmetro `campanhaId`);
  o atendimento usa a tabela `atendimento` (criada vazia na Sprint 1).
- **Onde**: `migrations/012_campanha_resultados.sql`,
  `src/modules/doacoes/doacoes.{service,repository}.js`,
  `src/modules/campanhas/campanhas.{repository,service}.js`.

### 18. Exclusão de campanha é física (sem soft delete)
- **Decisão**: `DELETE` de campanha é físico, com `ON DELETE CASCADE` em
  `campanha_voluntario` e `ON DELETE SET NULL` nas FKs de resultado
  (`atendimento.campanha_id`, `distribuicao.campanha_id`).
- **Motivo**: a exclusão lógica obrigatória (§11.2) vale para doadores e
  voluntários; campanhas não são citadas, e preservar o vínculo de resultado via
  `SET NULL` mantém o histórico sem "pendurar" o registro excluído.
- **Onde**: `migrations/010_campanha.sql`, `migrations/011_campanha_voluntario.sql`,
  `migrations/012_campanha_resultados.sql`.

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