FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY tsconfig*.json ./
COPY src ./src
RUN npm run build

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 3001

CMD ["node", "dist/index.js"]
