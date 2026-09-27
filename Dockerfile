# Imagem base (desenvolvimento) — o docker-compose.yml sobrescreve o CMD com
# npm install + migrate + seed + nodemon. Para produção, ver o stage abaixo,
# usado pelo docker-compose.prod.yml (Sprint 5).
FROM node:20-alpine AS development

WORKDIR /app

# Copia apenas os manifestos para aproveitar o cache de camadas
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]

# ---- Produção ----
# Sem devDependencies (imagem menor) e sem nodemon. Migrations e seed (ambos
# idempotentes) rodam no start via docker-compose.prod.yml.
FROM node:20-alpine AS production

ENV NODE_ENV=production

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]