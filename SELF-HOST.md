# Self-Hosted Deployment (your own server)

DB + Auth stay on **Supabase Cloud (Pro)**. Everything else runs on your server
via Docker Compose, behind Caddy (automatic HTTPS).

```
[ Browser ] → Caddy :443 ─┬─ app.domain  → web (Next.js :3000)
                          ├─ api.domain  → api (FastAPI :8000)
                          └─ ws.domain   → worker-rt (Socket.IO :3001)
   api ─ celery worker ─ worker-ct ─ redis        (internal network)
   api → Supabase (Postgres + Auth)               (external)
```

## 0. Prerequisites
- A server (≈2 vCPU / 4 GB RAM minimum; 4 vCPU / 8 GB comfortable), Ubuntu 22.04+.
- Docker + Docker Compose plugin installed.
- A domain with 3 DNS **A records** → server IP: `app.`, `api.`, `ws.`
- Ports **80** and **443** open.

## 1. Supabase (Pro)
1. Buy Supabase **Pro** (free tier pauses + is too small for production).
2. SQL editor → `CREATE EXTENSION IF NOT EXISTS timescaledb;`
3. Grab: pooler `DATABASE_URL` (port 6543), `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`.

## 2. Clone + configure env
```bash
git clone <repo> && cd 跟单社区

# Root env (domains + web build args)
cp .env.compose.example .env && edit .env

# API + Celery worker secrets
cp apps/api/.env.example apps/api/.env && edit apps/api/.env
#   REDIS_URL=redis://redis:6379/0        ← internal
#   DATABASE_URL=<supabase pooler url>
#   API_BASE_URL=https://api.yourdomain.com   ← MUST be public (crypto webhook)
#   FRONTEND_URL=https://app.yourdomain.com
#   CRYPTOMUS_API_KEY=... CRYPTOMUS_MERCHANT_UUID=...
#   ENCRYPTION_KEY=$(openssl rand -hex 32)
#   INTERNAL_API_TOKEN=$(openssl rand -hex 32)
#   SUPABASE_* / METAAPI_TOKEN / FINNHUB_API_KEY / SENDGRID_API_KEY ...

# Copy worker secrets
cp apps/worker-ct/.env.example apps/worker-ct/.env && edit apps/worker-ct/.env
#   API_URL=http://api:8000               ← internal
#   INTERNAL_API_TOKEN=<same as api>
#   METAAPI_TOKEN=<same as api>
cp apps/worker-rt/.env.example apps/worker-rt/.env && edit apps/worker-rt/.env
#   INTERNAL_API_URL=http://api:8000      ← internal
#   CORS_ORIGIN=https://app.yourdomain.com
#   REDIS_URL=redis://redis:6379/0
```

## 3. Launch
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
The API container runs `alembic upgrade head` automatically on start, so all
migrations apply on first boot. Caddy obtains TLS certs once DNS resolves.

## 4. Verify
```bash
curl https://api.yourdomain.com/health        # {"status":"ok","env":"production"}
# open https://app.yourdomain.com
```

## 5. Smoke-test the money path (before real users)
register → bind MT4 → subscribe → pay a small real USDT → confirm the subscription
flips to ACTIVE (Cryptomus webhook) → master opens a trade → confirm worker-ct
copies it → P&L shows on the dashboard.

## 6. Operations
```bash
docker compose -f docker-compose.prod.yml logs -f api      # tail logs
docker compose -f docker-compose.prod.yml up -d --build    # redeploy after git pull
docker compose -f docker-compose.prod.yml ps               # status
```

## Notes
- **RLS**: ships inert. To enforce tenant isolation later, run
  `apps/api/docs/rls_activate.sql` and point `DATABASE_URL` at the `app_tenant`
  role with `RLS_ENABLED=true`. Single-tenant launch can skip this.
- **Backups**: handled by Supabase (Pro = daily). Redis here is cache/queue only.
- **Scaling**: bump `gunicorn -w` in apps/api/Dockerfile and run more `worker`
  replicas as load grows.
