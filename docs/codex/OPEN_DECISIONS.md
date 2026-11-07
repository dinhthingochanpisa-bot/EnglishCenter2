# DECISION REGISTER — confirmed vs pending

This document distinguishes requirements already confirmed by product owner from questions requiring an ADR. Do not silently convert open questions into immutable defaults.

## Confirmed
| ID | Decision |
|---|---|
| D-001 | Commercial **multi-tenant SaaS**, independent organizations; multi-branch inside tenant. |
| D-002 | One continuous Person/Customer/Student 360 history; lead/QL separate from customer visited/paid Active. |
| D-003 | Contextual Actions in current operational screen. |
| D-004 | Configurable tenant/branch policies with effective date and version; no hard-coded 4 lessons, voucher precedence, short/long reserve thresholds. |
| D-005 | Parent/guardian can relate to multiple children; duplicate suggestion, no auto merge solely by phone. |
| D-006 | Class transfer: effective start; destination enrollment after old final class session; preserve history. |
| D-007 | Tạm dừng = bảo lưu; reserve approval GVCN → KT → QL under configurable management authority. |
| D-008 | Dropout/graduation need manager approval and last session as cutoff. |
| D-009 | Refund and fee transfer are separate approved financial workflows; booking/ledger effects atomic. |
| D-010 | Happy Calls & renewal data live inside Student 360, with manager consolidated 3/6-month view. |
| D-011 | Reports funnel configurable; consistent cohort vs period definitions. |
| D-012 | Frontend uses authorized backend API only; never direct DB access. |

## Pending Product/ADR (defer implementation requiring fixed values)
| ID | Open question | Needed for |
|---|---|---|
| ADR-01 | Class Attendance absence policy fallback and allowance scope (per package/contract/period); excused vs unexcused; makeup | Attendance |
| ADR-02 | Reserve boundary if exact threshold 4; max reserve duration, resume and reassignment rules | Student Ops |
| ADR-03 | Refund valuation, non-refundable components, deductions, debt treatment, tax/e-invoice | Finance |
| ADR-04 | Transfer of lesson vs money between products/branches; cross-branch settlement | Finance |
| ADR-05 | Active/Free/Trial/Reserved status KPI definitions and effective time | BI |
| ADR-06 | Renewal LT2 eligibility vs top-up/multiple contracts and measurement cohort | Renew/BI |
| ADR-07 | Quote/CSBH conflict priority, price-hold date, discount cap, rounding, overlap and exception approvals | Stage 03 |
| ADR-08 | How tenant managers configure approval route/amount thresholds and delegation | Workflow |
| ADR-09 | Official Meta/Zalo OA permissions, webhook signing, consent, retry and attribution | Integrations |
| ADR-10 | SaaS plans/limits, region/residency, tenant offboarding, retention and recovery objectives | Platform |
| ADR-11 | Full parent portal permissions and minors' data consent/legal requirements | Parent Portal |

## Technical decisions to inspect, not assume
- Need add automated browser E2E framework? Pick based on repo/dependency compatibility and user approval if adding sizable dependencies.
- New `AGENTS.md` is authoritative for agent workflow; original historical docs may contain pre-runtime BLOCKED status.
- After demonstrating test realm success with manual email edits, fix generated realm so **fresh** test environments work; do not change production auth policy to permit incomplete accounts.
