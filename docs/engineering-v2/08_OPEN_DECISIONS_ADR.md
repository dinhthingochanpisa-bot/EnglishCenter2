# 08 — Open Decisions / ADR Approval Register

**LUM-ENG-ADR v2.0**. "CONFIRMED" reflects product-owner decisions made in discussion; "OPEN" requires explicit approval. A draft specification is not authorization to impose a universal commercial policy.

## A. Confirmed product constraints
| ID | Decision |
|---|---|
| C-01 | Commercial multi-tenant SaaS with independent organizations and multiple branches |
| C-02 | Person → Lead → QL → Check-in → Student/Customer 360 identity preserved |
| C-03 | Lead/QL before visit; Customer means visited; Walk-in can start at point of sale |
| C-04 | Configurable sources Event, School, Page, Zalo OA, Google Ads, KHGT, CTV, Walk-in |
| C-05 | Student actions located in class roster / Student 360; immutable actor/time history |
| C-06 | Attendance required to consume lessons; present, late minutes, absent excused/unexcused |
| C-07 | Absence rule configurable, 96 lessons/4 free absences is example only |
| C-08 | Reservation type/limits/workflow configurable; GVCN → KT → QL approval intended |
| C-09 | Transfer to destination at effective start after last old-class eligible session |
| C-10 | Dropout/graduation require manager approval; last lesson is cutoff |
| C-11 | Pricing supports additive/sequential percentages and voucher before/after base CK |
| C-12 | Refund/fee transfer must have approval and actual ledger/payment posting |
| C-13 | Happy Call + monthly learning reports + renewal within Student 360 |
| C-14 | Frontend cannot access database or independently grant authorization |
| C-15 | Configurable funnel, active, retention, referral and class low-size metrics |

## B. Pending decisions
| ADR ID | Module | Question | Handling until approved |
|---|---|---|---|
| ADR-201 | Price | Overlapping CSBH precedence, stacking base, discount cap | Reject ambiguity; simulate only |
| ADR-202 | Price | Voucher phase, redemption/use reservation, signup expiry, exception thresholds | Per-policy configuration; feature gate |
| ADR-203 | Price | Currency rounding, tax inclusion, freeze at quote/deposit/signature | Draft only, no real invoice |
| ADR-204 | Contract | Renew eligibility vs New, cancellation charge, signing provider | Explicit reviewer classification |
| ADR-205 | Payment | Evidence for bank/pos/cash, installments, overpayment and chargeback | Accountant verified before posted |
| ADR-206 | Lessons | Entitlement after signed vs deposit vs paid; multi-class spend priority | Block grant until explicit policy |
| ADR-207 | Attendance | Exact 4-boundary, class sessions vs lesson units, late/absent/makeup charging | Mandatory tenant policy |
| ADR-208 | Attendance | Backdated correction order, auto-finalization and calendar changes | Audit reversible recalculation |
| ADR-209 | Reserve | Short/long based on missed sessions vs days, max duration, partial scope | No effective change before approval |
| ADR-210 | Transfer | Cross-product/branch unit conversion, schedule conflict and capacity override | Block ambiguity |
| ADR-211 | Exit | Multi-class scope and graduation vs course vs center exit | Explicit scope |
| ADR-212 | Refund | Valuation based on actual paid, discounts, used units, tax, debt, nonrefundable parts | Quote-only until approved |
| ADR-213 | Fee transfer | Money/lesson ratio, siblings, cross-branch account, partial allocation | Same tenant, explicit approved policy |
| ADR-214 | Academic | Test band/rubric, item banks, subjective grading and report review | Human review required |
| ADR-215 | Trial | Session quota, re-trial, paid/free right and trial report approval | Trial entitlement required |
| ADR-216 | Monthly report | Reporting cutoff, teacher comments, finance visibility and delivery chain | Draft/internal until reviewed |
| ADR-217 | Renewal | Eligibility denominator, 3/6 month horizon and forecast algorithm | Display assumptions |
| ADR-218 | BI | Paid/free/reserved active taxonomy, attribution, cohort vs period funnel | Definition version needed before publish |
| ADR-219 | Integration | Meta/Zalo scopes/API availability, consent, marketing attribution period | Sandbox adapters only |
| ADR-220 | Guardian | Identity verification/consent, data visibility and revocation | External portal disabled |
| ADR-221 | SaaS | Subscription plan/pricing/quota, offboarding, read-only and support grant | Pilot configuration only |
| ADR-222 | Platform | Hosting, retention, encrypted backups, RPO/RTO, incident SLA and minor-data law | Block production rollout |
| ADR-223 | Approval | Self-approval prohibition/thresholds, deputies and workflow override | Minimum separation of duties |

## C. ADR document template
Create file docs/adr/ADR-xxx-title.md:
- ID, title, version, date, approver and status Proposed / Approved / Superseded / Rejected.
- Observed business question and affected modules.
- At least two alternatives with UX and technical trade-offs.
- Decision: formula, threshold, unit, valid date/timezone, tenant/branch scope.
- Migration and impact on historical quote/contract/report.
- Security, consent, financial or legal review.
- Concrete golden examples including boundary, error and idempotency.
- Written approval, then update module PRD, API, DB, state machines and tests.

## D. Codex guardrail
Codex may draft options but may **not** silently convert a test/example business rule into organization-wide defaults. If decision blocks irreversible money, learning entitlement or PII behavior, keep that operation feature-gated until approved.
