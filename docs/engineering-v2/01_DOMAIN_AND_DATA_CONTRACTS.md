# 01 — Domain model, persistence contracts and schema evolution

**LUM-ENG-DATA v2.0 / Design draft.** This is the **integration contract** between all future stages, not a claim their tables exist in code. The existing Stage 01/02 Prisma schema/migrations win for already-implemented names; additions require migration and backfill strategy.

## 1. Identity & ownership: never duplicate the child
- \`tenant_id\` identifies independent commercial customer/org. Every tenant-owned row and join must include tenant boundary; \`branch_id\` scopes operations; \`person_id\` is durable human identity; \`student_id\` denotes student profile, **not** a paid learner.
- Lead vs QL is funnel qualification; Customer/Check-in is a point-of-sale lifecycle; Paid/Active is entitlement/enrollment status dependent on finance + scheduling policies. These are orthogonal.
- N:N guardian-child; two children may share phone/guardian. Cross-tenant person data **cannot** be merged, even if contact identical.
- An individual may appear in different branches within one tenant; maintain \`crm_person_branches\`/source touches and restrict by actor scope, not create another student master.
- Avoid repeating person name/phone everywhere except controlled **historical snapshots** (quote/contract/report). Snapshots are immutable and encrypted/redacted.

## 2. Domain aggregates and ownership
| Domain owner | Aggregate root | States / authoritative source |
|---|---|---|
| Identity | Tenant, Branch, Membership | Stage 01 Core; branch scope, audit |
| CRM | Person, Lead, Checkin, Source | Stage 02; CRM status and provenance |
| Catalog | ProductVersion, PackageVersion, PathwayVersion | Stage 03 immutable published catalog |
| Pricing | PolicyVersion, PricebookItem, QuoteVersion | Stage 03 exact calculation |
| Contract | ContractVersion | Stage 04 signed terms |
| Finance | Receivable, PaymentTransaction, LedgerGroup | Stage 04 money posting |
| Delivery | Class, Session, Enrollment | Stage 05 effective-dated participation |
| Lessons | EntitlementGrant, EntitlementLedger | Stage 05 grant/consume/reverse |
| Operations | StudentOperationRequest | Stage 06 state machine + timed execution |
| Academic | TestAttempt, TrialEntitlement, MonthlyReportVersion | Stage 07 academic authority |
| CSKH | HappyCall, RenewalCase, Meeting | Stage 07 student relationship |
| Adjustments | RefundRequest, FeeTransferRequest | Stage 08 paid/reallocated only after posting |
| Reporting | MetricDefinitionVersion, Snapshot | Stage 08 source reconciliation |
| Integrations | ProviderConnection, WebhookEvent | Stage 09 provenance |
| Portal | GuardianPortalAccess | Stage 09 verified relationship |
| SaaS | TenantSubscription, UsageMeter | Stage 09 platform commercial |

## 3. Standard fields (DB implementation contract)
Tenant-owned base record:
\`\`\`text
id uuid primary key
tenant_id uuid NOT NULL
branch_id uuid NULL if truly tenant-wide
status text/check enum
created_at timestamptz NOT NULL
created_by uuid NULL (platform service actor may be explicit service identity)
updated_at timestamptz NOT NULL
updated_by uuid NULL
row_version bigint NOT NULL DEFAULT 1
archived_at timestamptz NULL
correlation_id uuid NULL for chain
\`\`\`
- Composite FK child \`(tenant_id, parent_id)\` → parent \`(tenant_id,id)\`. Tenant+branch FK when branch-owned.
- Unique constraints on \`(tenant_id,code)\`; idempotency unique \`(tenant_id,action,idempotency_key)\`.
- \`valid_from\`, \`valid_to\` use half-open intervals \`[from,to)\` for effective-dated assignments, version, policy and enrollment. Store UTC instants with source branch timezone; UI uses local and clearly labels timezone. Inclusive/exclusive UX days documented.
- Decimal amounts always strings at JSON boundary, PostgreSQL NUMERIC/integer unit, currency explicit; lesson quantities decimal units with configured precision. No float summing.
- Soft archive with audit where regulation/retention allows; never hard-delete accounting, attendance, grades, signed/issued docs.
- PII may require separate encryption, access log and redact in list/search/export. Do not log tokens, whole guardian contact details or financial credentials.
- Foreign IDs always verified under current tenant context; never trust client-supplied \`tenantId\` as authorization.

## 4. Commands vs queries, state machines and events
- A posted immutable record is corrected via new row and reference \`reversal_of_id\`, not UPDATE overwriting history.
- Commands contain authenticated actor, tenant, request hash, rowVersion, effectiveAt and idempotency key. Event emitted via **transactional outbox** with same DB commit.
- UI read model joins across domains for Customer 360; do **not** reimplement financial ledger or attendance logic in frontend.
- Scheduled effects (transfer/reservation expiry/notification) require durable jobs and idempotent handler.

## 5. Referential and concurrent invariants
1. One source attendance row per \`(tenant,session,enrollment)\` and one charge group per finalized record version.
2. No payment allocation across tenant; no recipient credit without source transfer debit in same transaction.
3. No quote references published version missing/inactive as-of quote policy; historical quotes still readable after retirement.
4. Immutable published grading/report version; correction new version.
5. Active class membership as-of timestamp computed from half-open effective range; no overlap if policy restricts.
6. No merged Person based only on shared guardian phone.
7. Reject inconsistent \`rowVersion\` with HTTP 409; high-risk posting transaction uses row locking/serializable.

## 6. Migration plan for each stage
1. Inspect actual Prisma model names and SQL migrations; compare conceptual ERD; produce migration ADR.
2. Introduce additive tables/columns with nullable/backfill path; append RLS policies and composite FKs in SQL migration (Prisma alone insufficient).
3. Ensure \`app_runtime\` permissions allow necessary operations without DB-owner bypass RLS; guard \`FORCE ROW LEVEL SECURITY\`/role design as appropriate.
4. Update seed synthetic fixtures and **negative cross-tenant** tests.
5. If breaking, use expand→backfill→dual-write/read migration→contract; include data safety and rollback/recovery plan. Avoid dangerous \`migrate reset\` on existing data.
6. Add immutable audit/outbox changes, indexes; \`EXPLAIN\` critical queries with 100k+ synthetic rows for scale.
7. Document data ownership, CRUD/state/API error mapping, updated data dictionary and post-migration reconciliation.

## 7. Stage compatibility requirements
- Stage 03 attaches quote to Stage 02 Person, not new student ID.
- Stage 04 contract attaches to quote version and Person; lesson grants triggered only after approved activation rules.
- Stage 05 enrollment attaches to student profile + entitlement; trial rights from Stage 07 are alternate authorization.
- Stage 06 cannot bypass Stage 05 scheduled enrollment operations.
- Stage 07 periodic report aggregates Stage 04 finances and Stage 05 lesson ledger as-of an immutable cutoff.
- Stage 08 refund/transfer authoritative on Stage 04 and Stage 05 ledgers; reports read as-of consistent snapshots.
- Stage 09 provider adapters append CRM source touch in Stage 02, never call arbitrary SQL write from client.

## 8. Data dictionaries deliverable per module
For every new table provide: column, type, null, default, allowed values, business meaning, owner, PII class, retention, search/index, tenant/branch scope, FK and write action. For every relationship provide cardinality, deletion/archive rule, effective date, unique constraints and rollback note.
