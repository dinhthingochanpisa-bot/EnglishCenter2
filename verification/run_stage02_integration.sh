#!/usr/bin/env bash
# Disposable local-only integration tests; never run against production.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
bash verification/run_pg_integration.sh
set -a
source infra/.env.test
set +a
cd backend
export DATABASE_URL="postgresql://postgres:${PG_SUPERUSER_PASSWORD}@127.0.0.1:55432/lms_crm_stage01"
ALLOW_DEMO_SEED=true NODE_ENV=test npm run db:seed:crm
cd "$ROOT"
docker compose --env-file infra/.env.test -f infra/docker-compose.test.yml exec -T \
 -e PGPASSWORD="$APP_RUNTIME_PASSWORD" postgres \
 psql -X -v ON_ERROR_STOP=1 -U app_runtime -d lms_crm_stage01 < verification/rls_crm_smoke.sql
cd frontend
npm install
npm run typecheck
npm run build
cd "$ROOT"
node verification/verify_stage02.mjs
printf '\nPASS: Stage 02 PostgreSQL, Prisma, RBAC/RLS and frontend build checks\n'
