#!/usr/bin/env bash
# Reproducible local, disposable PostgreSQL + Keycloak + NestJS + Next.js test.
set -Eeuo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
for cmd in node python3; do command -v "$cmd" >/dev/null || { echo "BLOCKED: $cmd unavailable"; exit 2; }; done
# Check before credentials, Compose, migrations or seeds can change anything.
if [[ "${1:-}" == '--reuse-services' ]]; then
  node verification/service_lifecycle.mjs --reuse-services
  [[ -f infra/.env.test ]] || { echo 'BLOCKED: local demo env missing'; exit 2; }
  set -a; source infra/.env.test; set +a
  python3 verification/run_live_acceptance.py
  if [[ "${RUN_BROWSER_E2E:-false}" == true ]]; then node verification/browser_e2e.mjs; fi
  exit 0
fi
[[ $# == 0 ]] || { echo 'Usage: run_local_full_e2e.sh [--reuse-services]'; exit 2; }
node verification/service_lifecycle.mjs --preflight
for cmd in docker npm curl; do command -v "$cmd" >/dev/null || { echo "BLOCKED: $cmd unavailable"; exit 2; }; done
[[ -f infra/.env.test ]] || python3 verification/generate_local_env.py
set -a; source infra/.env.test; set +a
python3 verification/generate_dev_realm.py
DOCKER_COMPOSE="docker compose --env-file infra/.env.test -f infra/docker-compose.test.yml -f infra/docker-compose.oidc.yml"
if [[ "${CI:-false}" == true ]]; then
 export KEYCLOAK_TEST_UID="$(id -u)"
 DOCKER_COMPOSE+=" -f infra/docker-compose.oidc.ci.yml"
fi
$DOCKER_COMPOSE up -d postgres keycloak
for i in {1..90}; do
  if curl --silent --fail --max-time 3 http://localhost:18080/realms/lms-demo/.well-known/openid-configuration >/dev/null; then break; fi
  sleep 2
 done
curl --silent --fail --max-time 5 http://localhost:18080/realms/lms-demo/.well-known/openid-configuration >/dev/null || {
 mkdir -p verification/artifacts
 $DOCKER_COMPOSE logs --no-color --tail 100 keycloak > verification/artifacts/keycloak.log 2>&1 || true
 echo 'BLOCKED: Keycloak import/OIDC failed; inspect sanitized Keycloak log';exit 3;
}
# Stage 01–02 migrations, seed, RLS smoke and compile. Provisioner scripts source .env.test.
bash verification/run_stage02_integration.sh
# All demo access tokens now must map to the platform user subjects from the seed.
mkdir -p verification/artifacts
node verification/service_lifecycle.mjs
printf '\nSee verification/artifacts/stage3-gate for API/OIDC results. Browser evidence requires RUN_BROWSER_E2E=true.\n'
