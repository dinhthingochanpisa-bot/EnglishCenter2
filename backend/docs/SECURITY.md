# Security architecture and deployment gates

**Do not deploy until verification on a real PostgreSQL database.** Prisma schema alone does not express PostgreSQL RLS, policies, exclusion constraints or audit trigger. Apply SQL migrations and smoke tests as `app_runtime` (not owner).

## Trust and privilege separation

1. External OIDC JWT verification: exact issuer, audience, JWKS; allow RS256/ES256. Never accept unsigned JWT, x-user-id, x-tenant-id, or arbitrary client identity.
2. `identity_reader`: `SELECT` on global `platform_users` and `tenants`; no rights on tenant tables. `auth_subject` mapped to a locally provisioned active user; JWT tenant claim is not trusted.
3. `app_runtime`: tenant tables only, no rights on `platform_users`, `tenants` (unless explicitly narrowly added), and no owner/BYPASSRLS privilege. All reads/writes execute inside `$transaction` with SET LOCAL `app.tenant_id` and `app.actor_user_id`.
4. `platform_operator`: narrow global write permissions plus scoped bootstrap tables. Routes exposed only for `PLATFORM_ADMIN_SUBJECTS` (trusted subjects explicitly configured out of band); production should add independent approval and administrative MFA policy.
5. Composite FKs and database RLS are the last line of tenant protection. Application checks active membership and action permission, checking branch scope when applicable.

## Critical permission decisions

- Tenant admin bootstrap is **one-time** and must be completed by privileged operator. It grants only core administrative permissions; does not grant finance/PII privileges.
- System roles cannot be changed through normal tenant API.
- Only actor permissions held can be delegated to custom roles. Self-role assignment is disallowed.
- Branch-scoped permission cannot read all tenant data: list branches is filtered; other tenant-wide endpoints require TENANT-scoped permission.
- Audit records append-only; beforeData/afterData must not include passwords, tokens, bank details or sensitive student data. Add field-level redaction before extending beyond Stage 01A.
- Platform user CRUD is provisioning-only; no arbitrary user sign-up or token-based account creation.
- Support impersonation and data access via support_grants deliberately not implemented; not equivalent to platform admin.

## Required integration tests (not yet executed)

- Missing bearer/invalid aud/iss/expired JWT -> 401; unprovisioned local user -> 403.
- Active user of A -> Tenant B membership read/write 403; raw query without tenant context returns 0.
- Tenant A cannot create Branch with Tenant B ID; composite FK forbids cross-tenant assignment.
- Branch-scoped member cannot list all tenant membership or read other branches.
- Role grant cannot delegate privilege actor does not hold; system roles immutable; no self-role assignment.
- Race on rowVersion -> 409; duplicate branch code -> consistent 409 mapping (currently Prisma P2002 may map to 500; add exception filter before pilot).
- Audit log rejects UPDATE/DELETE by app_runtime.
- No tenant role can select `platform_users`/`tenants` directly.
- Platform operator restricted to explicit principals and no normal business data access without tenant context.

## Known gaps

- Provisioning and out-of-band identity lifecycle require IdP integration and platform ops approvals.
- No rate limiter, CSRF applicability review, centralized structured logs, refresh token handling, fine-grained response DTO, tracing, request-id propagation, full pagination, data retention, revocation fan-out, or automated database integration tests yet.
- Core `app_runtime` grants from baseline allow broad CRUD on tenant tables; API RBAC narrows access. Consider role-specific DB views/procedures after threat-model review.
- Role privilege assignment races need transactions with suitable isolation/serialization for high-risk admin operations.
