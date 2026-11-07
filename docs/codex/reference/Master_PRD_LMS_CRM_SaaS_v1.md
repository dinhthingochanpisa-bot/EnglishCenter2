# MASTER PRD v1.0 — LMS + CRM SaaS cho trung tâm ngoại ngữ

**Ngày:** 06/11/2026  
**Mô hình:** B — SaaS thương mại cho nhiều tổ chức độc lập  
**Trạng thái:** Baseline kiến trúc / nghiệp vụ; chưa phải đặc tả triển khai đã được nghiệm thu  
**Định hướng:** Education Operations Platform gồm CRM, Admissions, Sales, Finance, LMS, Customer Success, BI.

## 1. Product Vision
Một nền tảng SaaS đa tổ chức, quản lý xuyên suốt vòng đời từ nguồn marketing, Lead/QL, check-in, test, trial, báo giá, hợp đồng, thu phí, học tập, điểm danh, CSKH, tái ký, nghỉ ngang, tốt nghiệp; các bộ phận phối hợp trên một hồ sơ dữ liệu thống nhất nhưng có phân quyền.

### Đối tượng
- Platform Owner: quản trị nền tảng, gói thuê bao, tenant, billing, giám sát vận hành.
- Tenant Owner: chủ tổ chức/trung tâm, thiết lập hệ thống và các cơ sở.
- HQ Manager, Branch Manager, Marketing, TVV/Sales, CSKH/QLHV, GV/GVCN, Academic Manager, Accounting, phụ huynh/học sinh (portal về sau).

### Nguyên tắc bất biến
1. Dữ liệu của tenant độc lập, không truy cập chéo.
2. Một học sinh có định danh thống nhất trong tenant; trạng thái Lead/QL/Student là thuộc tính/hành trình, không phải bản sao hồ sơ.
3. Phân quyền theo tenant + branch + role + owner/assignment; mặc định từ chối.
4. Chính sách vận hành/giá/duyệt cấu hình được và có phiên bản, không hard-code.
5. Contextual actions: thao tác tại Lead, Student 360, danh sách lớp, lịch dạy, hợp đồng...; backend dùng chung nghiệp vụ.
6. Không sửa mất lịch sử hợp đồng, thanh toán, quyền học, lớp, điểm danh đã chốt; dùng điều chỉnh/đảo bút toán khi cần.
7. Mọi KPI có Metric Dictionary, phương pháp đếm và cutoff rõ ràng.
8. Mỗi thay đổi nhạy cảm có audit log ai/lúc nào/trước/sau/lý do.

## 2. Phạm vi module
| ID | Module | Chức năng |
|---|---|---|
| M01 | SaaS Admin | Tenant onboarding, plans, subscription, quotas, suspend/reactivate, support access có kiểm soát |
| M02 | Identity & RBAC | User, memberships, vai trò, branch scope, MFA, sessions, audit |
| M03 | Marketing CRM | Lead ingestion, channels, campaigns, UTM, QL, dedup, assignment, follow-up |
| M04 | Admissions | QR intake/check-in, placement tests, evaluation, trial entitlement/report |
| M05 | Product/Curriculum | Sản phẩm, chương trình, pathways, course packages, versioning theo tenant/branch |
| M06 | Pricing/Promotion | Chính sách theo kỳ, CK%, voucher, promotion combination, ceilings, quote snapshot |
| M07 | Sales/Contract | Quote, approvals, hợp đồng New/Renew, deposits, signed documents |
| M08 | Finance | Receivables, payments, allocation, debt, refunds, transfers, invoicing integration |
| M09 | Class/Schedule | Class create/end/archive, teacher roles, recurrence, occurrences, rooms, conflicts |
| M10 | Attendance/Entitlement | Per-session attendance, free absence policy, usage ledger, remaining lessons |
| M11 | Academic LMS | Assignments, homework, graded assessments, learning materials, periodic reports |
| M12 | Student Operations | Transfer class, reserve short/long, stop dropout/graduation, history |
| M13 | Customer Success | Happy call, parent feedback, 3/6-month renewal review, tasks |
| M14 | Workflow/Automation | Configurable approvals, reminders, SLA, notification, event outbox |
| M15 | BI | Active, New/Renew, funnel, retention, referral, class capacity, finance, productivity |
| M16 | Integrations/Portal | Meta/Zalo/Google Ads adapters, parent/student portal, public APIs |

## 3. Quy trình nghiệp vụ và tiêu chí nghiệm thu

### 3.1 Lead -> QL -> Check-in
- Lead nguồn Page, Zalo OA, Google Ads, sự kiện, trường học, KHGT, CTV, walk-in; lưu first-touch, latest-touch, conversion attribution và raw source reference riêng.
- QL: lead có số điện thoại hợp lệ theo quy tắc tenant; không tự động nhập nhằng với check-in.
- Check-in: kiểm tra trùng theo số liên hệ/họ tên/ngày sinh và mối quan hệ phụ huynh-con; QR self-entry; lưu thời gian, branch, agent, consent và trạng thái đầy đủ thông tin.
- Walk-in được tạo hồ sơ tại điểm bán nhưng vẫn tham gia cùng lifecycle.
- Acceptance: cùng một người phát sinh lead rồi check-in không sinh hai student identities; nguồn ban đầu còn nguyên.

### 3.2 Test & Trial
- Ngân hàng đề 3–5 đề ban đầu, mở rộng sau, cấu hình kỹ năng, thời gian, scoring; auto-grade trắc nghiệm; human-grade Speaking/Writing; review chuyên môn; PDF kết quả và lịch sử phiên bản.
- Trial chỉ được xếp lớp khi có quyền học thử hợp lệ; học chính thức cần entitlement hợp lệ; check không chỉ dựa trên một status text.
- Trial report giáo viên nhận xét, lưu/in/PDF, duyệt nếu tenant yêu cầu.
- Acceptance: không có trial/paid entitlement thì enrollment bị từ chối; mỗi kết quả có người chấm/ngày chấm và link hồ sơ.

### 3.3 Product, CSBH, Quote & Contract
- Tenant/branch quản lý sản phẩm, lộ trình, packages, kỳ hiệu lực. Lộ trình sửa phải tạo phiên bản, không đổi hợp đồng cũ.
- Promotion: CK base; additional percent additive or sequential; voucher trước/sau percent; stacking restrictions; max total discount; eligibility by New/Renew, product/package, center, dates, group/referral/sibling, deposit conditions.
- Pricing engine lưu từng bước tính, rounding, final quote version, policy version; xác định mốc áp dụng policy (quote/deposit/contract/payment).
- Quote -> accounting approval -> send customer -> accept/sign -> charge/deposit; approval flow có thể cấu hình.
- Acceptance: cùng input + cùng policy version cho cùng kết quả; không chỉnh một quote đã chốt mà không tạo version.

### 3.4 Thu phí, công nợ
- Methods: cash, bank transfer, POS, POS installments, partial payments, debt due date; payment confirmation/conciliation không đồng nhất với user nhập số tiền.
- Student contract balance khác cash collected, khác recognized revenue, khác learning entitlement.
- Acceptance: thanh toán nhiều đợt phản ánh công nợ chính xác; không ghi nhận lại khi webhook retry.

### 3.5 Class, Schedule, Attendance
- Class: create, update, pause/end/archive; giữ lịch sử. Schedules gồm quy tắc lặp và session cụ thể, hủy/đổi giờ/đổi GV/học bù, kiểm tra xung đột.
- Class teachers: homeroom and multiple skill-specific teachers with effective dates.
- Attendance each session: present, late(+minutes), absent excused/unexcused, reason; teacher must confirm.
- Policy free absence by tenant/branch/package, with explicit eligibility, limit, period, handling late/makeup; versioned and attached to entitlement.
- Remaining lessons derived from entitlement grants +/- consumption/adjustments, not mutable counter that decrements on every save.
- Acceptance: repeat attendance save does not charge twice; edit produces traceable reversal/recalculation; free absences 4/96 example works according to configured policy.

### 3.6 Student Operations contextual actions
- Class transfer: select destination and effective start; check collision and eligibility; existing enrollment ends at last valid session before transfer, new enrollment starts at effective time after old final session; audit old/new class and count only once; future automated scheduled transition.
- Tạm dừng = bảo lưu: choose short/long via configurable threshold, start/end dates, lessons remaining and value; approvals GVCN -> accounting -> manager (tenant may configure); suspend attendance/entitlement according to policy; resume workflow.
- Dừng học: dropout or graduation; last attended class session determines stop effective date; manager confirms both types; reason taxonomy and history; no automatic refund.
- Acceptance: class history is historically reproducible on any date; requests do not mutate finalized records until approved/effective.

### 3.7 Refund / fee transfer
- Refund: choose student + contract, show all fees/payment/history/used/remaining, calculate refundable value under policy, accounting -> manager approval, accounting confirms paid; never mark completed from approval alone.
- Transfer: source and recipient students + packages, amount or lessons, conversion rule for cross-product or cross-branch, approvals accounting -> manager, atomic debit/credit with ledger; no duplicate processing.
- Acceptance: sum of ledger adjustments balances, cannot overdraw, retries idempotent; no one-sided transfer.

### 3.8 Customer Success
- Monthly report contains all payment history (configurable display scope), sessions attended/consumed/remaining, test results, homework, detailed teacher comments; generate draft -> academic edit -> CSKH release; immutable released version; PDF/print/parent delivery.
- Happy call at Student 360: contact, time, parent feedback, satisfaction, cases, owner, next action, linkage to report.
- Renewal Review: 3-month and 6-month forecast lists; expected expiry from remaining entitlement and scheduled sessions, owner, likelihood, status, reason, next action, recurring meeting snapshots.
- Acceptance: meeting updates write back to same student record, complete change history.

### 3.9 BI / Reporting
- Active by start/end date, paying/free/trial/reserved, net, new/renew; exact policy per tenant documented.
- Contract New/Renew, price, paid, outstanding, product/branch/sales rep.
- Configurable conversion funnel Lead -> QL -> checkin -> test -> trial -> contract with optional stages; cohort and period activity modes separately.
- Retention, renewals, expiring fees, dropout reasons, referral conversion and CAC, class count, low-sizes threshold, average class size and fill rate, workforce productivity.
- All metrics defined by event time/effective time, branch scope, unique-person vs enrollment count, source attribution.
- Acceptance: executive/branch/detail show equal numbers with equal filters; historical snapshots reproducible.

## 4. Multi-tenant & Permission Design
- Tenant has many branches. Branch user membership can cover 1..N branches; role actions allowed by permission matrix and scope.
- Shared DB with `tenant_id` on all tenant-owned tables; composite unique indexes and composite FKs include tenant boundaries where appropriate. PostgreSQL RLS defense-in-depth, request context managed safely; automated tenant-isolation tests.
- Platform support impersonation only via approved time-bound support grant, explicit banner and audit.
- Encryption in transit/at rest; secrets vaulted; selective access to children's data; data retention, export, deletion policy subject to legal obligations.
- SaaS controls: subscription plans, per-tenant quotas, usage metering, rate limiting, feature flags, backup/restore and tenant lifecycle.

## 5. Conceptual database: critical aggregates
**Identity**: tenants, branches, users, memberships, roles, permissions, audit_logs.  
**People/CRM**: persons, students, guardians, student_guardians, contact_points, leads, lead_events, campaigns, source_attributions, checkins, interactions, assignments.  
**Academic catalog**: products, programs, pathways, pathway_versions, packages, package_versions, course_levels.  
**Sales**: promotion_policies, policy_versions, promotion_rules, quotes, quote_lines, approvals, contracts, contract_lines.  
**Finance**: invoices, receivables, payment_transactions, payment_allocations, refunds, fee_transfers, financial_ledger_entries.  
**Delivery**: classes, class_teacher_assignments, class_schedule_rules, class_sessions, enrollments, enrollment_events, attendance_records, entitlement_grants, entitlement_ledger, absence_allowances, reservations, class_transfers, student_exits.  
**LMS/CSKH**: tests, attempts, grades, trial_reports, assignments, submissions, monthly_reports, report_versions, happy_calls, renewal_cases, renewal_meetings, tasks.  
**Platform**: workflow_definitions, workflow_instances, workflow_steps, event_outbox, notifications, document_templates, files, integration_connections, webhook_events, metric_definitions, snapshots.

### Data ownership
- Never duplicate a student master for each stage; distinguish `person`/`student` from `lead` and `enrollment`.
- Guardian relationship N:N; siblings must not merge by phone alone.
- Multiple simultaneous contracts and enrollments are supported where authorized.
- Every dated relationship includes `valid_from`, `valid_to` and user/audit actor.
- Entitlement ledger and financial ledger are separate; a lesson's monetary value is not necessarily list_price / total_lessons.

## 6. Technical architecture (recommended baseline)
- Frontend: Next.js App Router + React + TypeScript; UI library with accessible design tokens.
- Backend: NestJS + TypeScript modular monolith, versioned REST APIs, OpenAPI contract.
- Database: PostgreSQL, migration-managed via chosen ORM/query layer; evaluate Prisma/Drizzle based on RLS, transactions and schema constraints.
- Cache/queue: Redis + background job queue for notifications, webhook processing, reports and scheduled transitions.
- Files: S3-compatible object store, signed URLs, document versioning; PDF renderer.
- Auth: OIDC-capable auth, secure sessions/MFA for privileged roles, RBAC+scope checks.
- Reporting: PostgreSQL read models/materialized views initially; warehouse/BI later if needed.
- Infrastructure: containerized deployment, CI/CD, separate dev/staging/prod, backups, logs/metrics/traces, secrets management.

### Integration boundaries
- Meta/Zalo/OA/Ads through adapter pattern, OAuth/permissions, webhook validation, idempotency, retry and dead-letter queue; provider restrictions must be verified before committing roadmap.
- Import CSV/Excel/Google Sheets with staging, mapping, dedup review, error report and reversible import batches.
- Billing/invoicing/payments through provider adapters and configurable accounting rules; not assumed available for every tenant.

### API examples
- `POST /v1/leads` and `POST /v1/checkins`
- `POST /v1/students/{id}/trial-entitlements`
- `POST /v1/classes/{id}/sessions/{sessionId}/attendance`
- `POST /v1/students/{id}/class-transfers`
- `POST /v1/students/{id}/reservations`
- `POST /v1/quotes` and `POST /v1/quotes/{id}/submit-approval`
- `POST /v1/refunds`, `POST /v1/fee-transfers`
- `GET /v1/reports/active` and `GET /v1/reports/funnel`
All tenant-scoped request context is authoritative from authenticated membership, not trusted from arbitrary client input.

## 7. Definition of Done / Critical Test Cases
- Unit tests: pricing variants (additive vs sequential, voucher before/after, caps, rounding); policy version freezing; absence allowance; financial formulas.
- Integration tests: cross-tenant denials for read/write; double-submit idempotency; approval gating; refund/transfer ledger atomicity; attendance edits.
- E2E tests: Lead -> QL -> checkin -> paid enrollment -> attendance -> report -> renew; transfer effective date; reserve -> resume; dropout/graduation approvals.
- Security tests: unauthorized branch access, IDOR, injection, webhook signature, consent retention, audit visibility.
- Operational tests: backup restore, migration rollback/recovery, rate limiting, queue retry, no silent loss of webhook events.
- Every feature: spec and acceptance criteria updated, typecheck/lint/test/build pass, diff reviewed, no unrelated changes, docs and release note, Git commit.

## 8. Roadmap Vibe Coding (dependency-ordered)
| Stage | Focus | Exit gate |
|---|---|---|
| 0 | Product decisions + journey maps + data dictionary + UX wireframes | Domain vocab and key rules approved |
| 1 | Repository/CI, tenant isolation, auth/RBAC, audit, layouts | Cross-tenant tests and branch scope pass |
| 2 | Person/guardian/student master, Lead/QL, checkin, dedup, CSV import | Same person stays one identity; import review works |
| 3 | Product/package/version, pricing engine, CSBH, quote, approvals | Pricing golden test suite passes |
| 4 | Contract, receivable, payment recording, basic ledger | Payment/debt reconciliation passes |
| 5 | Class/session schedule, teachers, enrollment, attendance, entitlement ledger | No double deduction; historically accurate class membership |
| 6 | Transfer/reservation/dropout/graduation and configurable approval | Effective-date workflows and audit pass |
| 7 | Test/trial, academic reports, homework, happy calls, renewal | Teacher/CSKH complete workflows without duplicate entry |
| 8 | Refund/fee transfer, BI dashboards and alerts | Transaction atomicity and KPI reconciliations pass |
| 9 | Meta/Zalo integrations, parent portal, SaaS billing, scale hardening | Provider compliance + pilot tenant acceptance |

### Pilot / commercial readiness gates
- Pilot at >=2 structurally different tenant configurations to prove policies and isolation.
- UAT by TVV, CSKH, GV, accountant, branch manager and tenant owner; sign-off by workflow.
- Data migration dry run and reconciliation report.
- Disaster recovery exercise; privacy/data processing terms; tenant onboarding/offboarding; support SLAs.
- Separate product KPIs: onboarding time, completion rate of key workflows, errors per 1,000 actions, tenant churn, support tickets, tenant-level adoption.

## 9. Vibe Coding skills to create
- `product-requirements`: transform natural-language requirements to stories/AC/edge cases.
- `domain-model-review`: identify aggregates, tenant boundaries, effective dates, invariant tests.
- `build-feature`: inspect code -> plan -> implement smallest slice -> verify -> document.
- `pricing-policy`: generate rules + traceable calculation examples + golden tests.
- `entitlement-attendance`: enforce lesson ledger and absence policy, prevent duplicate charge.
- `finance-transaction`: double-sided accounting adjustments, idempotency and approvals.
- `tenant-security-review`: check RLS, RBAC, scoping, branch permissions and test negatives.
- `ui-contextual-actions`: design actions inline with student/class/quote screens.
- `report-metric-validation`: source KPI definitions, reconcile counts and cohorts.
- `browser-e2e`: exercise actual user journeys and capture evidence.
- `safe-db-migration`: migration, backfill, rollback/recovery checks.
- `bug-investigation`: reproduce -> isolate -> fix -> regression test.

### Required docs
`AGENTS.md`, `docs/PRD.md`, `docs/DOMAIN_GLOSSARY.md`, `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/SECURITY.md`, `docs/METRIC_DICTIONARY.md`, `docs/WORKFLOWS.md`, `docs/API_CONTRACTS.md`, `docs/DECISIONS/`, `docs/TEST_STRATEGY.md`.

## 10. Open decisions (not finalized)
1. Free absence / make-up / reservation policy defaults per tenant and how changing policy applies to existing packages.
2. Exactly how short/long reservation threshold and equality boundary operate; whether guardian approval is needed.
3. Exact Active status taxonomy and eligibility for paying/free/trial/reserved across distinct organizations.
4. Renew definition: follow-on pathway vs any additional paid contract; separate reporting.
5. Cross-branch transfer financial settlement, cross-product lesson conversion.
6. Refund calculation policy, non-refundable components, tax/e-invoice reconciliation.
7. Contract signature method and legal evidence requirements.
8. Provider-specific Meta/Zalo capabilities and messaging consent.
9. Commercial subscription/pricing plan, per-tenant quotas, hosting region and data retention contracts.
10. Parent portal release scope, teacher payroll/HR integration (if in product scope).

**Next deliverable:** ERD v1 + permission matrix + event/state-transition specs + 20 high-risk acceptance scenarios before large-scale implementation.