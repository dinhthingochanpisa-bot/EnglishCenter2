> **Stage 02 — báo cáo chính:** [Báo cáo tổng hợp](docs/codex/STAGE02_REPORT.md), gồm kết quả mới nhất, lịch sử sửa lỗi, bằng chứng, giới hạn nghiệm thu và rollback.

# LMS + CRM SaaS – Stage 02: CRM & Customer 360°

> **LumaOS handoff (2026-11-07):** Start with [AGENTS.md](AGENTS.md) and [CODEX_START_HERE.md](CODEX_START_HERE.md). The [local review and Stage 03 plan](docs/codex/LOCAL_REVIEW_AND_STAGE03_PLAN_2026-11-07.md) reconciles the historical status below with current evidence: 53 live API checks and 13 HTTP OIDC assertions passed on the existing local demo stack. Full browser acceptance and reproducible integration remain open; Stage 03 is not approved yet.

> **Runtime validation update (2026-11-06):** Static checks pass, but PostgreSQL/OIDC/REST integration could not run in this execution environment because Docker/PostgreSQL is unavailable and npm registry DNS fails. See `verification/RUNTIME_VERIFICATION_REPORT.md`. To execute the complete disposable environment on a Docker-capable machine, run `bash verification/run_local_full_e2e.sh`. This is not a production-ready or runtime-verified build.


**Status:** Source-code integration delivered; **PostgreSQL migration, Prisma validate, full TypeScript typecheck, NestJS/Next.js builds, OIDC and browser E2E remain unverified in the current runtime** because Node dependencies and PostgreSQL/Docker are unavailable. Do not use with real customer data until security and privacy acceptance gates pass.

## Scope delivered

- Stage 01A/01B baseline included in `backend/`, `frontend/`, `infra/`.
- **14 new CRM tables** with tenant-scoped PostgreSQL RLS, composite tenant foreign keys, campaign/source validation, and row-version concurrency control.
- **Person Master:** per-tenant identity, branch visibility, person details, student identity (not paid enrollment), guardian relationships, duplicate-safe profile handling.
- **Lead/QL:** Lead registration, QL when valid phone present, first qualifying timestamp, status workflow, assignment, attribution touches, campaigns/sources, duplicates suggested but never auto-merged.
- **Pre-sales care:** activity notes, call/message/meeting/follow-up and next follow-up timestamp.
- **Check-in:** create Draft from Lead/Walk-in, complete after required personal info, store audit trail and convert associated Lead.
- **QR intake:** staff creates short-lived one-use link/QR, visitor fills form, staff reviews and confirms before it becomes a Check-in. Public endpoint **disabled by default** pending legal and abuse controls.
- **Customer 360 UI:** person's lead history, Check-ins, guardians (phone only when permitted); Lead table actions, source catalog and pending intake queue. Uses same-origin Next BFF and authorized NestJS API only.
- Sample synthetic data for 2 tenants, unit rules, RLS smoke test and acceptance checklist.

## Quick path

1. Copy `infra/.env.test.example` → `infra/.env.test` and set strong passwords **in a disposable test DB**.
2. Ensure Node 22+, Docker Compose and npm network access.
3. Run `bash verification/run_stage02_integration.sh` from repository root. This runs Stage 01 migration, then Stage 02 migration (all migrations via `prisma migrate deploy`), demo seeds, SQL security smoke checks and backend/frontend builds.
4. Set up a real test OIDC provider and fill `backend/.env.example`, `frontend/.env.example` values. `PUBLIC_FRONTEND_URL` should be frontend origin used for QR.
5. Configure CRM permissions on tenant roles. `TENANT_ADMIN` receives the ordinary Stage 02 CRM roles via migration/bootstrap, but **not** `pii.read_sensitive` by default.
6. From the web tenant workspace choose **CRM tổng quan → Person Master → Lead & QL → Nguồn khách hàng → Check-in → Biểu mẫu QR**.

> `PUBLIC_INTAKE_ENABLED=false` is a required safe default. For initial manual smoke testing of public QR, enable only behind a test gateway with throttling. Tenant-specific privacy notices and retention are still pending, so do not collect real children's data.

## Development commands (with dependencies available)

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:validate
npm run db:migrate
ALLOW_DEMO_SEED=true NODE_ENV=test npm run db:seed:demo
ALLOW_DEMO_SEED=true NODE_ENV=test npm run db:seed:crm
npm test
npm run typecheck
npm run build
cd ../frontend
npm install
npm run typecheck
npm run build
```

### File map

- `backend/prisma/schema.prisma` – Stage 01 + Stage 02 models.
- `backend/prisma/migrations/202611060004_stage02_crm/migration.sql` – 14 PostgreSQL tables, FKs, RLS and permission seed.
- `backend/src/crm.service.ts`, `crm.controllers.ts`, `crm.dto.ts`, `crm.rules.ts` – CRM API and rules.
- `frontend/components/crm-console.tsx` – CRM operator UI; `frontend/app/intake/...` – public QR form.
- `docs/STAGE02_ERD.md`, `docs/API_STAGE02.md`, `docs/ACCEPTANCE_TESTS.md`, `docs/OPEN_DECISIONS.md` – design/contract.
- `verification/verify_stage02.mjs` – dependency-free static/pure checks.
- `verification/run_stage02_integration.sh` – full integration smoke script for an appropriately provisioned environment.

## Important design decisions

- Current QL = Lead with valid phone; `qualified_at` records first qualification.
- Lead → Check-in conversion does not mean signed contract or active student.
- Intake submissions never directly overwrite a known customer, and guardian phone is never a universal unique identifier.
- All `GET/POST/PATCH` CRM endpoints require the active membership and action scope in NestJS; frontend checks only control visibility and ergonomics.
- Public QR's authority is a random, short-lived, single-use secret stored **hashed**. Do not use in production until WAF rate-limiting, consent notices, log redaction and security tests are completed.
- Stage 01 originally has not passed live PostgreSQL/OIDC tests. Stage 02 inherits those blockers and must not be marked production-ready.

