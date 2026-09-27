# Deploy em produção — ConectaBem.net

> Guia passo a passo para subir o ambiente de produção (app + db + Caddy com
> HTTPS automático — RNF_03) e operar o backup diário (RNF_06). Complementa o
> `docs/plano-desenvolvimento.md` (§1.2 e §6).

---

## 1. Pré-requisitos

- Servidor Linux (VPS) com Docker + Docker Compose;
- Portas 80 e 443 liberadas no firewall;
- **Domínio (ex.: `app.suaorg.org.br`) com DNS tipo A apontando para o IP do
  servidor** — obrigatório para o certificado real do Let's Encrypt;
- Um provedor SMTP real (ex.: serviço de e-mail transacional) para a recuperação
  de senha (RF_03). Em dev usa-se o Mailhog; em produção é preciso configurar
  as variáveis `SMTP_*` (ver decisão da Sprint 5 em `docs/decisoes.md`).

### 1.1 Teste local (sem domínio real)

Sem DNS público o Let's Encrypt não consegue emitir certificado. Para validar o
stack localmente, use `DOMAIN=localhost`: o Caddy usa seu **certificado interno
(autoassinado)** e o navegador exibirá aviso de segurança (comportamento
esperado em teste). Para máquinas distantes, ajuste as portas com `HTTP_PORT`/
`HTTPS_PORT` caso 80/443 estejam ocupadas.

---

## 2. Variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto (ao lado do
`docker-compose.prod.yml`). Consulte `.env.example` para o modelo completo.

| Variável | Obrigatória? | Observação |
|---|---|---|
| `MYSQL_ROOT_PASSWORD` | ✅ | senha root do MySQL |
| `DB_NAME` / `DB_USER` | opcional | defaults: `conectabem` |
| `DB_PASSWORD` | ✅ | senha do usuário `DB_USER` |
| `SESSION_SECRET` | ✅ | valor aleatório longo (ex.: `openssl rand -hex 32`) |
| `DOMAIN` | ✅ | `app.suaorg.org.br` (ou `localhost` em teste) |
| `ACME_EMAIL` | ✅ | e-mail usado no registro do certificado (Let's Encrypt) |
| `APP_BASE_URL` | ✅ | ex.: `https://app.suaorg.org.br` — monta os links dos e-mails |
| `SMTP_HOST` / `SMTP_PORT` | ✅ (para RF_03) | provedor SMTP real (ver nota acima) |
| `MAIL_FROM` | opcional | remetente dos e-mails |
| `ADMIN_EMAIL` / `ADMIN_NAME` | opcional | admin inicial |
| `ADMIN_PASSWORD` | ✅ no 1º boot | cria o admin uma única vez (seed é idempotente); pode ser removida depois |
| `HTTP_PORT` / `HTTPS_PORT` | opcional | default 80/443 (ajuste em teste local) |
| `BACKUP_DIR` | opcional | pasta dos dumps (default `./backups`) |

Sem os valores obrigatórios, o `docker compose` falha já na validação
(interpolador `?`), o que é intencional — não há defaults inseguros.

---

## 3. Subindo o ambiente

```bash
# 1. Clone o repositório e entre na pasta
cd Conecta_Bem

# 2. Crie o .env (ver seção 2)
cp .env.example .env && editor .env

# 3. Suba os serviços (app é construído com o stage "production" do Dockerfile,
#    sem devDependencies; migrations e seed rodam a cada start — idempotentes)
docker compose -f docker-compose.prod.yml up -d --build

# 4. Acompanhe o primeiro boot (migrations aplicadas, seed do administrador)
docker compose -f docker-compose.prod.yml logs -f app

# 5. Verifique
curl -I https://$DOMAIN/login
```

O Caddy emite e renova o certificado automaticamente na primeira requisição
HTTPS. O banco (`db`) **não** tem porta publicada no host — só acessível pela
rede interna do compose; a `app` também só é exposta via Caddy.

Teste local rápido (certificado autoassinado):

```bash
DOMAIN=localhost ACME_EMAIL=test@localhost HTTP_PORT=8081 HTTPS_PORT=8443 \
SESSION_SECRET=troque-este-segredo MYSQL_ROOT_PASSWORD=root_teste \
DB_PASSWORD=db_teste SMTP_HOST=mailhog APP_BASE_URL=https://localhost:8443 \
ADMIN_PASSWORD=admin123 \
docker compose -f docker-compose.prod.yml -p conectabem-prod up -d --build
```

> Trocar a senha do administrador: entre em `/usuarios` como admin.

---

## 4. Backup diário (RNF_06)

O script `scripts/backup.sh` gera um `mysqldump` comprimido do banco com
**retenção de 7 dias** (dumps mais antigos são apagados automaticamente).

Agende no cron do host:

```bash
# todo dia às 02h00
0 2 * * * /caminho/para/Conecta_Bem/scripts/backup.sh >> /var/log/conectabem-backup.log 2>&1
```

Deixe a pasta de destino persistente — idealmente sincronizada para armazenamento
em nuvem (risco "perda de dados — alto", §1.5; §11.2 recomenda nuvem).

### Restauração

```bash
gunzip -c backups/conectabem_YYYYMMDD_HHMMSS.sql.gz \
  | docker compose -f docker-compose.prod.yml exec -T db \
      mysql -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME"
```

> **Pendente operacional (Sprint 5):** quem é o responsável técnico por
> acompanhar diariamente o log de backup e testar restaurações ainda precisa
> ser definido pela entidade — ver `docs/decisoes.md`. Manutenções/atualizações
> devem ocorrer fora do horário de funcionamento e sempre após backup (§11.2;
> janela de manutenção nos finais de semana — RNF_06).

---

## 5. Estrutura de serviços (docker-compose.prod.yml)

| Serviço | Imagem | Papel |
|---|---|---|
| `app` | build local (stage `production`) | Express + EJS; migrations+seed no start |
| `db` | `mysql:8` | banco principal; sem porta pública |
| `caddy` | `caddy:2-alpine` | HTTPS (Let's Encrypt/autoassinado) + `reverse_proxy` |

Volumes: `db_data_prod` (MySQL), `caddy_data`/`caddy_config` (certificados).

---

## 6. LGPD em produção (RNF_04)

- Dados pessoais restritos por perfil (matriz §12.2) e auditados via
  `audit_log` (consultas e edições de beneficiários/doadores);
- O log guarda apenas metadados (quem/quando/o quê), nunca o payload sensível;
- **Política de retenção/expurgo de dados pessoais pendente de definição pelo
  stakeholder** — nenhuma rotina automática foi implementada sem essa definição
  (ver `docs/decisoes.md`, Sprint 5).
