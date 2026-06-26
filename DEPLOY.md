# Deployment Guide

## Architecture

| Service | Platform | Directory |
|---------|----------|-----------|
| Frontend | Vercel | `apps/web` |
| API (FastAPI) | Railway | `apps/api` → `Dockerfile` |
| Celery Worker | Railway | `apps/api` → `Dockerfile.worker` |
| CopyTrade Worker | Railway | `apps/worker-ct` |
| WebSocket (RT) | Railway | `apps/worker-rt` |
| Database | Supabase | — |
| Cache / Queue | Upstash Redis | — |

---

## Step 1 — Supabase (Database + Auth)

1. Create project at **supabase.com**
2. **Settings → Database → Connection string** → switch to **Transaction** mode (port 6543) — copy as `DATABASE_URL`
3. **Settings → API** — copy `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
4. **Settings → Auth → JWT Settings** — copy `SUPABASE_JWT_SECRET`
5. Enable TimescaleDB — SQL Editor → run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS timescaledb;
   ```

## Step 2 — Upstash Redis

1. Create Redis database at **upstash.com** (choose same region as Railway deployment)
2. Copy `REDIS_URL` from the console (starts with `rediss://`)

## Step 3 — Generate Secret Keys

```bash
# MT4 password encryption key (must be exactly 32 bytes hex = 64 chars)
openssl rand -hex 32
# → paste as ENCRYPTION_KEY in API service and Celery worker

# Internal service-to-service token (worker-ct ↔ API)
openssl rand -hex 32
# → paste as INTERNAL_API_TOKEN in BOTH API service AND worker-ct service
```

## Step 4 — Railway (4 services)

1. Sign in at **railway.app**, create new project
2. **Service 1 — API:**
   - New Service → GitHub Repo → Root Directory: `apps/api` → Dockerfile: `Dockerfile`
   - Set env vars from `apps/api/.env.example`
   - The `alembic upgrade head` runs automatically on every deploy
3. **Service 2 — Celery Worker:**
   - New Service → same repo → Root: `apps/api` → Dockerfile: `Dockerfile.worker`
   - Same env vars as Service 1
4. **Service 3 — CopyTrade Worker:**
   - New Service → same repo → Root: `apps/worker-ct`
   - Set env vars from `apps/worker-ct/.env.example`
   - Set `API_URL` = Railway URL of Service 1
5. **Service 4 — WebSocket:**
   - New Service → same repo → Root: `apps/worker-rt`
   - Set env vars from `apps/worker-rt/.env.example`
   - Set `CORS_ORIGIN` = your Vercel domain

Note the Railway domains for Services 1 and 4 — needed for Vercel env vars.

## Step 5 — Vercel (Frontend)

1. Import project at **vercel.com** → Root Directory: `apps/web`
2. Set env vars from `apps/web/.env.production.example`:
   - `NEXT_PUBLIC_API_URL` = Railway API service URL
   - `NEXT_PUBLIC_WS_URL` = Railway worker-rt service URL
3. Deploy

## Step 6 — Payments

### 6a. Crypto (Cryptomus) — primary rail

1. In the Railway **API** service set:
   - `CRYPTOMUS_API_KEY`, `CRYPTOMUS_MERCHANT_UUID`
   - **`API_BASE_URL` = the public API URL** (e.g. `https://your-api.railway.app`).
     ⚠️ This is critical: the payment callback URL is built from it. If it stays
     `localhost`, Cryptomus webhooks never arrive and paid subscriptions never
     activate. No webhook needs registering in the Cryptomus dashboard — the
     callback URL is sent per-payment.
   - `FRONTEND_URL` = your Vercel domain (success redirect target).
2. The webhook endpoint is `https://your-api.railway.app/api/v1/payments/webhook`
   (signature-verified automatically).

### 6b. Stripe — optional (skip to launch crypto-only)

Leave `STRIPE_SECRET_KEY` blank to run on crypto alone. To enable card payments:

1. Stripe Dashboard → Developers → Webhooks → Add endpoint:
   - URL: `https://your-api.railway.app/webhooks/stripe`
   - Events: `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`
2. Copy `Signing secret` → add as `STRIPE_WEBHOOK_SECRET` in Railway API service
3. Redeploy API service

## Step 7 — MetaAPI

1. Register at **metaapi.cloud**
2. Copy API token → set as `METAAPI_TOKEN` in both Railway API service and worker-ct service

## Step 8 — Verify

```bash
# API health check
curl https://your-api.railway.app/health
# → {"status":"ok","env":"production"}

# Frontend
open https://your-app.vercel.app
```

---

## Environment Variables Quick Reference

### `apps/api` (Services 1 & 2)
See `apps/api/.env.example`

### `apps/worker-ct` (Service 3)
See `apps/worker-ct/.env.example`

### `apps/worker-rt` (Service 4)
See `apps/worker-rt/.env.example`

### `apps/web` (Vercel)
See `apps/web/.env.production.example`
