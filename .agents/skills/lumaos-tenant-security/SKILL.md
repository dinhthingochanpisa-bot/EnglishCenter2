---
name: lumaos-tenant-security
description: Review or implement LumaOS authentication, RBAC, PostgreSQL RLS, tenant/branch access, PII, payment or audit changes; design and run cross-tenant denial tests before accepting the code.
---

# LumaOS Tenant Security

## Trigger
Use for any new API/Prisma model/migration, login/tenant routing, admin role, branch assignment, export, person/guardian record, approval, sensitive field, finance/entitlement posting or integration. Use whenever an implementation could expose one tenant's data to another.

## Sources
- \`AGENTS.md\`, \`docs/engineering-v2/01_DOMAIN_AND_DATA_CONTRACTS.md\`, \`02_API_CONTRACTS.md\`, \`05_SECURITY_TENANT_RLS_AND_PRIVACY.md\`.
- Implemented source: \`backend/src/auth.ts\`, \`authorization.ts\`, \`prisma.service.ts\`, \`tenant.service.ts\`, \`crm.service.ts\`, \`crm.controllers.ts\`, \`backend/prisma/schema.prisma\` and migrations.
- Current smoke SQL: \`verification/rls_smoke.sql\`, \`rls_crm_smoke.sql\`, \`rls_and_grants_additional.sql\`, \`composite_fk_smoke.sql\`, \`crm_integrity_smoke.sql\` if present. Inspect paths before running.

## Required reasoning for every endpoint
1. **Principal**: OIDC JWT issuer/audience/signature/expiry validated by backend; map to active platform user, not an untrusted client claim.
2. **Tenant**: derive authorized tenant memberships from the authenticated actor; restrict to ACTIVE membership; ensure client-supplied tenantId/code are selectors, not grants.
3. **Branch and object**: verify permission and effective branch scopes, target resource's tenant/branch and assigned-role rules, not just UI visibility.
4. **Data**: use tenant-scoped Prisma transaction and PostgreSQL app runtime RLS; composite tenant FKs prevent cross-tenant references; preserve FORCE RLS where present. Do not test RLS using only owner/superuser.
5. **Privacy**: mask guardian phone/sensitive student fields by permission, prohibit unverified guardian access; shared guardian phone does not justify merging student Person profiles.
6. **Audit/history**: keep immutable audit for security and state; no passwords, tokens, bank/card details or full child PII in logs. Posted money and lesson entries correct by reversal, not silent mutation.
7. **Public routes**: public QR is feature-gated OFF; webhooks require provider signature and abuse control. Never enable only to make test pass.

## Minimum adversarial tests
- Anonymous/expired/invalid issuer or audience → 401.
- Demo Tenant A token requests Tenant B by guessed ID or friendly code → 403/404, including query list, detail, mutation, audit and export.
- Tenant member with no Platform Admin entitlement cannot list all tenants or make platform changes; authorized membership discovery lists only active memberships.
- Branch X employee cannot read or modify Branch Y Lead/Person; revoked memberships/branch assignment take effect.
- No permission to assign Lead → 403; assignee outside allowed branch → reject without rowVersion mutation.
- Student sibling/guardian links do not leak other parent's PII, and same phone does not auto-merge identities.
- Back-to-back requests on a connection pool using tenant A then B cannot leak RLS context.
- Cross-tenant composite FK insert/update rejected. Audit UPDATE/DELETE denied by runtime role.
- Privileged workflow cannot self-approve in a prohibited step; concurrency/duplicate requests do not double-post payments, attendance or Check-ins.
- New slugs/codes may be human-readable, but all internal relations still use immutable UUID and server-side membership checks; prevent tenant enumeration.

## Safe execution
- Inspect \`git status --short\`, git HEAD, test config and environment first.
- For a disposable test database only, run the existing SQL and API integration scripts via documented \`verification\` runner; use \`app_runtime\` for RLS. CI is a valid separate evidence source when local Docker/WSL permission is BLOCKED, but must match exact SHA.
- Run unit, integration, RLS/FK and browser role-denial regression relevant to changed code. Never reset or truncate shared DB or delete volumes without explicit permission. Never print local env secrets.
- Security test coverage must include **two different tenants and distinct branch roles**, not only an admin account.

## Deliverable
For each change, report the endpoint/table, actor and tenant/branch scope, required permission, PII classification, RLS/FK policy, negative tests with PASS/FAIL/BLOCKED and actual evidence. Block merge on a demonstrated tenant isolation regression. Record unresolved threat model/legal/privacy issues before production release.
