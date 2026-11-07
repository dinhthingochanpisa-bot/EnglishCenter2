# 03 — UI/UX Specification v2.0: screen inventory, journeys and interaction rules

**Source of truth for future screens.** Existing Stage 01/02 UI works in Chrome, but Modal focus bug was observed; do not reproduce pattern in new screens. New UI must read/write only authorized backend APIs.

## 1. Global design skeleton
Desktop:
\`\`\`text
Topbar: Org/Branch switcher • Breadcrumb • Global Search • Notifications • Profile
Sidebar: Dashboard / CRM / Admissions / Sales / Finance / Classes / Academic /
         CSKH & Renewal / BI / Settings / Platform (platform admins only)
Content: Filter panel → KPI summary → table/calendar/detail → contextual actions
Secondary: drawer (quick action), modal (short form), full page (complex workflow)
\`\`\`
Mobile: collapsible navigation, scrollable tables with row detail cards, sticky save/status; no hover-only actions. Tenant branding variables, no hardcoded branch names. Use accessible labels, Vietnamese baseline with design tokens; foreign-language localization later.

## 2. UI state machine for any interactive form
\`INITIAL/LOADING → EDITING → VALIDATING → SAVING → SUCCESS\` or \`ERROR\`.
- Every input remains controlled/uncontrolled consistently; typing must **not remount input** or shift focus to X (Stage 02 bug). Focus modal first editable field ONCE on open; trap focus and return to launcher on close. Required field and validation message linked via \`aria-describedby\`.
- Submit disabled only while actual save is in flight or all required fields invalid; server failures show exact action error with requestId; entered data remains intact.
- Dirty modal close warns before losing changes; server 409 offers reload/diff, not silent overwrite.
- Double-click save generates one business action with Idempotency-Key. Success toast only after API 200/201/202 with correct "scheduled" distinction.
- Read permission/feature flags determine visible CTA, **backend** enforces 403 anyway.
- Monetary values format VND with currency and unit; date/time show branch timezone and effective vs created.
- Lists: server-pagination, search debounce, sorting, loading/empty/error states, bulk select only authorized. All exports redacted and audit.

## 3. Screen inventory by Stage
| Stage | Screen ID | Page / route proposal | Primary action |
|---|---|---|---|
| 03 | UI-03-01 | /catalog/products | Product grid, create/version/publish |
| 03 | UI-03-02 | /catalog/pathways | Pathway step builder |
| 03 | UI-03-03 | /catalog/packages | Package sessions/skills, branch scope |
| 03 | UI-03-04 | /pricing/pricebooks | Pricebook per branch, effective timeline |
| 03 | UI-03-05 | /pricing/policies | CSBH rule editor and version simulation |
| 03 | UI-03-06 | /students/:id/quotes | Create/approve/send quote with trace |
| 03 | UI-03-07 | /approvals | Finance/management inbox |
| 04 | UI-04-01 | /sales/contracts | New/Renew contracts and terms |
| 04 | UI-04-02 | /finance/receivables | Debt due/partial pay/aging |
| 04 | UI-04-03 | /students/:id/fees | Contract/payment history + add receipt |
| 04 | UI-04-04 | /finance/collections | Accountant verify/allocate receipt |
| 05 | UI-05-01 | /classes | Class list, low-size alert |
| 05 | UI-05-02 | /classes/:id | Roster, teachers, schedule, history |
| 05 | UI-05-03 | /classes/:id/calendar | Recurrence and session conflicts |
| 05 | UI-05-04 | /sessions/:id/attendance | Roster attendance matrix/finalize |
| 05 | UI-05-05 | /students/:id/lessons | Grant/consume/waive/remaining ledger |
| 06 | UI-06-01 | /students/:id/operations | In-place transfer/reserve/exit timeline |
| 06 | UI-06-02 | /operations/:id | Request preview, decisions, execution |
| 06 | UI-06-03 | /approvals/student-ops | Role-specific worklist |
| 07 | UI-07-01 | /academic/assessment-forms | Test author/review/publish |
| 07 | UI-07-02 | /test/:invite | Candidate test room scoped token |
| 07 | UI-07-03 | /academic/grading | Auto vs human grade moderation |
| 07 | UI-07-04 | /classes/:id/trial | Trial rights and teacher report |
| 07 | UI-07-05 | /classes/:id/assignments | Assign/submit/grade homework |
| 07 | UI-07-06 | /students/:id/reports | Monthly report draft/review/print/deliver |
| 07 | UI-07-07 | /students/:id/happy-calls | Happy Call form + case timeline |
| 07 | UI-07-08 | /renewal/forecast | 3/6-month review and meeting |
| 08 | UI-08-01 | /students/:id/refunds | Refund preview/approve/payout |
| 08 | UI-08-02 | /students/:id/fee-transfers | Source/recipient, amount/lesson transfer |
| 08 | UI-08-03 | /reports | Executives, funnel/active/contracts/retention |
| 08 | UI-08-04 | /reports/operations | Class occupancy, fees expiry and alerts |
| 08 | UI-08-05 | /reports/metrics | Definition/version/cutoff/reconciliation |
| 09 | UI-09-01 | /settings/integrations | Meta, Zalo OA, Google Ads connect/mapping |
| 09 | UI-09-02 | /settings/integrations/:id | Event/errors/retry/revoke monitor |
| 09 | UI-09-03 | /portal | Parent student tiles/report/payments |
| 09 | UI-09-04 | /platform/subscriptions | Plan/usage/billing and quotas |
| 09 | UI-09-05 | /platform/tenants/:id | SaaS tenant lifecycle/support grants |

Routes are **proposed**, not existing route paths. Align with Next.js current tenant routing \`/t/:tenantId/\` and profile before implementing.

## 4. Critical user journeys
### Journey J-01: Customer from Lead to contract
CRM Lead row → Chăm sóc → Check-in → Student 360 → Test/Trial outcome → "Tạo báo giá" → select product/package/CSBH → price trace → request accounting approval → publish quote → signed contract and receivable → payment timeline. At no stage should UI create a second Person just for Sales.

### J-02: Teacher attendance and lesson balance
Teacher Today list → choose assigned Session → attendance per student → enter late minutes or excused reason → Save draft → Submit → finalize by permitted role → Student 360 lesson balance updates from ledger. If no valid grant, display exact blocking reason and contact CSKH.

### J-03: Class transfer in roster
Class → roster → student ⋮ Chuyển lớp → select destination/start → preview last session / conflicting schedule / remaining lessons → submit → GVCN/manager workflow if configured → scheduled indicator on old roster → only after due date new roster membership appears. Inline history link shows actor/time/old/new.

### J-04: Reserve and resume
Roster → Tạm dừng → short/long configurable → select range → show affected sessions/balance/value snapshot → GVCN → accountant → manager approval worklist → effective active period → notifications/resumption task → resume or reassignment to suitable class.

### J-05: Parent monthly report
Teacher draft with payments masked per role, attendance and test auto-populated → Academic review → CSKH publish → parent delivery → Happy Call feedback → renewal risk/worklist. Published version immutable; change creates v2.

### J-06: Financial adjustment
Student 360 → fee history → Refund / Transfer modal wizard → quote → approval timeline → actual payout or atomic transfer post → receipt/ledger rows. UI never says "paid" on approval.

## 5. Field-level form contract samples
**New Lead (existing):** studentName (trim 2..120), guardianContactName, guardianPhone optional until QL, branchId required, sourceId required if tenant policy; warning on shared guardian phone, not forced merge.

**Quote:** personId from context (read-only), branchId assigned, customerType New/Renew required, packageVersionId, policyVersionIds, asOf date, calculationTrace, reason for exception, approval status; all amounts server calculated.

**Attendance:** session and class readonly, row enrollmentId, status \`PRESENT/LATE/ABSENT\`; when LATE require minutes positive; when ABSENT require permission code and reason per config; show pending vs finalized; no manual remainingLessons entry.

**Reserve:** student/enrollment fixed, from/to, scope, type suggested but change allowed with policy guard, estimated affected sessions, policy reference and comments. Show "not yet active" during approval.

**Fee Transfer:** source/receiver student selected with verified identity, source contract/grant, transfer type money/lessons, proposed quantity, server-computed conversion, after-balances, reason and approvals.

## 6. Accessibility, performance and acceptance
- Keyboard: Tab/Shift+Tab, Enter submits only when valid, Esc closes with dirty-state confirmation, focus restore, visible focus indicator. Datepicker/combobox ARIA roles and screen reader labels.
- Loading targets approved per screen; prevent double save; optimistic UI only for reversible display, not posted money/lesson/approved state.
- PII redacted in unauthorized lists, downloadable exports only by explicit audited entitlement.
- Browser acceptance record stores screenshot of each critical state (no personal data), permission negative case and time/correlation ID; browser PASS is distinct from API smoke.
