#!/usr/bin/env bash
# Reproducible local, disposable PostgreSQL + Keycloak + NestJS + Next.js test.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
for cmd in docker npm node python3 curl; do command -v "$cmd" >/dev/null || { echo "BLOCKED: $cmd unavailable"; exit 2; }; done
[[ -f infra/.env.test ]] || python3 verification/generate_local_env.py
set -a; source infra/.env.test; set +a
python3 verification/generate_dev_realm.py
DOCKER_COMPOSE="docker compose --env-file infra/.env.test -f infra/docker-compose.test.yml -f infra/docker-compose.oidc.yml"
$DOCKER_COMPOSE up -d postgres keycloak
for i in {1..90}; do
  if curl --silent --fail --max-time 3 http://localhost:18080/realms/lms-demo/.well-known/openid-configuration >/dev/null; then break; fi
  sleep 2
 done
curl --silent --fail --max-time 5 http://localhost:18080/realms/lms-demo/.well-known/openid-configuration >/dev/null || { echo 'BLOCKED: Keycloak import/OIDC failed; inspect docker logs';exit 3; }
# Stage 01–02 migrations, seed, RLS smoke and compile. Provisioner scripts source .env.test.
bash verification/run_stage02_integration.sh
# All demo access tokens now must map to the platform user subjects from the seed.
mkdir -p verification/artifacts
export NODE_ENV=development
cd backend
node dist/main.js >../verification/artifacts/backend.log 2>&1 & B_PID=$!
cd ../frontend
npm run dev >../verification/artifacts/frontend.log 2>&1 & F_PID=$!
cd ..
trap 'kill "$B_PID" "$F_PID" 2>/dev/null || : ' EXIT
for i in {1..50}; do curl --silent --fail http://localhost:3001/health/live >/dev/null && break; sleep 1; done
curl --silent --fail http://localhost:3001/health/live >/dev/null || { echo 'BLOCKED: Backend failed to start'; tail -60 verification/artifacts/backend.log;exit 3; }
for i in {1..50}; do curl --silent --fail http://localhost:3000/ >/dev/null && break; sleep 1; done
curl --silent --fail http://localhost:3000/ >/dev/null || { echo 'BLOCKED: Frontend failed to start'; tail -60 verification/artifacts/frontend.log;exit 3; }
ALLOW_DEMO_E2E=true python3 verification/api_e2e_smoke.py | tee verification/artifacts/api_e2e_report.log
# OIDC browser login initiation verifies Next redirects with PKCE and sets an HttpOnly pending cookie.
curl --silent -D verification/artifacts/next_login_headers.txt -o /dev/null http://localhost:3000/api/auth/login
python3 verification/check_next_login.py verification/artifacts/next_login_headers.txt
printf '\nE2E COMPLETE: Check reports in verification/artifacts; full browser callback still requires interactive test.\n'
