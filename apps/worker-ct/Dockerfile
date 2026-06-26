FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
# npm install (not ci): per-package lockfile is managed at the monorepo root and
# can be stale; in this standalone build context npm install resolves from package.json.
RUN npm install --no-audit --no-fund
COPY tsconfig*.json ./
COPY src ./src
# Build, then drop devDeps in place (single install — no second network fetch).
RUN npm run build && npm prune --omit=dev

FROM node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./
# node:20 already ships a uid-1000 `node` user — reuse it (useradd -u 1000 would fail).
RUN chown -R node:node /app
USER node
EXPOSE 3002
CMD ["node", "dist/index.js"]
