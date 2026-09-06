# Imagem de desenvolvimento. Para produção, será adicionada uma variante
# multi-stage em docker-compose.prod.yml (Sprint 5), sem dependências de dev.
FROM node:20-alpine

WORKDIR /app

# Copia apenas os manifestos para aproveitar o cache de camadas
COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

EXPOSE 3000

CMD ["node", "src/app.js"]