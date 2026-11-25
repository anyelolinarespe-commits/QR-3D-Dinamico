# Node.js 22 LTS (Debian slim usa binarios precompilados de sharp para builds rápidos)
FROM node:22-slim

WORKDIR /app

# Copiar manifiesto de dependencias
COPY package*.json ./

RUN npm ci --omit=dev

# Copiar código fuente
COPY . .

# Exponer puerto HTTP
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "src/server.js"]
