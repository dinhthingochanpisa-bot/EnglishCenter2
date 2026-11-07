# 04 — Business Rules Engine & Golden Test Catalogue

**Normative property:** Business rules are **versioned and configurable by tenant and branch**. Concrete percentages, session thresholds and example amounts below are fixtures, not universal policies or commercial commitments.

## 1. Policy precedence & effective time
- Resolution order: base SaaS constraints → tenant policy → branch-specific override (if allowed) → customer/contract snapshot. Most-specific policy wins only if registry explicitly says it overrides; if two non-compatible active policies tie, reject with conflict rather than arbitrarily choosing.
- Each policy has \`policyId,version,scope,validFrom,validTo,timezone,approvalStatus,priority,eligibilityExpression,algorithmVersion\`; half-open active interval.
- For quote and contract, snapshot chosen policy versions, inputs and calculation trace. Policy edit creates new version with future effect; never silently recalculates signed contracts.
- Authorization and policy cannot be bypassed by client-supplied values; request must not directly specify "finalAmount", "remainingLessons", "payoutConfirmed".

## 2. Pricing/CSBH calculation vocabulary
\`listPrice\`, \`baseDiscountPercent\`, \`additionalDiscountPercent\`, \`discountBase\` (LIST/CURRENT_NET), \`voucherAmount\`, \`voucherPhase\` (PRE_PERCENT/POST_PERCENT), \`stackingGroup\`, \`eligibility\`, \`cap\`, \`roundingMode\`, \`netPrice\`.
- A base 10% discount on 30,000,000 gives 27,000,000.
- Extra 5% **additive on list** subtracts 1,500,000 → 25,500,000 total.
- Extra 5% **sequential on current net** subtracts 1,350,000 → 25,650,000 total.
- VND 500,000 voucher applied after sequential → 25,150,000; before percent may change both base and final depending configured rule. Must output full trace.
- Promo stacking: define mutual exclusion, base calculation, eligibility (New/Renew, groups, sibling, referral, founding class), time restrictions, cap, one-use. Define rounding at each stage (not only final).
- Discount ceiling crossing must trigger an explicit configured clamp or rejection and surfaced reason, no silent discount.

## 3. Entitlement/attendance
\`available = initialGranted + additionalGrants + credits - postedConsumes - postedAdjustments + reversals\` by **entitlement + units**, not a mutable counter.
- Presence charges \`configuredLessonUnits\` once when finalized.
- Example policy: 96 granted lessons and up to 4 qualified free excused absences. 4 eligible absences use free allowance and consume 0 lessons; 5th uses 1 lesson; later absence based on same policy. Configurable limit and period. No universal allowance constant.
- Backdated corrections can change which absence uses free allowance. Use deterministic event-time sorting and ledger reversals/adjustment; future charges must remain consistent.
- Sessions cancelled, reserved, or outside valid enrollment do not charge unless explicit separately approved exception.
- Trial status is not authorization; only trial entitlement or paid right with valid effective range allows roster addition.

## 4. Finance invariants
- Contract amount, net contractual liability, outstanding receivable, actual collected cash and recognized revenue are not equal by definition.
- Posted payment can allocate only up to payment amount and open receivable; external reference idempotent across retries. Payment intent is not posted payment.
- Refund valuation uses actual paid and signed/used scope, approved exclusions and taxes; never list price × remaining lessons by default.
- Approval does not equal payout. \`PAID\` after accountant verifies external settlement, or explicit manual evidence under financial control policy.
- Transfer: source debit and destination credit in same transaction; no overdraw, no double use of balance. Cross-product/branch conversion from explicit approved policy.
- Reverse financial posting rather than delete/update immutable ledger.

## 5. Cohort/BI semantics
- **Event period:** all Lead/QL/Check-in/Contract events occurring within period regardless of original lead cohort.
- **Lead cohort:** choose Lead creation between start/end and trace subsequent event progression of those same lead IDs; cohort funnel ratio numerator subset of denominator.
- Show lagged conversion count (older Lead→this-period Check-in/Contract) separately. A period Check-in count can exceed period Leads; this is not necessarily error, but cannot be labeled "lead cohort conversion".
- Active stock as-of day; Net = end stock - start stock by chosen paid/free rules; session occupancy and student counts per enrollment/person separately.
- Referrals: distinguish earned incentive/marketing CAC from tuition voucher (contra-revenue); report both with documented cost attribution.

## 6. Numbered golden test fixtures
| ID | Scenario | Expected outcome |
|---|---|---|
| GOLD-P01 | 30M base 10% + 5% additive list | 25.5M |
| GOLD-P02 | 30M base 10% + 5% sequential | 25.65M |
| GOLD-P03 | P02 + voucher 500k after discounts | 25.15M |
| GOLD-P04 | Voucher before percent on defined base | Different trace per configured sequence; amount verified by policy fixture |
| GOLD-P05 | Promotion eligibility expired | Discount not applied, explicit reason |
| GOLD-P06 | Two exclusive active CSBH same precedence | Conflict, no quote publish |
| GOLD-P07 | Policy edited after quote approval | Old quote hash/amount unchanged; new quote uses new policy |
| GOLD-P08 | Discount exceeds cap | Configured clamp or reject, logged |
| GOLD-P09 | Money calculation repeated 100 times | Exact decimal reproducibility |
| GOLD-L01 | 96 lessons, 4 eligible free absences | After 4: free 4 used, lessons consumed 0 on those |
| GOLD-L02 | Fifth eligible absence | Consume 1 lesson |
| GOLD-L03 | 1 finalized present session, retry same idempotency | Consume exactly once |
| GOLD-L04 | Edit finalized attendance | Old charge reversed and new charge posted once |
| GOLD-L05 | Class transfer effective next class session | Old roster until cutoff, target after |
| GOLD-L06 | Attendance while reserved | Block charge by scope |
| GOLD-F01 | 20M receivable, 5.5M posted payment | Outstanding 14.5M |
| GOLD-F02 | Payment webhook retry | No second posting |
| GOLD-F03 | Refund approved, no payout | Status remains PAYOUT_PENDING; not PAID |
| GOLD-F04 | Fee transfer 12 units from 20 available | Source 8, recipient +12 or converted target units per policy; atomic |
| GOLD-F05 | Two concurrent 12-unit transfers against 20 | One succeeds; other rejected/no negative balance |
| GOLD-A01 | Teacher adds trial student without right | 403/422 and no enrollment |
| GOLD-A02 | Test subjective grade missing | Result not publishable |
| GOLD-R01 | Prior-month lead, current-month check-in | Period count includes check-in; cohort of current-month leads excludes it |
| GOLD-R02 | Paid and free active student counted under configured policy | Dashboard value equals detail at same as-of |
| GOLD-S01 | Tenant B guessed Tenant A student ID | 403/404; no PII leak |
| GOLD-S02 | Siblings share guardian phone | Remain separate students with verified guardian relationship |
| GOLD-S03 | Same idempotency key different request body | 409, no extra financial/lesson record |
| GOLD-I01 | Signed provider webhook sent twice | One lead touch, two ingestion attempts logged |
| GOLD-POR01 | Parent accesses unrelated child | 403/404; no private data |

## 7. Test implementation guideline
- Build fixture factory with deterministic IDs, independent tenant A/B, fixed clock/timezone, policy version and seeded roles. Do not rely on wall clock.
- For every Golden ID produce input JSON, expected JSON, domain/service test, API integration and selected UI E2E where relevant; store in \`verification/golden/{domain}/\`.
- Compare outputs numeric Decimal not float; calculate and include trace checksum. Idempotency tests use concurrent workers and forced retry.
- A failing golden case blocks merge for that domain; changing expected output requires ADR and product-owner signoff.

## 8. Pending policy decisions
See \`08_OPEN_DECISIONS_ADR.md\`. Any non-approved algorithm choice must be explicit in fixture as **test example only**, never in seeded tenant defaults for production.
