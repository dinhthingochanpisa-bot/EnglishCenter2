# 02 — API Contracts v2.0: cross-module normative baseline

This file defines shared HTTP/API conventions for **planned Stage 03–09** endpoints described in each stage spec. The **implemented Stage 01/02 API** remains as documented in \`docs/API_STAGE02.md\` and controllers until a reviewed versioning migration. New routes below are **proposals**, not existing deployed endpoints.

## 1. Path, authentication and ownership
- Tenant APIs: \`/v1/tenants/:tenantId/{domain}/...\` with JSON and bearer OIDC through same-origin frontend BFF.
- Platform: \`/v1/platform/...\`; Parent portal: \`/v1/portal/...\` (tenant derived from verified portal account).
- Backend authenticates JWT issuer/aud/signature, maps subject to platform user, validates membership, role, branch and resource scope. URL \`tenantId\` is scope selector only, never authority. For object ID in wrong tenant return 404 or 403 by documented anti-enumeration policy.
- Every write stores actor, correlation/request IDs and audit. Browser receives least-privileged fields.
- Prefix examples are chosen for consistency and require review vs existing controller routes before implementation.

## 2. Common request/response grammar
**List:** \`GET /v1/tenants/:tid/classes?branchId=&status=&cursor=&limit=25\`; response:
\`\`\`json
{
  "data": [{"id":"uuid","status":"ACTIVE"}],
  "page": {"nextCursor":null,"limit":25,"hasMore":false},
  "meta": {"requestId":"uuid","asOf":"2027-01-05T09:00:00+07:00"}
}
\`\`\`
Use stable sort \`created_at,id\`. Limit 1..100; no unbounded export in list endpoints. Existing Stage 01/02 payload shapes may differ; migration plan needed before changing.

**Single:** \`{"data":{"id":"uuid","rowVersion":3,...},"meta":{"requestId":"uuid"}}\`; for preexisting APIs, adapt only with explicit compatibility version or documented frontend update.

**Error:** \`{ "error": { "code":"STALE_VERSION","message":"...","details":{"expected":2,"actual":3},"requestId":"uuid","retryable":false } }\`. Human-readable messages localized in frontend; stable machine code required.

**Money:** always decimal strings \`"25650000"\` + \`currency:"VND"\`. UTC RFC3339 timestamp \`...Z\`; \`localDate:"YYYY-MM-DD"\` where branch timezone critical; no ambiguous naive datetime. Lessons \`"1"\` or \`"0.5"\` with \`unit:"LESSON"\`. Defer money rounding to policy engine.

## 3. Status and retry semantics
| Status | Meaning |
|---|---|
| 200 | Read/command synchronous success; returned state authoritative |
| 201 | Resource created; \`Location\` with scoped id |
| 202 | Durable queued task accepted; do not label completed |
| 204 | Successful no-body action (rare; audit still stored) |
| 400 | Invalid JSON/request syntax |
| 401 | No/invalid/expired authentication |
| 403 | Authenticated but not permitted/branch scope |
| 404 | Not visible or not present (avoid IDOR leak) |
| 409 | Stale rowVersion, active conflicting state, duplicate idempotency body, resource collision |
| 412 | Explicit \`If-Match\` precondition failed (if used; choose consistently per route) |
| 422 | Well-formed request fails business eligibility, pricing conflict or approval guard |
| 423 | Tenant suspended/locked entity where product policy specifies |
| 429 | Rate limited; \`Retry-After\` |
| 500 | Unexpected internal error (sanitized; never expose DB stack) |
| 503 | Dependency outage (IdP/provider/queue), retry only where safe |

## 4. Idempotency, locking and optimistic concurrency
- Required \`Idempotency-Key: <uuid/random>\` for quote submissions, approvals, contract activation, payment post/reverse, attendance finalization, transfer/refund post, trial invitations, outbound delivery and external sync. Key scoped \`(tenant,actor or provider,route,hash)\`; retention window documented per action.
- Same key + same request returns same prior **business result** (including link to resource); same key + different request hash returns 409. Never issue a second payment/entitlement grant.
- Use \`If-Match: "v3"\` or body \`rowVersion:3\` depending existing compatibility; read models return version; missing version on risky PATCH/approve returns 428 or 422 consistently.
- For money and entitlement posting use DB locks/serializable + immutable ledger group and idempotency; optimistic version alone insufficient for concurrent double posting.

## 5. Canonical operations and sample payloads
### Pricing simulation (Stage 03)
\`\`\`http
POST /v1/tenants/{tid}/pricing/simulations
Content-Type: application/json
Authorization: Bearer <token>
\`\`\`
\`\`\`json
{"branchId":"uuid","personId":"uuid","customerType":"NEW",
 "packageVersionId":"uuid","asOf":"2027-01-05T09:00:00+07:00",
 "selectedPolicyVersionIds":["uuid"]}
\`\`\`
Response: \`200 {data:{listAmount:"30000000",payableAmount:"25650000",currency:"VND",trace:[{"ruleId":"uuid","base":"LIST_PRICE","delta":"-3000000"},...]},meta:{...}}\`.

### Attendance finalize (Stage 05)
\`POST /v1/tenants/{tid}/sessions/{sid}/attendance:finalize\`, Idempotency-Key and rowVersion. \`200\` returns status FINALIZED, lessonLedgerGroupId and result per student; if insufficient entitlement returns \`422 ENTITLEMENT_EXHAUSTED\`, not partial silent completion.

### Transfer request and execution (Stage 06)
\`POST /v1/tenants/{tid}/students/{studentId}/class-transfers\` body \`{sourceEnrollmentId,targetClassId,effectiveFrom,reason}\` -> \`201 SUBMITTED\`. Approval -> \`200 SCHEDULED\`, future executor -> \`COMPLETED\` with pair of effective-dated enrollments.

### Test grading (Stage 07)
\`POST /v1/tenants/{tid}/test-attempts/{id}/grades\` body \`{rubricVersionId,skill,score:"6.5",comment,...}\` -> DRAFT grade. Publish requires reviewer and all required skills.

### Refund payout (Stage 08)
\`POST /v1/tenants/{tid}/finance/refunds/{id}/confirm-payout\` body \`{paidAt,providerReference,verifiedEvidenceId,rowVersion}\` -> PAID only after server verifies approved request, settled reference and no prior duplicate.

### Provider webhook (Stage 09)
Ingress \`POST /v1/webhooks/{provider}\`, signature headers and provider event ID; \`202\` only if event durably queued; no unauthenticated mutation directly to CRM.

## 6. Security rules per endpoint
| Endpoint class | Required guards |
|---|---|
| General tenant list | membership + action permission + branch filter + PII field masking |
| Detail by id | resource tenant match and branch/object assignment |
| High-risk finance | explicit finance role, separation of duties, exact contract/ledger scope, audit, 2-step authorization if configured |
| Teacher | assigned teacher to class at **session time**, not current role only |
| Parent portal | verified guardian-student link, publication/consent and file grant |
| Platform | independent operator auth, no implicit tenant business read |
| Public intake/webhook | one-time token or provider signature, rate-limit/consent, feature flag and abuse protections |

## 7. Error-code registry baseline
\`TENANT_NOT_ACCESSIBLE\`, \`BRANCH_SCOPE_DENIED\`, \`RESOURCE_NOT_FOUND\`, \`STALE_VERSION\`, \`IDEMPOTENCY_CONFLICT\`, \`INVALID_TRANSITION\`, \`APPROVAL_ORDER_INVALID\`, \`SELF_APPROVAL_FORBIDDEN\`, \`PRICE_POLICY_CONFLICT\`, \`QUOTE_EXPIRED\`, \`PAYMENT_NOT_CONFIRMED\`, \`PAYMENT_OVERALLOCATION\`, \`ENTITLEMENT_NOT_VALID\`, \`ENTITLEMENT_EXHAUSTED\`, \`ATTENDANCE_ALREADY_FINALIZED\`, \`CLASS_CAPACITY_EXCEEDED\`, \`OPERATION_OVERLAP\`, \`PAYOUT_NOT_VERIFIED\`, \`CROSS_TENANT_TRANSFER_FORBIDDEN\`, \`PORTAL_CONSENT_REQUIRED\`, \`EXTERNAL_SIGNATURE_INVALID\`, \`RATE_LIMITED\`, \`UPSTREAM_UNAVAILABLE\`. Tests assert code, not just status.

## 8. Contract-first delivery for Codex
For each module produce checked-in OpenAPI 3.1 spec \`openapi/{domain}.yaml\` including auth schemes, enums, request/response schemas, decimal/time formats, standard errors, examples, pagination and idempotency. Generate typed frontend client, validate backend handlers and client integration in CI. Run schema compatibility diff against existing Stage 02 endpoints to prevent accidental break.
