# ARCHITECTURE & CODE MAP (implemented vs planned)

## Implementation baseline — current Stage 01/02

```text
Browser (Chrome/Edge)
  Next.js 16 (frontend/app, frontend/components)
  BFF /api/backend/... + OIDC auth routes
     ↳ NestJS REST /v1/... (backend/src)
        ↳ authorization (membership, role, branch/object) + Prisma tenantTx
           ↳ PostgreSQL 16 RLS & composite FK; audit logs
OIDC: Keycloak test realm lms-demo; browser auth code + PKCE
Docker Compose: local PostgreSQL and Keycloak only
```

Do not expose DB credentials to frontend, and do not permit browser direct Prisma/Postgres access.

## Repo file map (verified in Stage02 ZIP)

| Path | Responsibilities |
|---|---|
| `backend/src/main.ts` | Nest bootstrap, REST controllers, `/health/live`, Swagger `/docs` |
| `backend/src/auth.ts` | OIDC/JWKS JWT validation, actor |
| `backend/src/authorization.ts` | Membership/role/branch permission checks |
| `backend/src/prisma.service.ts` | Prisma role connections and tenant-scoped transactions |
| `backend/src/tenant.service.ts` | Platform SaaS Core services; tenant/branch/user/role/audit |
| `backend/src/controllers.ts` | Platform & Tenant admin routes |
| `backend/src/crm.service.ts` | CRM Person/Lead/Check-in/intake business logic |
| `backend/src/crm.controllers.ts` | CRM API routes |
| `backend/src/crm.rules.ts` | Pure normalization/state rules |
| `backend/src/crm.dto.ts` | Input validation DTOs |
| `backend/prisma/schema.prisma` | Actual Prisma models (Stage 01 + 02) |
| `backend/prisma/migrations/202611060001...004...` | Ordered migrations including security grants/CRM |
| `frontend/components/ui.tsx` | Shared Shell, Modal, Field, buttons — location of focus bug |
| `frontend/components/crm-console.tsx` | CRM UI pages/forms/actions; uses API, not DB |
| `frontend/components/tenant-console.tsx` | Tenant operations screens |
| `frontend/app/api/backend/[...segments]/route.ts` | Same-origin BFF route |
| `frontend/app/api/auth/*` | Login/callback/session/logout |
| `frontend/lib/{api,oidc,session}.ts` | Client request helper/OIDC & secure session utilities |
| `infra/docker-compose.test.yml` | PostgreSQL 16 local test |
| `infra/docker-compose.oidc.yml` | Keycloak local test |
| `verification/run_local_full_e2e.sh` | Runner: infra + DB + app + API smoke |
| `verification/api_e2e_smoke.py` | 46-check API workflow and negative cases as observed |
| `verification/verify_stage02.mjs` | Syntax+schema+rules static checker (hard-coded TS path in packaged source) |

## Current API surface
- SaaS Platform: `POST/GET /v1/platform/tenants`, platform users, bootstrap admin.
- Tenant Admin: `GET /v1/tenants/:tenantId`, `/me/permissions`, `/users`, `/branches`, `/memberships`, `/roles`, `/permissions`, `/audit-logs`; POST/PATCH/DELETE for scoped assignments and role permissions.
- CRM: `GET/POST /v1/tenants/:tenantId/crm/{persons,sources,campaigns,leads,checkins,...}`; `PATCH /persons/:id`, `PATCH /leads/:id`; activities/touches, Check-in completion, intake invite/review.
- Public QR: `POST /v1/public/intake/:tenantId/:token` **feature-gated off**.
- Health: `GET /health/live` returns `{"ok":true}` in local test.
- Reference contracts: `docs/API_STAGE02.md` and `backend/docs/API_ENDPOINTS.md`. Do not invent routes.

## Database scope
- **Implemented:** 14 SaaS Core tables + 14 CRM tables (28 total logical models, verify actual schema) across Stage 01–02.
- **Future target:** conceptual ERD has 136 tables across 11 domains. These are **not migrations yet**.
- `crm_persons` (durable per-tenant identity); `crm_students` (student profile after check-in, **not a paid enrollment**); `crm_person_branches`, `crm_leads`, `crm_marketing_sources`, activities, check-ins, intakes, etc.
- Key roles: `platform_users`, `tenants`, `branches`, `tenant_memberships`, `roles`, `permissions`, mappings/scopes, audit logs.
- Preserve `person_id` to future Test/Trial, Quote/Contract, LMS and Renewal.

## Architecture decisions
- Modular monolith backend, TypeScript end-to-end, REST/OpenAPI. Do not split into microservices prematurely.
- Tenant isolation first: tenant_id, composite FK, RLS + backend scope checks. Tenant app roles with least privilege.
- No destructive re-seeding on shared/dev data without explicit approval.
- UI contextual actions; business state machines enforced server side; save history and versioned policies.
- Planned Stage 03 domain: Products, Packages/Pathways, Pricing/Promotions Engine, quotes (dependent on approved ADRs); separate implementation from current CRM.
