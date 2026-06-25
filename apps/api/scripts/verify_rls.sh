#!/usr/bin/env bash
# One-command tenant-isolation verification against a disposable Postgres.
# Requires Docker. For staging, skip this and run verify_rls.py directly with
# RLS_TEST_DATABASE_URL pointed at a throwaway DB.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-5433}"
NAME="rls-verify-pg"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "▶ starting disposable postgres:16 on :$PORT"
docker run --rm -d --name "$NAME" -p "$PORT:5432" -e POSTGRES_PASSWORD=postgres postgres:16 >/dev/null

echo "▶ waiting for postgres to accept connections…"
for i in $(seq 1 30); do
  if docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done

echo "▶ running isolation checks"
RLS_TEST_DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:$PORT/postgres" \
  python scripts/verify_rls.py
