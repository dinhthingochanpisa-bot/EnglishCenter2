# Stage 08 — Refunds, Fee Transfers, BI Dashboards, Alerts & Metric Reconciliation

**Spec LUM-ENG-08 v2.0-draft · M08 advanced + M15.** Dependencies: Stage 04 financial ledger, Stage 05 lesson entitlement ledger, Stage 06 student operations, Stage 07 renewal and learning records. Do not treat UI "approve" as completed payout.

## 1. Goals
Two separately controlled financial workflows: **Rút phí** (return approved refundable money to payer) and **Chuyển phí** (transfer lessons or monetary credit between student entitlements), with fully auditable accounting and no overdraw, duplicate processing or unilateral transfers. BI reports use signed-off metric dictionary with reproducible snapshots (not raw UI row count assumptions).

### Actors
CSKH/TVV request with contextual student view; Accountant reviews calculation, manager approves, Accountant posts **actual payout or transfer posting**. Finance Ops manages settlement and reconciliation. Branch and HQ managers read scoped BI; Marketing read lead/conversion analysis; senior manager read authorized consolidated multi-branch dashboard.

## 2. Refund flow (Rút phí)
Student 360 → Tuition/Contracts → Rút phí → select contract, invoice/payment history, lessons used/remaining and policy version → **server-calculated** refundable estimate and itemized deductions → choose reason / payment recipient / evidence → submit → Accountant review → Manager approve → Accountant executes payout and verifies bank/cash reference → status PAID and ledger reversal/adjustment.

**Important distinctions:**
- Cancellation of study/contract alone does not equal refund approval.
- Approval alone never marks money paid.
- Refundable amount may depend on list/net/realized sessions, non-refundable charges, discounts, referral bonuses, tax and existing debt — all from explicit tenant policy/ADR.
- Refund amount capped by **refundable unencumbered balance**, not simply \`remaining_sessions * catalog_price_per_session\`.
- Contract can have payment in multiple tranches and concurrent classes; reserve amount cannot be refunded twice.

## 3. Transfer flow (Chuyển phí)
Student 360 → Tuition → Chuyển phí → choose source student/contract + recipient student (same tenant unless platform-supported legal scenario approved) → select transfer **money or lessons**, show exact valuation/conversion rule and net effects → submit → Accountant review → Manager approve → atomic posting of source debit and target credit → destination student's available money/units updated only after confirmed transaction; all related ledger adjustments/outbox included.
- Must preserve originating discount and benefit conditions or explicitly recalculate under transfer policy.
- Cross-product, cross-branch and cross-currency require explicit conversion/settlement policy; otherwise fail closed.
- Mixed fee and lesson transfer not allowed in single action unless explicit policy and paired transaction design.
- Prevent using the same remaining sessions for both refund and transfer (hold/reservation model).

## 4. Proposed models / constraints
| Table | Fields / safeguards |
|---|---|
| finance_adjustment_policies/versions | branch/type scope, valuation basis, fee exclusions, percent limits, taxes, rounding, approval threshold |
| refund_requests | person_id, contract_id, payment_refs[], reason, requested_amount, calculated_snapshot, status/version |
| refund_calculations | policy_version, contract and ledger snapshot hashes, amount components/deductions, eligibility/exclusions |
| payout_intents | recipient safe token/ref, channel, amount, pending verified payout, external payout idempotency key |
| payout_transactions | provider reference, confirmation state, postedAt, reversal reason; separate from approval |
| fee_transfer_requests | from_student, to_student, source_grant, target product/branch, type LESSONS/MONEY, source_units, target_units, converted_value, snapshot |
| fee_transfer_postings | source ledger debit + target ledger credit references, group id; no partial commit |
| finance_adjustment_approvals | workflow instance, decision version, approver SoD, evidence |
| finance_ledger_entries / entitlement_ledger | reuse Stage 04/05 immutable ledgers with source refs; double posting idempotency |
| dashboard_snapshots | definition version, tenant/branch, period, cutoff, dimension filters, calculation job, metric hash |
| metric_definitions/versions | code, formula, numerator/denominator, time basis, source grain, scope, null policy, excluded statuses |
| metric_reconciliation_runs | snapshot id, source totals, diff and status, signed_off_by |
| alert_rules/deliveries | branch/tenant scope, threshold, schedule, channel, run/delivery ids |

**Lock strategy:** posting locks source contract/available balance and request versions; transaction must atomically reserve/debit/credit; outbox and audit included. No alternate direct mutation API.

## 5. State machines
- Refund \`DRAFT → SUBMITTED → ACCOUNTANT_REVIEWED → MANAGER_APPROVED → PAYOUT_PENDING → PAID\`, with \`REJECTED/CANCELLED/PAYOUT_FAILED/RETRY_PENDING\`. Paid is only after verified external settlement or approved manual evidence. Refund cancellation after PAID requires reversal/new request.
- Transfer \`DRAFT → SUBMITTED → ACCOUNTANT_REVIEWED → MANAGER_APPROVED → POSTING → COMPLETED\`, with \`REJECTED/CONFLICTED/FAILED_RETRYABLE\`; a row cannot be COMPLETED without both ledger sides committed.
- BI snapshot \`QUEUED → COMPUTING → RECONCILING → PUBLISHED\` or \`FAILED/STALE\`; changes to metric definition create new version and new snapshots.

## 6. Financial API contracts (prefix \`/v1/tenants/:tenantId\`)
| Route | Payload / result |
|---|---|
| POST \`/finance/refund-quotations\` | contractId, asOf, reason → valuation trace, refundableCap, tax/debt assumptions |
| POST \`/finance/refunds\` | personId,contractId,calculationHash,recipientRef,reason → 201 DRAFT |
| POST \`/finance/refunds/:id/submit\` | rowVersion → PENDING |
| POST \`/finance/refunds/:id/decisions\` | stepId,decision,reason → next |
| POST \`/finance/refunds/:id/payout-intent\` | payoutMethod,reference; finance.payout.manage |
| POST \`/finance/refunds/:id/confirm-payout\` | providerRef,paidAt,attachmentRef,Idempotency-Key → PAID |
| GET \`/finance/refunds/:id/ledger\` | payout and rollback history |
| POST \`/finance/transfer-quotations\` | fromStudentId,toStudentId,sourceGrantId,transferType,requestedUnitsOrAmount,targetPackageVersionId → preview both sides |
| POST \`/finance/fee-transfers\` | quotationHash, from/to, amount/units, reason → 201 DRAFT |
| POST \`/finance/fee-transfers/:id/decisions\` | stepId,decision,rowVersion → next |
| POST \`/finance/fee-transfers/:id/post\` | Idempotency-Key, rowVersion → debit+credit+audit atomically |
| GET \`/finance/fee-transfers/:id/ledger\` | source+recipient entry pairs |

**Money** as decimal strings, quantity as explicit units. All financial writes \`Idempotency-Key\` + rowVersion and server authority. Approval person/branch scope enforced; SoD no self-final payout.

## 7. KPI dictionary (proposed baseline; see \`../METRIC_DICTIONARY.md\` for precise contracts)
| Metric | Grain/time | Counting rule |
|---|---|---|
| Lead | distinct crm_lead IDs created in period, first source | Not equal to qualified leads |
| QL | leads meeting qualified-at event in period | Lagged conversions tracked separately |
| Check-in | completed events in period, unique people optionally separately | Walk-in included, no draft |
| Test/Trial | events completed in period | At least one attempt/session; distinguish unique person vs events |
| Contract New/Renew | signed/activated policy date, never draft | Trace source/owner |
| Active at cutoff | valid, non-suspended enrolled paid/free depending defined tenant policy | As-of date; snapshots consistent |
| Active net | active_end - active_start, optionally admissions/exits reconciliation | Avoid summing daily stock |
| Renewal/retention | eligible denominator frozen per policy/window; count signed renewals by effective date | Show lagged old cohorts |
| Referral share/CAC | originated/converted KHGT with dedup and incentive cost | Distinguish commission cost and revenue discount |
| Class size/low size | active roster at cutoff, per class+branch | threshold configurable; average weighted/unweighted explicitly |
| Remaining lessons | sums of valid entitlement grant and posted ledger units | Snapshot only, not manually edited UI number |
| Revenue/receivable | recognized revenue vs contract value vs cash collected | Must never mix |

**Funnel:** configurable Lead → QL → Check-in → Test → Trial → HĐ. Offer **Cohort mode** (numerator members drawn from earlier same cohort denominator) and **Period-activity mode** (events in period independent of original cohort); for period-activity, do not label ratios as cohort conversion. Show stage exclusions and lagged transitions; avoid numerator > denominator misleading metric. Tenant/HQ/branch filters honor per-metric source branch; program version and date boundaries.

## 8. BI UI & delivery
- Executive overview cards and trend chart, branch selectors (one branch, group region, all tenant) and time selectors month/quarter/YTD/custom dates.
- Funnel by cohort/source/owner with row drill-through; source pies by Check-in and Contracts; contracts New/Renew; Active start/end/net with paying/free break; expiry 3/6-month renewal list; dropout reason breakdown; class capacity and low size alerts.
- Finance dashboards by approved permissions with outstanding schedule, aging, receipts and historical adjustments; no bank details in broad management reports.
- Snapshot metadata: \`asOf\`, \`lastRefresh\`, formula version, denominator, source systems; managers can reconcile to detail.
- CSV export with PII masking and audit; refresh/latency SLO documented.

## 9. BI / alert API proposals
| Route | Function/permission |
|---|---|
| GET \`/reports/dashboard?branchId=&from=&to=&grain=\` | tenant/branch KPI summary; report.read |
| GET \`/reports/funnel?cohortFrom=&cohortTo=&mode=&sourceId=\` | structured steps+lag shares+denominators |
| GET \`/reports/active?asOf=&branchId=\` | paid/free/reserved definitions and counts |
| GET \`/reports/contracts?from=&to=&type=\` | New/Renew, value and trend |
| GET \`/reports/retention?windowMonths=3|6\` | renewal denominators, expected expiry |
| GET \`/reports/referrals?from=&to=\` | KHGT and CAC attribution |
| GET \`/reports/classes?asOf=&lowSizeOnly=\` | class sizes and thresholds |
| GET \`/reports/metrics/:code/definition\` | formula, source grain, version and owner |
| POST \`/reports/reconciliation-runs\` | authorized finance/report admin; asOf+scope |
| GET/POST \`/alerts/rules\` | low size, expiry, debt/renewal, permission alert.manage |
| POST \`/reports/snapshots:refresh\` | requires special admin; rate limit and queued job |

Responses include \`metricCode,version,asOf,grain,denominator,numerator,value,coverage,sourceSnapshotId\`. Null means undefined, **not zero**.

## 10. Acceptance & golden tests
- Refund request amount derived from **posted** cash + entitlement usage + frozen price/policy and exclusions; never arbitrary client amount. Multi-payment/discount/debt cases.
- Refund state cannot become PAID after approval alone; payout external ref required; retry never double pays.
- Fee transfer source balance ≥ transfer, recipient credit matches debit valued by frozen conversion; one-sided failure rolls back fully; simultaneous requests cannot overdraw.
- 2 tenant and branch isolation, PII read/extract permission, SoD and audit on all finance changes.
- BI test fixture has leads created prior month, check-in current month; cohort mode keeps conversion bounded, period mode counts current period events, numerator/denominator visible.
- Active sum across branches does not double-count person across classes when definition is per person; separate enrollment counts shown.
- Finance report totals reconcile exactly to Stage 04 ledger and Stage 05 lesson ledger at same as-of; manager snapshot stable after later edits.
- Alert low size configurable per branch, threshold edge tested; no duplicate notifications on retried queue.
- Browser dashboards have controls and drill-down that reconcile; API perf/exports with large synthetic dataset, RBAC and accessibility PASS.

## 11. Pending ADR
Refund formula and tax treatment; transfer cross-product/branch conversion; Active taxonomy; renewal eligibility and rate; KPI date semantics, branch attribution and first/last touch source; alert SLAs and retention. None may be assumed for all commercial tenants.
