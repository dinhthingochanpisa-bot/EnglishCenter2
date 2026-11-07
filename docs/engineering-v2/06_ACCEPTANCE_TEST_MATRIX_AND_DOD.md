# 06 — Acceptance Test Matrix, Test Pyramid & Definition of Done

**LUM-ENG-QA v2.0** · Applies to every feature; before entering Stage 03, close Stage 02 browser UAT and runtime issues. API smoke **46 PASS** on the user's machine is observed, not an assertion that all modules are complete.

## 1. Test layers and required evidence
| Test level | What it proves | Minimum evidence |
|---|---|---|
| Schema/migration | constraints, indexes, safe migration, RLS runtime | migration logs + DB integration SQL |
| Unit/domain | deterministic policy rule and state machine | fixtures including edge cases and golden amounts |
| Service/API | authorization, validation, transaction/idempotency | status + stable error code + persisted state |
| Cross-domain integration | one source-of-truth across CRM/fees/sessions/reports | reconciled fixture with same Person |
| Browser E2E | actual Next.js/OIDC/backend complete journey | screenshot or test run id; no PII |
| Security/negative | 401/403/404/409/422, IDOR, role scoping | negative test matrix per operation |
| Performance/resilience | baseline on synthetic data; retry/concurrency | measured p95/volume and fault injection results |
| UAT | owner accepts policy semantics and UI usability | role-by-role checklist and signed decision record |

## 2. Stage acceptance grid
| Stage | Must demonstrate for sign-off | Core test IDs |
|---|---|---|
| 03 Product/CSBH | versioned product & pathway, price trace, approval, quote PDF, policy conflict | GOLD-P01..P09, SEC-01..08 |
| 04 Contract/Collection | signed immutable contract; 20M-5.5M = 14.5M due; partial payments and reversal | GOLD-F01..02, SEC-11 |
| 05 Classes/Attendance | schedule/teacher assignment, 96 lesson/4 free absence example, idempotent finalization, derived balance | GOLD-L01..L04 |
| 06 Student Operations | future transfer after last lesson, short/long reserve approval, dropout/graduation manager confirmation | GOLD-L05..L06, SEC-03..08 |
| 07 Academic & CSKH | 3–5 placement forms, human grade, trial gate, PDF teacher/monthly report, Happy Call + renewal | GOLD-A01..A02 |
| 08 Finance Adjustment & BI | refund payout verified, source debit+receiver credit atomic, cohort funnel and active snapshots reconcile | GOLD-F03..05, GOLD-R01..02 |
| 09 Integrations & SaaS | signed webhook dedup, provider consent, family portal isolation, SaaS quotas and backup restore | GOLD-I01, GOLD-POR01, SEC-09..14 |

## 3. User acceptance scenarios (UAT)
### UAT-001 Cross-functional customer journey
Marketing source "Event" → Lead without phone → add valid phone QL → care history → Check-in QR/reception → Test → optional trial with valid right → quote with CSBH → accountant approves → New contract → actual cash collection → class enrollment → teacher attendance → monthly report → Happy Call → renewal pipeline. **Same Person ID** across all stages, no duplicate ledger.

### UAT-002 Two independent tenants
Tenant A and B use different branch/product/price/absence/reserve settings. Employee A must not view/edit tenant B's records, exports, documents, event traces or subscription entitlements. Tenant B cannot infer count or PII of tenant A.

### UAT-003 Finance integrity
Create 20M receivable, collect 5.5M, check 14.5M due; retry same payment; issue payout only after approval and verification; no accounting event can be erased, overdrawn or posted twice.

### UAT-004 Teacher attendance
Enter Present/Late/Excused/Unexcused; submitted vs finalized; fourth eligible absence free, fifth charged under configured demo rule; edit finalized session through correction and ensure balance reconciles.

### UAT-005 Contextual class actions
Roster row → Transfer destination/effective start; roster updates exactly after last old-class lesson. Reserve with GVCN/KT/QL approvals; dropout/graduation approved by manager; all events visible in student history.

### UAT-006 Guardian privacy
Parent with two verified children views both published reports, cannot read internal notes or other child's report. Withdraw access and verify immediate denial.

### UAT-007 Admin/production
Provision second tenant, set role/branch limits, suspend/reactivate; verify tenant data preserved; backup restore isolated with consistency checks and audit.

## 4. Per-task Definition of Done (ALL)
1. Module PRD and exact acceptance cases linked in PR.
2. Decision register updated; open policy decisions either approved or feature-flagged off, not guessed.
3. Schema/Prisma migration + RLS/composite FK and safe rollback/data backfill when schema changes.
4. OpenAPI spec + typed client + backend authorization, audit and idempotency.
5. UI complete for happy/empty/loading/error/stale/suspended states; accessibility and input focus regression.
6. Deterministic unit tests, API/DB integration and negative cases; golden tests pass.
7. Browser E2E on relevant roles; screenshots/logs scrubbed; build/lint/typecheck/CI pass.
8. Versioned output for quotes, financial events, attendance and published reports; no destructive writes.
9. Operational diagnostics/log correlation + monitoring/backups updated.
10. Product owner UAT approval, release note and handoff status updated. **Without product sign-off, status remains "implemented awaiting UAT."**

## 5. Gate levels
- **G0 SPEC REVIEWED:** scope, user journey, API, data, policy and decision ADR ready.
- **G1 IMPLEMENTED:** code + migrations + unit and static checks.
- **G2 INTEGRATED:** API/RLS/negative tests and cross-domain reconciliation.
- **G3 UAT SIGNED:** role-based end-to-end accepted on synthetic dataset.
- **G4 PILOT APPROVED:** security/legal/backup/performance/monitoring, support readiness.
- **G5 PRODUCTION APPROVED:** audited release with deployment rollback and post-release verification.

## 6. How Codex reports results
For every Stage: file change summary, commit/PR URL, migrations and RLS evidence, test commands and pass/fail table, untested scenarios, decisions needed, security risks, demo URL or screenshots (synthetic only). If tests cannot run, explicitly state BLOCKED, do not claim completion.
