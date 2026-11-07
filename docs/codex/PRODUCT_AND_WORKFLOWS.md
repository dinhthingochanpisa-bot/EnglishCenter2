# PRODUCT & BUSINESS RULES — consolidated

## Goal, audience, terminology
- **LumaOS**: commercial multi-tenant SaaS for independent language centers with multiple branches.
- Personas: platform operator, tenant owner, branch manager, MKT, sales/TVV, CSKH/QLHV, teacher, academic lead, accountant, senior leader; optional parent/student portal in later phase.
- `Lead`: inquiry, possibly no valid phone; `QL`: qualified by valid contact phone in implemented Stage 02; `Check-in`: actually arrived at point of sale, including Walk-in; `CUSTOMER` means visited, not yet paid; `Active` must be defined against contract/entitlement/student history later.
- Every department works on authorized slice of a single durable Customer/Student 360 profile.

## Operational pipeline (branch-specific, non-linear)
**MKT/Lead** from Page, Zalo OA, Google Ads, KHGT, CTV, school, event, Walk-in → Lead/QL → pre-sales care, scheduled call/visit → Check-in (direct or QR) → online placement Test (3–5 forms) / academic assessment / printable result → optional Trial requiring valid trial right → teacher's printable Trial Report → pathway consultation → quote and CSBH approval → New/Renew contract → payment, debt, invoice → assigned class → attendance/academic activity → monthly report and Happy Call → renewal or exit.

The pipeline is **not a forced linear enum**: skip trial, multiple tests, repeat contracts, parallel classes, Walk-in without Lead, child with multiple guardians, guardian with siblings.

## Configurable policy requirements (future stages)
- Tenant/branch sets products and preset pathways, tuition packages, class size thresholds, trial permissions, attendance / absence policy, reserve short/long boundaries, approval steps, CSBH effective periods and priority, funnel definitions.
- An example 96-lesson package allows **four excused/eligible absences without consuming lessons**, fifth eligible absence consumes as configured; **4 is only an example** and centers choose policy, which absence classes qualify and effective period. Do not hard-code.
- Every verified class attendance event impacts an **entitlement ledger**, not a mutable number directly; late/present/absent excused/unexcused/make-up modeled separately. Prevent duplicate charges and preserve edits as reversals/corrections.
- **Class transfers:** select destination class + effective start time; close old class enrollment after last eligible session, open destination at correct time. Keep complete membership history, avoid overlapping active class membership unless explicitly allowed.
- **Tạm dừng = Bảo lưu**. User selects short/long (configurable); from/to date; sessions learned/remaining, monetary reservation; workflow GVCN → accountant → manager; effective-date and return/resume rules. Duration vs number of class sessions must not be confused.
- **Stop study:** Dropout vs Graduation; last class session is stopping boundary; reason taxonomy; **manager confirms both**. Separate finance refund/transfer request; never auto-refund because enrollment ended.
- **CSBH:** percentage base, additive vs sequential extra percentages, voucher before base price or after discount, promotion combination rules, caps, eligibility, validity dates and version snapshot; quote → accountant approval → customer quote → payment.
- **Finance:** invoice/receivable/payment/debt separate from contract value; partial payments and card install plan. Refund: history + remaining lessons/value → accountant → manager → accountant payout confirmation. Fee transfer: sending/receiving student, amount or lessons, same atomic transaction affecting both sides, approval trail.
- **Student 360 after-sales:** monthly learning report (payment history, used/remaining lessons, test, homework, detailed teacher comments), Happy Call conversation, tasks, renewal likelihood and next follow-up. Monthly manager review on expiring students 3/6 months, assignment/notes stored in each Student 360.
- **BI:** Active snapshots, New/Renew, configurable funnel Lead→QL→Check-in→Test→Trial→Contract, retention, expiring fee 3/6 mo, dropout reason, referrals, class counts/occupancy/average, low-size class alert. Cohort conversion != period activity; prevent misleading >100% rates. Metrics require dictionary.

## Current Stage 02 implemented rules
- QL on valid phone, qualified_at retained; can't mark lead CONVERTED without completed Check-in.
- Person identity not merged solely on guardian phone. Duplicate matches are suggestions for human review.
- On Check-in confirmation, create/reuse correct person and child profile; preserve Lead attribution and care history; do **not** create paid/Active student.
- QR form is provisional; staff review; public QR disabled by default.
- `GET` without PII permission must mask phones; use tenant+branch scoping on all CRM requests.

## Detailed source material (historical conceptual specs)
- `reference/Master_PRD_LMS_CRM_SaaS_v1.md`
- `reference/ERD_v1.md` / `reference/ERD_diagrams.md`
- `reference/Permission_Matrix_v1.md`
- `reference/State_Machines_v1.md`
- `reference/ADR_open_decisions.md`
These reference artifacts describe intended total scope, **not proof that Stage 03–09 exists in code**.
