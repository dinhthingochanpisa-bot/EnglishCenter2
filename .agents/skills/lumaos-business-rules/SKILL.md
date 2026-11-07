---
name: lumaos-business-rules
description: Design, implement, or verify LumaOS pricing/CSBH, contracts, lesson entitlement, attendance, reserve/transfer/refund, renewal or BI formulas; require versioned policies, calculation traces and golden tests.
---

# LumaOS Business Rules & Golden Tests

## When to invoke
Use for Stage 03–08 policy or calculation changes (catalog/pricing/CSBH, quotes, contracts, collections, classes, attendance, entitlements, transfer, reserve, dropout, refund, renewal and reports). Also use during product-owner review of any policy or KPI discrepancy.

## Source priority
1. \`AGENTS.md\`, approved product-owner decisions and signed ADRs.
2. \`docs/engineering-v2/04_BUSINESS_RULES_AND_GOLDEN_CASES.md\`, \`08_OPEN_DECISIONS_ADR.md\`, target Stage PRD in \`docs/engineering-v2/stages/\`.
3. \`01_DOMAIN_AND_DATA_CONTRACTS.md\`, \`02_API_CONTRACTS.md\`, \`06_ACCEPTANCE_TEST_MATRIX_AND_DOD.md\`.
4. Implemented Stage 01/02 source, migration, tests and explicit effective policy snapshot. Historical reference PRD/ERD are **intent**, not evidence code exists.

## Required analysis before coding
1. Name the aggregate owner and user story. Write inputs, outputs, units, effective date and tenant/branch scope.
2. Classify each policy element as **APPROVED / OPEN ADR / TEST FIXTURE ONLY**. Pending Stage 03: ADR-201 stacking and caps; ADR-202 voucher phase/expiry; ADR-203 rounding/tax/freeze; ADR-223 approval SoD. Never turn a single center's tuition/discount example into a global SaaS default.
3. Define deterministic algorithm: predicate eligibility, price base/current net, stacking and exclusivity, rounding stage, effective version, override precedence, amount/lesson ledger, state transition and rollback/reversal.
4. Design input/output trace and exact-error behavior before UI. Money is decimal numeric/string at JSON boundary, not JavaScript floating-point approximations.
5. Record immutable source/version snapshot and audit: quote → contract, receipt/receivable ledger, enrollment/attendance entitlement ledger, refund/source debit + destination credit.
6. Explicitly distinguish proposed vs executed/paid: approvals are not payout; signed contract is not automatically Active; completed Check-in is not an enrolled student.

## Golden cases (fixtures, not commercial defaults)
- **Pricing:** list 30,000,000 VND, CK 10% and extra 5%:
  - additive on list → 25,500,000;
  - sequential on current net → 25,650,000;
  - after-sequential voucher 500,000 → 25,150,000.
  Test before-vs-after percent phase, caps, exclusive promotions, expiry, renewal eligibility, tax and rounding under the **specified test policy**. Old approved quote hash/amount must remain unchanged after policy revision.
- **Lessons:** demo package 96 lessons, free allowance 4 eligible absences. First four eligible absences charge 0 lessons, fifth charges 1 **only under this fixture policy**. Duplicate finalization consumes once; correction reverses old ledger entry. Backdated absence and future class transfer must preserve history.
- **Finance:** 20,000,000 receivable − 5,500,000 posted = 14,500,000 due; payment intent ≠ payment posted; retry must not double-allocate. Refund not PAID until verified payout evidence. Fee/lesson transfer posts both sides atomically; concurrent overdraft prevented.
- **CRM/BI:** Lead, QL, Check-in and HĐ have distinct event dates; cohort funnel numerator is subset of denominator; a current-period Check-in may originate from prior-period Lead. Report lagged conversions rather than invent a >100% cohort rate.
- **Renewal/Active:** definitions require approved metric version, as-of timestamp, eligibility set and owner; Active paid/free/trial/reserved separately as configured.

## How Codex should implement tests
- Prefer deterministic seed fixtures with tenant A/B, branch X/Y, fixed clock/timezone, explicit policy version, and role assignments.
- Add domain-level tests and API tests for success and refusal (invalid amount, overlap, out-of-scope branch, expired quote, stale rowVersion, idempotency conflict).
- For financial/entitlement transactions, test concurrency, serialization retries, source ledger immutability and exact equality of reconciled totals.
- Couple API contract, TypeScript types, Prisma migration + RLS, UI presentation and calculation trace; never implement formula exclusively on frontend.
- Run matching actual test commands, and CI for same commit. If Stage 03+ domain code doesn't yet exist, produce a design and failing Golden fixtures only after owner confirms policy; do **not** invent green tests or present proposed endpoints as implemented.

## Final output / acceptance
Provide a **Rule Decision Table** (business condition → version → result → exception), list of pending ADRs, Golden fixture IDs and exact expected outcomes, tests executed with evidence, audit/ledger invariants, and explicit readiness **DESIGN / IMPLEMENTED / UAT_PENDING / APPROVED**. Block irreversible behavior until its governing policy is approved.
