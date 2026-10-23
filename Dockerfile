# syntax=docker/dockerfile:1

# ---- build: instala, valida (typecheck + testes) e gera dist/ ----
FROM node:22-alpine AS build
WORKDIR /app

# Manifestos primeiro: a camada do `npm ci` só refaz quando as dependências mudam.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run typecheck && npm test && npm run build

# ---- runtime: só o servidor empacotado (dist/server.cjs) e o client (dist/public) ----
FROM node:22-alpine
LABEL org.opencontainers.image.title="Simulador de Encontros" \
      org.opencontainers.image.description="Simulador de combates de RPG de mesa (servidor + web)" \
      org.opencontainers.image.source="https://github.com/JorgeMombach/RpgTabletop" \
      org.opencontainers.image.licenses="UNLICENSED"

# GM_LOOPBACK=0: no container as conexões chegam pelo gateway do Docker, não por loopback;
#   o mestre entra pelo link com a chave (ADR-12).
# DETECT_ADDRESSES=0: dentro do container só se vê o IP interno; convites vêm de PUBLIC_URLS (ADR-13).
ENV NODE_ENV=production \
    PORT=3000 \
    OPEN_BROWSER=0 \
    GM_LOOPBACK=0 \
    DETECT_ADDRESSES=0

WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./
USER node

EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" > /dev/null || exit 1

# Forma exec: o Node recebe o SIGTERM do `docker stop` e encerra limpo.
CMD ["node", "server.cjs"]
