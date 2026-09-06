# Plano de Desenvolvimento — ConectaBem.net (Corrente do Bem)

> Fonte de verdade complementar à `documentacao_conectabem.md`. As decisões
> de stack foram confirmadas com o time; as regras de negócio, a modelagem de
> dados e a matriz de permissões seguem o documento de documentação, salvo os
> pontos explícitos nas seções "Riscos" e "Perguntas em aberto" abaixo.

---

## 1. Arquitetura Proposta

### 1.1 Stack e organização

- **Frontend:** server-rendered com **Express + EJS + Bootstrap 5**
  (mobile-first — RNF_05/RNF_08). React/Next.js descartados para esta versão.
- **Acesso a dados:** **mysql2 (SQL puro)**. Todo SQL fica exclusivamente na
  camada `repository` de cada módulo; controllers e services jamais contêm SQL.
- **Linguagem:** **JavaScript + JSDoc** (documentação/tipos sem build step).

**Monorepo simples** (um único repositório Git):

```
Conecta_Bem/
├── docker-compose.yml          # app + db + db-test + adminer + mailhog
├── docker-compose.prod.yml     # produção: app + db + caddy/nginx (HTTPS)
├── Dockerfile
├── .env.example
├── package.json
├── migrations/                 # .sql numerados + runner
│   ├── 001_init.sql
│   └── migrate.js
├── src/
│   ├── app.js                  # bootstrap do Express
│   ├── config/                 # db.js (pool mysql2), env.js, session.js
│   ├── middlewares/            # auth (RN05), authorize(perfil), errorHandler
│   ├── modules/                # um diretório por módulo de negócio
│   │   └── <modulo>/
│   │       ├── <modulo>.routes.js
│   │       ├── <modulo>.controller.js
│   │       ├── <modulo>.service.js
│   │       └── <modulo>.repository.js   # único lugar com SQL
│   ├── views/                  # layouts/ + páginas EJS por módulo
│   ├── public/                 # Bootstrap, css, js do cliente
│   └── utils/                  # validarCpf, validarCnpj, logger, paginacao
└── tests/
    ├── unit/                   # services com repository mockado
    └── integration/            # Supertest + banco de teste
```

### 1.2 Docker Compose (desenvolvimento)

| Serviço | Imagem | Papel |
|---|---|---|
| `app` | `node:20-alpine` (Dockerfile) | Express + EJS, live-reload via nodemon |
| `db` | `mysql:8` | Banco principal, healthcheck, volume nomeado |
| `db-test` | `mysql:8` | Banco efêmero para testes de integração |
| `adminer` | `adminer` | Inspeção visual do banco (só dev) |
| `mailhog` | `mailhog/mailhog` | Captura e-mails em dev (prepara RF_03) |

Em produção, `docker-compose.prod.yml` adiciona **Caddy** (HTTPS automático
com Let's Encrypt — RNF_03).

### 1.3 Camadas e responsabilidades

1. **Routes** — mapeia URL → controller; aplica `requireAuth` (RN05) e
   `authorize('ADMINISTRADOR')` conforme matriz §12.2.
2. **Controller** — valida entrada, chama service, renderiza EJS (padrão
   Post/Redirect/Get).
3. **Service** — regras de negócio (RN01–RN05) e **transações**: `getConnection`
   → `BEGIN` → operações → `COMMIT`/`ROLLBACK` (requisito transacional §2.1).
4. **Repository** — SQL parametrizado (prepared statements do mysql2).

---

## 2. Modelagem do Banco de Dados (derivada de §10 + RN01–RN05)

Convenções: PKs `INT AUTO_INCREMENT`, `created_at`/`updated_at`, exclusão
lógica via `ativo` + `deleted_at` (§11.2 — RF_11, RF_20), charset `utf8mb4`.

### 2.1 Tabelas e constraints principais

1. **`usuario`** — `email UNIQUE NOT NULL`, `senha_hash` (bcrypt), `perfil
   ENUM('ADMINISTRADOR','COLABORADOR')`, `ativo` (RF_04).
2. **`beneficiario`** — `cpf CHAR(11) UNIQUE NOT NULL` (RN04), `situacao_social`,
   `status`, soft delete.
3. **`doador`** — `tipo_doador ENUM('PF','PJ')`, `documento VARCHAR(14) UNIQUE`,
   soft delete (RF_11).
4. **`voluntario`** — `cpf UNIQUE`, `especialidade`, `disponibilidade`, soft
   delete (RF_20).
5. **`doacao`** — `tipo_doacao ENUM(...)`, `data_doacao`, `doador_id FK`, 1:N.
6. **`item_doacao`** — item intermediário de `doacao`→`estoque` (1:N). *Tabela
   não explícita no DER — ver Perguntas em aberto.*
7. **`estoque`** — `nome_item UNIQUE`, `quantidade`, `unidade`, `estoque_minimo`
   (RF_16), `localizacao`.
8. **`distribuicao`** — saída de estoque para beneficiário (RF_15).
9. **`campanha`** — datas + `CHECK data_fim >= data_inicio`, `status`.
10. **`campanha_voluntario`** — N:N com `UNIQUE(campanha_id, voluntario_id)`.
11. **`curso`** — RF_30.
12. **`turma`** — `curso_id FK`, `voluntario_id FK NULL`, `capacidade` (RF_31).
13. **`matricula`** — `UNIQUE(turma_id, beneficiario_id)` para ativa, `status`,
    `quantidade_faltas`.
14. **`frequencia`** — `UNIQUE(matricula_id, data_aula)`.
15. **`certificado`** — `codigo_validacao UNIQUE` (RF_35).

Índices: `beneficiario(nome)`, `matricula(turma_id, status)`,
`doacao(data_doacao, tipo_doacao)`, `distribuicao(beneficiario_id)`.

### 2.2 Regras de negócio → constraints/lógica

| RN | Implementação |
|---|---|
| RN01 (3 faltas) | Service: após inserir frequência, verifica 3 faltas consecutivas por `data_aula`; cancela matrícula na mesma transação (RF_34). |
| RN02 (vagas) | Service com `SELECT ... FOR UPDATE`, conta ativas vs. capacidade; `UNIQUE` como segunda defesa. |
| RN03 (estoque) | Entrada/saída atualiza `estoque.quantidade` na mesma transação. |
| RN04 (CPF único) | `UNIQUE` + validação de dígitos verificadores. |
| RN05 (autenticado) | Middleware `requireAuth` global. |

---

## 3. Ordem de Implementação por Fases

| Sprint | Conteúdo | RF/UC |
|---|---|---|
| **0 — Fundação** | Repo, Compose, migrate, ESLint/Prettier, layout base, seed admin, CI | RNF_07 |
| **1 — Auth + Cadastros-base** | login/logout, usuários, beneficiários, doadores | UC01–UC04 |
| **2 — Doações e Estoque** | entrada/distribuição transacional | UC05, UC06 |
| **3 — Voluntários e Campanhas** | voluntários, N:N campanha, resultados | UC07, UC11 |
| **4 — Cursos e Oficinas** | cursos, turmas, matrícula, frequência, certificados | UC08–UC10, UC13 |
| **5 — Saídas e fechamento** | relatórios, dashboard, alerta estoque, RF_03, LGPD, deploy | UC12, UC14 |

**Definição de MVP — Sprints 0 a 2.**

O critério do MVP **não** é "todos os requisitos de prioridade Alta", e sim o
**fluxo operacional diário básico** da instituição (§1.2, §3.2): autenticar
(RF_01–02), cadastrar e consultar beneficiários e doadores (RF_05–12) e
registrar doações/estoque (RF_13–15). É o conjunto mínimo que substitui os
cadernos e planilhas de hoje.

**Decisão consciente de adiamento:** Campanhas (Sprint 3 — RF_22–25) e
Cursos/Oficinas (Sprint 4 — RF_30–36) contêm requisitos de prioridade Alta
(RF_18, RF_19, RF_22, RF_24, RF_30–33, RF_35), mas foram pospostos porque:
(a) **não fazem parte do atendimento diário mínimo** — o dia a dia da OSC começa
por cadastro de beneficiário e entrada/saída de doações; e (b) **só geram valor
com um conjunto maior de tabelas e regras acopladas** (matrícula exige curso +
turma + beneficiário + RN02; certificado exige frequência acumulada + RN01) —
entregar esses módulos parcialmente não gera valor isolado e compete com o
núcleo do MVP pelo tempo do semestre (§3.1).

Consequência: "prioridade Alta" da §4 orienta a ordem **dentro** de cada
módulo, mas a ordem **entre** módulos é definida pelo fluxo operacional diário.

---

## 4. Mapeamento Documentação → Código

| Módulo doc | Pasta | RF | UC |
|---|---|---|---|
| Autenticação/Acesso | `modules/auth`, `modules/usuarios` | RF_01–04 | UC01, UC02 |
| Beneficiários | `modules/beneficiarios` | RF_05–08 | UC03 |
| Doadores | `modules/doadores` | RF_09–12 | UC04 |
| Doações/Estoque | `modules/doacoes`, `modules/estoque` | RF_13–17 | UC05, UC06 |
| Voluntários | `modules/voluntarios` | RF_18–21, RF_36 | UC07 |
| Campanhas | `modules/campanhas` | RF_22–25 | UC11 |
| Cursos/Oficinas | `modules/cursos` | RF_30–36 | UC08–10, UC13 |
| Relatórios | `modules/relatorios` | RF_26–29a | UC12 |
| Dashboard | `modules/dashboard` | RF_29 | UC14 |

---

## 5. Autenticação e Controle de Acesso

- **Sessões server-side** (express-session + store MySQL), cookie `HttpOnly;
  Secure; SameSite=Lax`, expiração 8h (RF_02, §11.2). Sem JWT nesta versão.
- **bcrypt** custo 12 (`senha_hash`) — RNF_02.
- **Middlewares:** `requireAuth` global (RN05); `authorize(role)` implementando
  §12.2.

**Regra intermediária — Doadores ("Consulta/registro básico", §12.2).**

Diferente de Beneficiários (acesso total aos dois perfis) e de Voluntários
(Admin gerencia, Colaborador só consulta — RF_36), o módulo `doadores` tem um
nível intermediário para o Colaborador:

| Operação | Administrador | Colaborador |
|---|---|---|
| Consultar/pesquisar (RF_12) e histórico (RF_10) | ✅ | ✅ |
| Cadastrar doador PF/PJ (RF_09) | ✅ | ✅ |
| Editar dados (RF_11) | ✅ | ❌ (403) |
| Excluir / exclusão lógica (RF_11, §11.2) | ✅ | ❌ (403) |

Justificativa: o Colaborador registra doações no balcão (RF_F01), o que implica
cadastrar o doador na hora; mas alterar/remover doadores afeta histórico e
rastreabilidade (LGPD, §11.3) e fica restrito ao Administrador. A associação
doador↔doação (RF_13) permanece liberada a ambos (módulo `doacoes`, RF_F01).
Implementação: `GET`/`POST /doadores` liberados; `PUT`/`PATCH`/`DELETE` com
`authorize('ADMINISTRADOR')`.

> *Ponto de validação:* a interpretação de "registro básico" (cadastrar +
> consultar, sem editar/excluir) é uma decisão de implementação — adicionada às
> Perguntas em aberto (seção 9).

Admin-only: usuários (UC02), voluntários (RF_F04), campanhas (UC11),
cursos/turmas (UC08), frequência (RF_F07), certificados (UC13), relatórios
RF_S01/S03. Colaborador: beneficiários, doações, estoque, matrículas (RF_F06),
dashboard, RF_S02 básico, somente GET em cursos/voluntários (RF_36).

---

## 6. RNF na Arquitetura

RNF_01 → índices + paginação (sem cache na v1). RNF_02 → bcrypt. RNF_03 →
Caddy/Let's Encrypt no compose de produção. RNF_04 → soft delete + minimização
+ auditoria. RNF_05 → Bootstrap mobile-first. RNF_06 → cron `mysqldump` diário.
RNF_07 → camadas + JSDoc + ESLint/Prettier. RNF_08 → testes manuais
Chrome/Firefox/Edge. RNF_09 → monólito modular. RNF_10 → Docker.

---

## 7. Plano de Testes

**Vitest + Supertest + `db-test` (Compose).**

- **Unitários (P1):** RN01, RN02, RN03, RN04, hash de senha.
- **Integração (P2):** UC01, matriz §12.2 (403), UC05 ponta-a-ponta, UC09→UC10,
  UC12/UC14.
- **E2E (P3):** Playwright do fluxo feliz; exportação PDF/.xlsx (RF_29a).

---

## 8. Riscos e Pontos em Aberto

1. **SMTP × RF_03** (§6 adia SMTP): MVP com reset manual pelo admin?
2. **`item_doacao`**: DER liga Doação→Estoque 1:N mas não modela itens.
3. **LGPD × preservar histórico** (§11.2): política de anonimização.
4. **Critério de conclusão do certificado (UC13):** "frequência mínima" sem
   percentual definido.
5. **Notificação RN01 (RF_34):** sem SMTP, alerta em tela?
6. **Doação monetária:** `valor` no modelo, mas RF_13 lista só bens.
7. **Estoque mínimo (RF_16):** por item ou por tipo?
8. **Hospedagem** não contratada (§3.3) — afeta RNF_03/RNF_06.

---

## 9. Perguntas para o time antes de iniciar

1. Confirmam reset de senha manual pelo admin no MVP (RF_03 adiado)?
2. Estoque por **item** com `item_doacao` — correto, ou agregado por tipo?
3. Percentual mínimo de frequência para certicado (UC13/RF_35)? Código de
   validação precisa de página pública?
4. Estoque mínimo (RF_16): por item ou por tipo?
5. Confirmação §13: voluntário é entidade sem login (§13.2) e Colaborador não
   emite certificados (§13.3)?
6. Doações em dinheiro entram ou são fora de escopo?
7. "Registro básico" de doadores (§12.2): minha interpretação (cadastrar +
   consultar, sem editar/excluir) está correta?
8. Quem é o encarregado de dados (LGPD) da OSC e qual o prazo de retenção?