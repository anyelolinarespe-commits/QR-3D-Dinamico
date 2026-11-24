# Node.js 22 LTS
FROM node:22-alpine

WORKDIR /app

# Instalar dependencias para Sharp si hiciera falta en Alpine
RUN apk add --no-cache vips-dev build-base python3

# Copiar manifiesto de dependencias
COPY package*.json ./

RUN npm ci --only=production

# Copiar código fuente
COPY . .

# Exponer puerto HTTP
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "src/server.js"]
