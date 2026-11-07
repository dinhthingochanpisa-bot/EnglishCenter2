# Stage 01A – SaaS Core Backend (NestJS + Prisma)

**Status: implementation scaffold, NOT production-certified.** Extends Stage 01 database baseline without modifying its original Prisma models or initial migration. Adds a separate migration for Stage 01A grants and permission catalog.

## Contents

- `src/`: NestJS API, verified OIDC JWT, active membership + RBAC + branch-scope authorization, tenant-pinned Prisma transactions, audit log.
- `prisma/schema.prisma`: unchanged Stage 01 schema, 14 models.
- `prisma/migrations/202611060001_saas_core`: unchanged Stage 01 SQL migration.
- `prisma/migrations/202611060002_stage01a_security`: Stage 01A least-privilege role grants and core permission codes.
- `prisma/seeds/seed.ts`: existing demo-only seed (not used in real customer onboarding).
- `docs/SECURITY.md`, `docs/API_ENDPOINTS.md`: privilege model, endpoints, production gates.
- `test/`: basic contract tests (integration tests still required).

## Requirements

Node 22+, PostgreSQL 15+, existing OIDC identity provider. Three **separate** PostgreSQL credentials: app runtime, global identity reader, platform provisioning operator. Platform admin user subjects allowlisted out-of-band. Never use a superuser or migration owner for request handling.

## Setup

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:validate
# provision PostgreSQL app_runtime, identity_reader, platform_operator out-of-band;
# apply Stage 01 and 01A migrations using MIGRATOR URL (not the runtime URL):
DATABASE_URL="$MIGRATOR_DATABASE_URL" npm run db:migrate
npm run build
npm test
npm run dev
```

Database migration and seed must not be run against production before a security review. Migration requires roles created by DBA. Do not put passwords, OIDC secrets or PII in the repository. For `prisma migrate deploy`, ensure Prisma engine gets migrator URL via environment variable, not a shell command copied blindly with secrets.

## Tenant onboarding

1. Out-of-band OIDC admin creates/provisions platform admin identity. Operator subject appears in `PLATFORM_ADMIN_SUBJECTS`.
2. `POST /v1/platform/users` provisions user with matching external `authSubject`.
3. `POST /v1/platform/tenants` creates tenant.
4. `POST /v1/platform/tenants/:tenantId/bootstrap-admin` with `{ "userId": "..." }` assigns first TENANT_ADMIN one time.
5. Tenant admin can create branches and invite existing provisioned users, assign branch scopes and delegate **only permissions currently held** to custom roles.
6. Activating a membership does **not** mean the invite was accepted; identity/invitation lifecycle integration is still TODO.

**Important:** bootstrap role permission template is intentionally limited to SaaS Core privileges. Finance/PII permission sets require separately approved ADR and an out-of-band administrator template update, not arbitrary tenant-admin escalation.

## API

See `docs/API_ENDPOINTS.md`; documentation served on `/docs`, heartbeat `/health/live`.

## Verification done / not done

- Completed: code scaffolding, source/schema alignment review, static syntax checks where available.
- Not completed: npm dependency installation (offline dependency cache missing); TypeScript full build; Prisma validate/generate; PostgreSQL migration execution; JWT integration tests; multi-tenant RLS penetration tests; endpoint E2E tests. **Do not claim runtime readiness until these pass.**
