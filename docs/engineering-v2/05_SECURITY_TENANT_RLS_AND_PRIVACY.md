# 05 — Security Architecture, Tenant Isolation & Privacy Gate

**LUM-ENG-SEC v2.0** · Applies to every Stage 03–09, building on existing Stage 01/02. This is a design and test specification, not certification of production security.

## 1. Trust boundary and authenticated actor
- Next.js is a presentation layer and same-origin BFF; browser sends calls to authorized API, never directly to Prisma/PostgreSQL.
- Keycloak OIDC provides signed identity token/JWT; NestJS validates issuer, audience, expiry, keys and maps account to platform user and membership.
- Every tenant domain command must check: authenticated actor → active tenant membership → permission → branch/object scope → business state/approval gate → tenant-scoped DB operation.
- Postgres RLS is defense in depth. Use tenant-scoped transactions with the session/transaction setting populated by a trusted backend service, never a tenant ID supplied directly by the caller.
- Consider independent platform operator roles for platform billing versus tenant business administrators: platform access does not grant blanket access to student PII.

## 2. Invariant checklist
| Control ID | Requirement | Negative test |
|---|---|---|
| SEC-01 | tenant_id on all tenant-owned rows; composite FK includes tenant ID | Tenant A inserts relation to Tenant B branch or person: rejected |
| SEC-02 | RLS enabled and enforced for runtime role | Query with Tenant A context cannot return Tenant B record, including joins |
| SEC-03 | resource permission at NestJS layer | User with no action permission gets 403 even if UI button hidden |
| SEC-04 | branch effective scope | Manager of Branch X cannot write to Branch Y |
| SEC-05 | immutable domain audit | Attempt to delete posted ledger/audit history denied |
| SEC-06 | OIDC account verification and token checks | invalid aud/issuer/exp/signature → 401 |
| SEC-07 | field-level PII masking | Sales list may show masked phone; unauthorized request for raw value denied |
| SEC-08 | separation of duties | Requesting sales actor cannot approve own exception if prohibited |
| SEC-09 | service-to-service authenticity | unsigned provider webhook rejected and no Lead created |
| SEC-10 | guardian-to-student linkage | Parent sees only verified linked student's published reports |
| SEC-11 | financial idempotency | replayed payment/refund/transfer creates no double post |
| SEC-12 | consent and retention | marketing communication with invalid consent denied; expiries enforced |
| SEC-13 | session hardening | logout/revoke invalidates session; CSRF and XSS controls tested |
| SEC-14 | uploads and download grants | malicious file rejected; signed file URL expires and respects object access |

## 3. RLS and transaction implementation
- RLS in PostgreSQL for SELECT, INSERT, UPDATE and DELETE. Use table-scoped tenant predicates, and restrictive behavior on missing tenant context.
- Use WITH CHECK on INSERT/UPDATE. Tests must run using actual app runtime DB role, **not owner/superuser**, because owner can bypass RLS.
- Verify branch and object authorization in NestJS. RLS alone cannot enforce "teacher only their assigned class at effective time" or "financial reviewer not requester."
- Where policies use session settings (e.g. app.tenant_id), use SET LOCAL inside transaction and verify no connection pooling bleed between successive requests; always reset on transaction close.
- Unique keys and composite foreign keys must be tested with cross-tenant foreign IDs.
- Add isolation test matrix for tenant A/B, branch 1/2, Platform Admin, teacher, accountant, sales, CSKH, guardian.

## 4. Privacy / minors / finance
- Classify PII: child/guardian identity, phone, school, academic records, finance, test responses. Store separately and encrypt highly sensitive data at rest/transport as warranted.
- Consent captures version, purpose, source, date/time, actor, withdrawal event, expiry and valid channel.
- Two siblings sharing phone: **never merge students by phone alone**. Guard parent-child relationship and break-glass support access with explicit approval, time limit, audit.
- Do not log passwords, raw access tokens, full bank/card details, national IDs or unredacted student content. Do not store credit-card PAN/CVV.
- Signed quote/report/download artifacts must preserve version and integrity. The sharing link must be scoped, expiring, revocable and monitored.
- Tenant data export/delete/offboarding requires agreed retention policy and local legal/privacy assessment before production, including backups and third-party provider data.

## 5. Secrets, delivery and environment
- Never commit infra/.env.test, .env*, runtime credentials, Keycloak realm generated passwords, database dumps, test result folders with secrets.
- Secrets are sourced from secret manager/env for each deployment, not embedded in code or documentation.
- Secure production mode: TLS, CSP, secure cookie, proper CORS, rate limiting, MFA for admins, rotation, vulnerability scans, dependency lockfile, monitoring.
- Recovery: encrypted backups, restoration drill into isolated environment, tenant boundary checks, RPO/RTO agreed in ADR.
- No real pupil or parent data in local/demo UAT. Test fixtures are synthetic.

## 6. Required release gates
- Threat model per high-risk module (contract/finance, guardian portal, webhooks).
- Automated JWT validation, RLS/IDOR, concurrency, role/branch, PII masking, audit, consent and replay tests.
- App runtime role has least privileges; migrations performed by separate privileged migration role.
- External integration permissions verified with provider in approved application; no bypass by using personal tokens.
- Production penetration/abuse/security review + legal/privacy review; successful restore + incident drill.
- Security gate signed off separately from feature-complete gate; do not claim a feature production-ready on passing unit tests alone.

## 7. Traceability
Security matrix maps to all module PRDs. When adding any endpoint, Codex must document actor, tenant+branch filter, target object authorization, PII classification, idempotency and audit event in its OpenAPI operation notes and tests.
