#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
for cmd in docker node npm; do command -v "$cmd" >/dev/null || { echo "ERROR: missing $cmd"; exit 2; }; done
[[ -f infra/.env.test ]] || { echo 'Copy infra/.env.test.example to infra/.env.test and set strong passwords'; exit 2; }
set -a; source infra/.env.test; set +a
COMPOSE="docker compose --env-file infra/.env.test -f infra/docker-compose.test.yml"
$COMPOSE up -d postgres
# Local container health probe, fail fast if PostgreSQL never starts.
for i in {1..30}; do if $COMPOSE exec -T postgres pg_isready -U postgres -d lms_crm_stage01 >/dev/null 2>&1; then break; fi; sleep 1; done
$COMPOSE exec -T postgres pg_isready -U postgres -d lms_crm_stage01
PSQL="psql -X -v ON_ERROR_STOP=1 -U postgres -d lms_crm_stage01"
$COMPOSE exec -T -e PGPASSWORD="$PG_SUPERUSER_PASSWORD" postgres $PSQL -v runtime_pass="$APP_RUNTIME_PASSWORD" -v identity_pass="$IDENTITY_READER_PASSWORD" -v operator_pass="$PLATFORM_OPERATOR_PASSWORD" < infra/postgres/bootstrap-roles.sql
# This script intentionally uses a disposable test DB only; never deploy production migrations blindly.
cd backend
export DATABASE_URL="postgresql://postgres:${PG_SUPERUSER_PASSWORD}@127.0.0.1:55432/lms_crm_stage01"
npm ci --no-audit --no-fund
npm run prisma:generate
npm run prisma:validate
npm run db:migrate
ALLOW_DEMO_SEED=true NODE_ENV=test npm run db:seed:demo
npm run typecheck
npm run build
npm test
cd "$ROOT"
# Postgres role-based RLS tests run against the runtime role, never as owner.
for script in verification/rls_smoke.sql verification/rls_and_grants_additional.sql; do
  $COMPOSE exec -T -e PGPASSWORD="$APP_RUNTIME_PASSWORD" postgres psql -X -v ON_ERROR_STOP=1 -U app_runtime -d lms_crm_stage01 < "$script"
done
# FK test needs migration owner so it checks DB FK separately from RLS.
$COMPOSE exec -T -e PGPASSWORD="$PG_SUPERUSER_PASSWORD" postgres $PSQL < verification/composite_fk_smoke.sql
printf '\nPASS: migrations, seed, backend build/tests and PostgreSQL security smoke checks\n'
