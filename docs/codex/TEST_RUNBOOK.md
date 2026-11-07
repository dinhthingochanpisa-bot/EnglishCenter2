# TEST & DEVELOPMENT RUNBOOK — Windows + Ubuntu WSL2

## Prerequisites and context
- Windows Docker Desktop with WSL Integration enabled; Ubuntu group `docker` configured; Node.js 22+ and npm installed in **Ubuntu**, Python 3, curl.
- Workspace contains `backend/`, `frontend/`, `infra/`, `verification/`. Use an Ubuntu terminal; `/mnt/c/...` paths do not work in Windows PowerShell. If using PowerShell first run `wsl -d Ubuntu`.
- User has project in OneDrive/Desktop path containing `Hân` and `VIBE CODING`; **do not hard-code** this personal path in scripts. Prefer `cd` to workspace and use relative paths.
- Local services: Next `http://localhost:3000`, Nest `http://localhost:3001`, Keycloak `http://localhost:18080`, PostgreSQL host port 55432 from Compose.
- Only synthetic demo data. Do not share env values or generated realm secrets.

## First: inspect current state (safe)
```bash
pwd
ls backend frontend infra verification
node --version && npm --version
docker ps
curl -i --max-time 5 http://localhost:3001/health/live
curl -I --max-time 5 http://localhost:3000/
```
Expected health: HTTP 200 `{"ok":true}`. `EADDRINUSE` means server already listening; inspect before restarting, do not launch duplicates.

## Check services/ports (safe)
```bash
ss -ltnp | grep -E ':(3000|3001|18080|55432)\b' || true
ps -eo pid,cmd | grep -E '(next dev|dist/main.js)' | grep -v grep || true
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```
Before stopping PID, verify it belongs to project. Never run `pkill node` indiscriminately.

## Static and isolated unit tests
```bash
node verification/verify_stage02.mjs
cd backend
npm run typecheck
npm test
npm run build
cd ../frontend
npm run typecheck
npm run build
cd ..
```
Packaged `verify_stage02.mjs` has a hard-coded TS path; see T-002; local user already patched in working copy. `npm install` required where deps absent. Do not conflate static pass with runtime pass.

## Full end-to-end runner (only disposable environment)
```bash
# Do not run while manual servers occupy 3000/3001 until T-003 is fixed.
# Do not do this on production/shared data.
bash verification/run_local_full_e2e.sh
```
It creates `.env.test` if absent, starts PG/Keycloak, migrations/seeds, checks DB and builds, launches servers, runs API smoke and PKCE initiation; stops servers it started at exit. Does **not** automate full browser interaction. The original runner had an environment-dependent startup blocker if ports are already used; inspect logs/PIDs first.

## Rerun API E2E against already-running demo services
```bash
# Make sure your current directory is workspace root (pwd, ls).
set -a
source infra/.env.test
set +a
ALLOW_DEMO_E2E=true python3 verification/api_e2e_smoke.py
```
**Warning:** script performs writes to demo DB; do not run on real/shared data. User previously observed `TEST_COUNT=46` and all PASS when demo-a/demo-b accounts were completed.

## Manual browser UAT
1. Keep one backend server healthy, one frontend server on port 3000 and Keycloak running.
2. Open `http://localhost:3000` and log in via Keycloak (`demo-a` in `lms-demo`, password from local env); no real credentials in docs.
3. Open Tenant A CRM, verify Lead & QL listing, source creation, create Lead with no phone, QL after phone, activity, draft/complete Check-in, Customer 360 identity and parent links.
4. Verify **New Lead modal focus** stays in field while typing. Verify keyboard Tab, Esc, save errors, no accidental double submissions.
5. Login `demo-b` separately and confirm it cannot access Tenant A.
6. Inspect Network tab: browser must talk to `/api/backend/...` proxy, never directly to PostgreSQL.

## Known test realm quirk
On first import, `demo-a` and `demo-b` were missing email; Keycloak returned `invalid_grant / Account is not fully set up`. Adding synthetic email in realm `lms-demo` fixed on user test. Codex should fix realm generator for fresh imports. **Do not** alter prod authentication requirements to hide issue.

## Important: credentials and cleanup
- Generated credentials exist in local ignored `infra/.env.test` and per-app env files. Do not paste contents into chat or git.
- Never execute `docker compose down -v` except with explicit user permission and confirmed disposable demo containers (it deletes volumes).
- To get useful safe logs: `tail -n 100 verification/artifacts/backend.log` or `.../frontend.log`, redact secrets.
- When restarting services, check existing PID/port and use graceful stop; avoid session leftovers.

## Evidence matrix
| Test | User-observed evidence | Needs follow-up |
|---|---|---|
| PostgreSQL/Prisma/RBAC/RLS build runner | PASS printed | Review exact logs and fresh-run robustness |
| OIDC auth both demo users | PASS | Fresh realm provisioning without manual edit |
| API CRM + tenant isolation | PASS 46 | Extend with concurrency / browser UAT |
| Frontend build & UI loaded | PASS / manual Chrome screenshot | User flows and focus bug |
| New Lead form | Focus jump observed | Apply patch + browser regression |
| Production security/compliance | NOT assessed | Before any real user data |
