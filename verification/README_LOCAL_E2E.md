# Stage 01–02: local PostgreSQL / OIDC / CRM end-to-end validation

> Current Windows-session evidence (2026-11-07): live CRM API and HTTP OIDC callback tests now run successfully against the existing localhost stack. Native builds and direct database acceptance remain blocked. See [Stage 3 readiness](STAGE3_READINESS_2026-11-07.md); the status below describes the original preparation environment.

**Status in the current execution environment:** BLOCKED. `docker`, `postgres`, and `psql` are not installed; the npm registry is unreachable (`EAI_AGAIN`). The script below is **provided for execution on a Docker-capable machine**, not represented as a successful run here.

## Test environment (strictly non-production)

- Docker Compose PostgreSQL 16 (`127.0.0.1:55432`); database roles are provisioned separately.
- Keycloak **26.8.1** (`127.0.0.1:18080`) with local-only test realm `lms-demo` and two synthetic users. `lms-web` is a public Authorization Code + PKCE client; `lms-smoke-cli` enables Resource Owner Password Credentials **only in this disposable test realm**, never production. Both obtain an audience claim for `lms-api`.
- NestJS API (`http://localhost:3001`) and Next.js development server (`http://localhost:3000`). Local `http://localhost` OIDC is accepted only in development; production requires HTTPS.
- Two independent seeded tenants; A and B users have distinct membership and tenant permissions. Demo user OIDC `sub` IDs are aligned with seed `auth_subject`.
- Public QR intake remains disabled. No personal customer data are permitted in this test environment.

## Run on a developer machine

**Prerequisites:** Docker Desktop/Engine with Compose, Node.js 22+, npm registry access, Python 3, curl, `psql` executed inside PostgreSQL container. Ports 3000, 3001, 55432, 18080 must be available. Allocate at least ~2 GB memory for Keycloak/PG/Node.

From extracted workspace root:

```bash
bash verification/run_local_full_e2e.sh
```

The first run generates **untracked** local random credentials at `infra/.env.test`, `backend/.env`, and `frontend/.env.local`. It imports `infra/keycloak/import/lms-demo-realm.json` only into a disposable Keycloak container and never logs demo passwords. `run_pg_integration.sh` applies Stage 01 migrations, `run_stage02_integration.sh` applies Stage 02 migration, seeds only synthetic data, runs Prisma validate/build and SQL smoke checks. The runtime script then launches both services and executes:

`Source → Lead NEW → Qualified Lead → Care activity → Check-in completed → Customer 360`, with negative cases for anonymous requests, cross-tenant read/write, repeated completion and disabled QR intake.

It also checks the Next `/api/auth/login` redirect requests **Authorization Code + PKCE** and sets an HttpOnly pending-state cookie. For a browser test, open `http://localhost:3000/api/auth/login` and sign in with `demo-a` using password in **your local** `infra/.env.test`. It should return to the Next application and show tenant A CRM. Never copy local passwords into shared reports.

### Clean up

```bash
docker compose --env-file infra/.env.test \
  -f infra/docker-compose.test.yml \
  -f infra/docker-compose.oidc.yml down -v
```

To re-import an updated Keycloak realm, **destroy the test container/data** first; Keycloak skips import if the realm exists. Do not use `down -v` on any production or shared Compose project.

## Acceptance gate

Do **not** mark Stage 01/02 verified until these have real passing logs: (1) Prisma generate/validate and migration deploy; (2) Postgres RLS/read-write isolation on both tenants; (3) OIDC discovery/JWT RS256 validation against local JWKS; (4) authorized API smoke full lifecycle; (5) negative cross-tenant and unauthorized cases; (6) NestJS and Next.js build; (7) browser callback + roles and permission handling. Any failure blocks deployment. Preserve logs excluding credentials and child details.

## Caveats

- The direct-grant client exists only to automate local API integration. Production should use Authorization Code + PKCE / suitable confidential clients and stronger login policy.
- Browser callback success and actual Next screen behavior must be verified interactively; the script currently tests API and PKCE initiation, **not browser UI automation**.
- Stage 02 public QR form is disabled by default pending policy, consent, logging and rate limiting checks.
- PostgreSQL RLS with `app.tenant_id` is defense-in-depth. Setting the context is privileged application behavior; it is **not** user authentication by itself. Backend must verify JWT, tenant membership, role, branch and object rights before setting any tenant context.
- `npm install` does not currently use committed lockfiles. Before a production deployment, generate/review and commit both lockfiles, pin dependencies and run dependency security checks.
