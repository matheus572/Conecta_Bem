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

### 8. ~~Estoque controlado por TIPO de doação (não por item)~~ — ✅ SUPERADA na Sprint 6
- **Decisão (Sprint 2, SUPERADA)**: `estoque` era agregado por `tipo_doacao`
  (`ALIMENTOS`, `ROUPAS`, `MOVEIS_UTENSILIOS`, `OUTROS`), com uma linha por
  tipo, `quantidade` (saldo) e `estoque_minimo` (RF_16). Não havia
  `item_doacao`.
- **Motivo da decisão original**: interpretação mais simples e conservadora —
  RF_13 lista apenas tipos (não itens). O controle por item ficou explícito
  como evolução de sprint futura.
- **Superssão**: na Sprint 6 o time confirmou a necessidade de granularidade
  por item (ver **decisão nº 33**, adiante). A tabela `estoque` por tipo foi
  renomeada para `estoque_legado` (read-only) e recriada por `item_id`.
- **Consequência que permanece**: o campo `localizacao` do modelo conceitual
  (§10.1) segue fora de escopo; `unidade` voltou, agora por item
  (`item_doacao.unidade`).

### 9. Doações em dinheiro fora do escopo desta sprint
- **Decisão**: doação monetária **não** entra na Sprint 2. A coluna `valor`
  existe em `doacao` (NULL, não exposta nas telas) para preservar o modelo
  conceitual, mas não há fluxo de entrada de dinheiro.
- **Motivo**: RF_13 lista apenas bens (alimentos, roupas, móveis e utensílios,
  outros); "doação monetária" já estava como pergunta em aberto no plano
  (§9.6/§8.6). Além disso, dinheiro não gera estoque por tipo, o que exigiria
  regras próprias fora do escopo atual.
- **Onde**: `migrations/006_doacao.sql` (coluna `valor` reservada).

### 10. Estoque mínimo (RF_16/RF_S04) — anotado na Sprint 6: agora por ITEM
- **Decisão**: `estoque_minimo` é editável na tela de estoque. Alerta visual
  ("Estoque abaixo do mínimo") e indicador do dashboard quando
  `quantidade < estoque_minimo`; sem notificação por e-mail.
- **Atualização (Sprint 6)**: a chave deixou de ser o tipo e passou a ser o
  **item** (`estoque.item_id` → `item_doacao`), acompanhando a nº 33. O badge
  e o card do dashboard mostram o **nome do item**, não mais o tipo.
- **Onde**: `src/modules/estoque/*`, `src/views/estoque/list.ejs`,
  `src/modules/dashboard/*`.

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

## Sprint 4 — Cursos, Oficinas e Certificação

Os três pontos em aberto desta sprint (plano §8 itens 4 e 5; plano §9.3) foram
**confirmados com o time** antes de codar, via pergunta direta:

### 19. Frequência mínima para certificado: 75%
- **Decisão**: frequência mínima de **75%** (presenças ÷ aulas lançadas do
  aluno) para o aluno ser considerado concluinte/apto ao certificado
  (UC13/RF_35). A documentação não definia número (ponto em aberto §13/§8.4 do
  plano).
- **Detalhamento**: mínimo de 1 aula lançada (0 aulas ⇒ 0% ⇒ não apto).
  Constante `FREQUENCIA_MINIMA_CERTIFICADO = 0.75` no service.
- **Onde**: `src/modules/certificados/certificados.service.js`,
  `tests/unit/certificados.service.test.js`.

### 20. Certificado sem página pública de validação nesta sprint
- **Decisão**: o `codigo_validacao` (único, RF_35) é exibido apenas na tela do
  Administrador (lista de certificados da turma). A página pública de consulta
  (sem login) fica para sprint futura (provável Sprint 5).
- **Motivo**: escopo mínimo confirmado; o código já existe no banco e é único,
  então a página pública é aditiva e não exige retrabalho.

### 21. Notificação de RN01 (RF_34) = alerta em tela para o administrador
- **Decisão**: ao cancelar a matrícula por 3 faltas consecutivas, o sistema
  exibe **alerta em tela (flash) para o administrador** que lançou a
  frequência, informando o cancelamento e a liberação da vaga. Também há
  indicação visual na lista de alunos da turma ("cancelamento por 3 faltas
  consecutivas — RN01").
- **Motivo**: SMTP está fora do escopo desta versão (§6 da documentação e
  decisão nº 7) — o desfecho é análogo ao alerta de estoque mínimo (nº 10) e
  ao stub de RF_03. Quando houver SMTP, o ponto de gancho é o controller de
  frequência (o service já devolve a lista de matrículas canceladas).
- **Onde**: `src/modules/frequencia/frequencia.{service,controller}.js`.

### 22. RN01 conta faltas CONSECUTIVAS por `data_aula`
- **Decisão**: após cada falta, o service busca os 3 últimos lançamentos da
  matrícula (ordenados por `data_aula` DESC) e cancela somente se os 3 forem
  faltas. Uma presença quebra a sequência (falta-presença-falta não cancela).
  `matricula.quantidade_faltas` é mantido como total de faltas (recalculado a
  cada falta) apenas para exibição — **não** é a base da RN01.
- **Onde**: `frequencia.service.js` (`atingiuFaltasConsecutivas`, função pura),
  `frequencia.repository.js` (`ultimasFrequencias`).

### 23. Coluna gerada para garantir 1 matrícula ATIVA por beneficiário/turma
- **Decisão**: `UNIQUE(turma_id, beneficiario_id)` "para ativa" (plano §2.1
  #13) foi implementada com a coluna gerada `beneficiario_ativo_id`
  (`IF(status='ATIVA', beneficiario_id, NULL)`, STORED) + `UNIQUE(turma_id,
  beneficiario_ativo_id)`, pois o MySQL não tem índice parcial.
- **Motivo**: UNIQUE ignora duplicatas de NULL, então matrículas CANCELADA/
  CONCLUIDA não bloqueiam rematrícula — requisito do fluxo UC09→UC10 (a vaga é
  liberada para nova matrícula após o cancelamento automático).
- **Onde**: `migrations/016_matricula.sql`.

### 24. Curso/turma com exclusão física bloqueada por dependência
- **Decisão**: `DELETE` de curso falha com mensagem clara se houver turmas;
  `DELETE` de turma falha se houver matrículas. Sem soft delete (documentação
  só exige exclusão lógica para doadores/voluntários — §11.2; mesmo padrão de
  campanhas, decisão nº 18).
- **Onde**: `src/modules/cursos/cursos.service.js`.

### 25. Critério de elegibilidade do certificado (UC13)
- **Decisão**: apto = turma **ENCERRADA** **e** matrícula ATIVA/CONCLUIDA (nunca
  CANCELADA) **e** frequência ≥ 75% **e** sem certificado emitido. Ao emitir,
  matrícula ATIVA passa a CONCLUIDA na mesma transação.
- **Motivo**: combina a pré-condição do UC13 ("matrícula concluída/frequência
  mínima") com o fluxo da tela ("seleciona turma/curso concluído") sem exigir
  um passo manual extra de "concluir matrículas" — fora do escopo da sprint.
- **Onde**: `certificados.service.js` (`listarElegibilidade`, `emitir`).

- **Reset de senha manual pelo admin no MVP (RF_03 adiado)**: combinação
  implícita na conversa; ainda **não** há um fluxo de reset no módulo de
  usuários (edição de usuário não altera senha). A confirmar se deve entrar
  como ação do admin em sprint futura.
- **Interpretação de "registro básico" de doadores (§12.2)**: confirmada a
  regra intermediária implementada (Colaborador cadastra/consulta; não
  edita/exclui — 403). Já refletida no código e coberta por teste de
  integração; permanece listada como pergunta em aberto no plano (§9.7) para
  validação final com o stakeholder.

---

## Sprint 5 — Saídas e Fechamento

### 26. Mailhog conta como "SMTP disponível" para RF_03 em dev
- **Decisão**: RF_03 (recuperação de senha) foi implementada de fato — fluxo
  completo de "esqueci minha senha" com token de expiração curta (**30 min**),
  envio por e-mail via **Mailhog** em dev. Em produção, RF_03 fica **pendente
  da configuração de um provedor SMTP real** (variáveis `SMTP_*` em
  `docs/deploy.md`).
- **Motivo**: confirmado com o time nesta sprint; o Mailhog estava disponível
  no docker-compose desde a Sprint 0 ("prepara RF_03", plano §1.2). Substitui a
  decisão nº 7 (stub "em breve").
- **Detalhamento**: o token é `randomBytes(32)` hex e é persistido apenas como
  hash SHA-256 (`password_reset.token_hash`); só o link mais recente é válido
  (tokens anteriores do usuário são invalidados); a resposta da solicitação é
  **neutra** (idêntica para e-mail inexistente — não vaza existência de conta,
  LGPD §11.3). Em `APP_ENV=test` os e-mails não são enviados: ficam em uma
  outbox em memória (`src/utils/mailer.js`) para os testes de integração.
- **Onde**: `migrations/019_password_reset.sql`, `src/config/env.js` (bloco
  `mail`), `src/utils/mailer.js`, `src/modules/auth/*`,
  `src/views/auth/{forgot-password,reset-password}.ejs`,
  `tests/{unit/auth.reset,integration/auth}.test.js`.

### 27. LGPD: apenas auditoria + autorização por perfil; retenção pendente
- **Decisão**: nesta sprint foram implementados apenas (a) o **middleware de
  auditoria** (§11.3) e (b) a **revisão da autorização por perfil**. Nenhuma
  rotina de expurgo/anonimização foi criada — a **política de retenção de
  dados pessoais (RNF_04) ficou pendente de definição pelo stakeholder** (o
  briefing proibia implementar política própria).
- **Detalhamento da auditoria de autorização (revisão, sem código novo)**:
  `requireAuth` global (RN05) protege todas as rotas autenticadas;
  `authorize('ADMINISTRADOR')` cobre usuários, campanhas (decisão nº 14),
  frequência, certificados, cursos/turmas (escrita) e relatórios RF_S01/S03;
  a regra intermediária de doadores (§5 do plano) e a consulta liberada de
  cursos/voluntários (RF_36) foram confirmadas. Nenhum endpoint de dados
  sensíveis (situação socioeconômica, CPF/CNPJ) acessível fora do perfil.
- **Detalhamento do log**: `audit_log` grava apenas **metadados** (usuário,
  ação, entidade, id, rota/timestamp) — nunca o payload sensível (CPF,
  situação social), por minimização; falhas de gravação não derrubam a
  requisição (log no stderr); acessos negados (403) não são registrados como
  edição (o middleware vem depois do `authorize`).
- **Onde**: `migrations/020_audit_log.sql`, `src/middlewares/audit.js`,
  rotas de `beneficiarios`/`doadores`, `tests/integration/auditoria.test.js`.

### 28. Backup RNF_06: script + cron; responsável operacional pendente
- **Decisão**: `scripts/backup.sh` (mysqldump diário comprimido, retenção de
  7 dias) + instruções de cron em `docs/deploy.md`. O **responsável técnico
  por acompanhar os backups em produção ficou pendente** de definição pelo
  stakeholder (decisão operacional, não de código) — registro também em
  `docs/deploy.md` (seção 4).
- **Onde**: `scripts/backup.sh`, `docs/deploy.md`.

### 29. Validação pública de certificado fica FORA do escopo
- **Decisão**: confirmada com o time — a página pública de consulta por
  `codigo_validacao` (antevista na decisão nº 20) **não** entra na Sprint 5;
  o código continua visível apenas ao Administrador.
- **Motivo**: o escopo da Sprint 5 é consolidação e saída de dados; nenhuma
  entidade/funcionalidade nova fora do briefing.

### 30. RF_S02 "básico" para Colaborador = mesmo relatório, único acessível
- **Decisão**: o relatório de atendimentos (RF_27) é **idêntico** para ambos
  os perfis (listagem e exportação), sem mascaramento de colunas — o relatório
  não expõe dado que o Colaborador já não tenha acesso via UC03/UC05.
  "Versão básica" foi interpretada como "o único relatório acessível ao perfil".
  Restrição permanece para doações (RF_S01) e campanhas (RF_S03): 403.
- **Motivo**: confirmado com o time nesta sprint.
- **Onde**: `src/modules/relatorios/*`, `tests/integration/relatorios.test.js`.

### 31. Dashboard calcula tudo das tabelas existentes (sem tabelas novas)
- **Decisão**: os 4 indicadores (RF_29) e o alerta de estoque mínimo (RF_16)
  são agregações ao vivo — nenhuma "tabela-resumo" foi criada, conforme o
  briefing. Com a base vazia, a view exibe indicadores zerados com mensagem
  orientativa (fluxo alternativo do UC14), nunca erro.
- **Onde**: `src/modules/dashboard/*`, `src/views/dashboard/index.ejs`.

### 32. `trust proxy` em produção (sessão Secure atrás do Caddy)
- **Decisão**: `app.set('trust proxy', 1)` quando `APP_ENV=production`.
- **Motivo**: sem isso, o Express (atrás do Caddy) tratando a conexão como
  HTTP simples não enviava o cookie de sessão com `Secure`, quebrando o
  login em produção. Detectado no teste de fumaça do compose de produção.
- **Onde**: `src/app.js`.

---

## Sprint 6 — Refatoração do estoque para granularidade por item

### 33. Estoque passa a ser por ITEM (supera a decisão nº 8)
- **Decisão**: confirmada com o time. Nova tabela `item_doacao` (`nome_item`,
  `tipo_doacao`, `unidade`, `ativo`, com `UNIQUE(nome_item, tipo_doacao)`) +
  `estoque` recriada por `item_id`. `doacao`/`distribuicao` ganham `item_id`
  FK e PASSAM a preenchê-lo — `tipo_doacao` continua gravado e é DERIVADO do
  item (preserva agregados por tipo, RF_26).
- **Modelagem incremental**: `RENAME estoque → estoque_legado` (preservada
  read-only como referência auditável da migração — confirmado com o time) +
  `CREATE estoque` por item; ALTERs em `doacao`/`distribuicao`. Constraints de
  CHECK novas receberam nomes distintos (o InnoDB exige unicidade por schema —
  o rename preserva as da tabela legada).
- **CRUD de itens**: criar/editar/desativar somente ADMINISTRADOR (Consulta
  liberada); criação do item cria a linha de estoque zerada na mesma transação;
  desativação é soft (item some dos <select>, histórico preservado); o **tipo
  do item não é editável** pós-criação (alterar deslocaria saldos entre tipos
  — criar um item novo e desativar o antigo).
- **Onde**: `migrations/021`-`024`, `src/modules/estoque/*`,
  `src/modules/doacoes/*`, `src/modules/campanhas/*` (Resultados RF_24
  selecionam item), views correspondentes.

### 34. Dados históricos: item genérico "Outros [tipo]" recebe o saldo (backfill documentado)
- **Decisão**: confirmada com o time. Na migration `024_backfill_item_generico.sql`,
  para cada tipo é criado o item genérico (`NOME_ITEM_GENERICO` em
  `src/utils/tiposDoacao.js` — deve espelhar a migration); o saldo e o mínimo
  por tipo de `estoque_legado` migram para a linha do genérico; doações e
  distribuições históricas (`item_id NULL`) são vinculadas a ele. O genérico
  permanece disponível como catch-all; novas movimentações referenciam item
  específico.
- **Motivo**: movimentações pré-Sprint 6 só tinham tipo — atribuí-las a um item
  específico inventaria informação (briefing). Nenhum dado é apagado: o saldo
  total é preservado e verificável contra `estoque_legado`.
- **Nota**: nomes com pequenos ajustes gramaticais ao padrão literal proposto
  ("Outros [tipo]"): `Outros Alimentos`, `Outros Roupas`,
  `Outros Móveis e utensílios`, `Outros (diversos)` para o tipo `OUTROS`
  (evitar "Outros Outros").
- **Onde**: `migrations/024_backfill_item_generico.sql`,
  `tests/integration/migracao-estoque.test.js` (reproduz o schema legado em um
  banco descartável do db-test e verifica backfill + preservação).

### 35. Relatório de doações (RF_26) com os dois níveis na mesma tela
- **Decisão**: confirmada com o time. Padrão continua consolidado por tipo
  (compatível com Sprint 5), com segunda seção "Detalhamento por item" na tela
  e nas exportações (PDF/xlsx ganham seções/abas). Sem mudança de URL/filtros.
- **Onde**: `src/modules/relatorios/*`, `src/utils/exportacao.js`,
  `src/views/relatorios/doacoes.ejs`.

### 36. migrate.js ganha pool dedicado com `multipleStatements`
- **Decisão**: `migrations/migrate.js` cria pool próprio (via `src/config/env.js`)
  com `multipleStatements: true`; o pool da aplicação (`src/config/db.js`)
  segue sem essa opção (a opção liga-se por conexão, não por configuração de
  pool do app — mantemos o app minimamente restrito).
- **Motivo**: migrations da Sprint 6 executam vários statements por arquivo
  (ALTER + backfill), como passo documentado exigido pelo briefing.
- **Onde**: `migrations/migrate.js` (assinatura `runMigrations(pool?)` preservada).

### 37. docker-compose.yml dev aponta para o stage `development` do Dockerfile
- **Decisão**: `build.target: development` no compose de desenvolvimento.
- **Motivo**: com o Dockerfile multi-stage da Sprint 5, um build sem target
  cai no último stage (`production`, `NODE_ENV=production`), e o
  `npm install` do entrypoint REMOVIA devDependencies do volume `node_modules`
  (vitest sumia). Detectado e corrigido nesta sprint.
- **Onde**: `docker-compose.yml`.

---

## Sprint 7 — Registro de doação com item digitado e criação automática

### 38. COLABORADOR pode criar item novo pelo formulário de doação
- **Decisão**: confirmada com o time (refina a nº 33). O `COLABORADOR` cria
  item NÃO pelo CRUD administrativo, mas como efeito do registro de doação
  recebida (RF_F01 é X/X na matriz §12.2). Editar, renomear e desativar itens
  continuam restritos ao ADMINISTRADOR (demo/teste: 403 em `/estoque/itens`).
- **Onde**: `doacoes.service.js` → `estoque.service.resolverOuCriarItem`;
  `tests/integration/doacao-criacao-item.test.js`.

### 39. Mesmo nome em categoria diferente é rejeitado (constraint intacta)
- **Decisão**: confirmada com o time. A `UNIQUE(nome_item, tipo_doacao)` NÃO
  mudou; o service rejeita com "Já existe o item 'X' na categoria Y.
  Selecione essa categoria ou use outro nome". A busca por nome é em QUALQUER
  categoria justamente para detectar esse conflito antes do INSERT.
- **Onde**: `estoque.service.resolverOuCriarItem` (erroItemEmOutraCategoria).

### 40. Item desativado é reativado na transação da doação (+auditoria)
- **Decisão**: confirmada com o time. Se o item existe com `ativo = 0`, a
  doação o reativa DENTRO da transação (a doação real aconteceu: o saldo
  precisa existir) e grava `EDICAO` em `audit_log` com o usuário responsável.
  A criação de item novo também é auditada (`CRIACAO`). A gravação usa
  `utils/auditoria.js` (extraída do middleware — o log roda na mesma
  conexão da transação, então falha do rollback apaga o log junto).
- **Onde**: `src/utils/auditoria.js`, `src/middlewares/audit.js`,
  `src/modules/estoque/estoque.service.js` (reativarItem).

### 41. Unidade por select (UN/KG/G/L/ML/CX/PCT/PAR), UN como padrão
- **Decisão**: confirmada com o time. Pedida só na criação de item pelo
  formulário de doação; para item existente é exibida e não editável (o
  service ignora a unidade do form quando o item já existe).
- **Onde**: `src/utils/tiposDoacao.js` (`UNIDADES_ITEM`), `views/doacoes/form.ejs`.

### 42. Collation verificada: `nome_item` ignora caixa E acentos
- **Verificação empírica** (MySQL 8 do docker-compose.dev), com a consulta
  sugerida pelo time:
  ```
  SELECT 'leite 1l' = 'Leite 1L'  COLLATE utf8mb4_unicode_ci; -- 1 (ignora caixa)
  SELECT 'feijao'  = 'feijão'     COLLATE utf8mb4_unicode_ci; -- 1 (ignora ACENTO)
  ```
  A coluna `item_doacao.nome_item` é `utf8mb4_unicode_ci` (padrão da tabela),
  então a deduplicação por nome — inclusive a UNIQUE — ignora caixa e acentos.
  Consequência prática: "Feijão 1kg" e "FEIJAO 1kg" são o mesmo item (coberto
  por teste de integração).

### 43. Concorrência na criação de item: ER_DUP_ENTRY + re-busca FOR UPDATE
- **Decisão técnica**: duas doações simultâneas com o mesmo nome novo NÃO
  podem gerar erro 500 nem itens duplicados. O primeiro fluxo tentado
  (lookup com `FOR UPDATE` direto) causava DEADLOCK (gap locks + intenções de
  inserção empatadas). Solução: lookup comum → INSERT otimista → em
  `ER_DUP_ENTRY` (a UNIQUE serializa) re-buscar com `FOR UPDATE`. Ponto
  sutil: em REPEATABLE READ o SELECT comum usa o snapshot do início da
  transação e não enxerga o row commitado pela outra transação DEPOIS — o
  FOR UPDATE força leitura atual. Coberto por teste executando a corrida
  2×/3× em sequência.
- **Onde**: `estoque.service.resolverOuCriarItem`,
  `tests/integration/doacao-criacao-item.test.js`.