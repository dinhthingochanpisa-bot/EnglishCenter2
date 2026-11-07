# ERD v1.0 – Các sơ đồ quan hệ trọng tâm

Đây là **logical diagrams**, giản lược thuộc tính (danh mục bảng/cột đầy đủ nằm trong `ERD_v1.md`). Mọi liên kết giữa hai bảng `[T]` phải thêm `tenant_id` vào composite FK.

## A. SaaS / Identity / CRM

```mermaid
erDiagram
  TENANTS ||--o{ BRANCHES : owns
  TENANTS ||--o{ TENANT_MEMBERSHIPS : has
  PLATFORM_USERS ||--o{ TENANT_MEMBERSHIPS : joins
  TENANT_MEMBERSHIPS ||--o{ MEMBERSHIP_BRANCH_SCOPES : has
  BRANCHES ||--o{ MEMBERSHIP_BRANCH_SCOPES : permitted_in
  TENANT_MEMBERSHIPS ||--o{ MEMBERSHIP_ROLES : assigned
  ROLES ||--o{ MEMBERSHIP_ROLES : grants
  PERSONS ||--o| STUDENTS : student_identity
  PERSONS ||--o| GUARDIANS : guardian_identity
  STUDENTS ||--o{ STUDENT_GUARDIANS : linked
  GUARDIANS ||--o{ STUDENT_GUARDIANS : linked
  PERSONS ||--o{ LEAD_INQUIRIES : requests
  LEAD_INQUIRIES ||--o{ LEAD_STAGE_EVENTS : progresses
  LEAD_INQUIRIES ||--o{ LEAD_ATTRIBUTIONS : attributed
  PERSONS ||--o{ CHECKINS : visits
  BRANCHES ||--o{ CHECKINS : receives
```

## B. Sản phẩm / CSBH / Bán hàng / Tài chính

```mermaid
erDiagram
  PRODUCTS ||--o{ PACKAGES : contains
  PACKAGES ||--o{ PACKAGE_VERSIONS : versioned
  PATHWAYS ||--o{ PATHWAY_VERSIONS : versioned
  SALES_POLICY_CAMPAIGNS ||--o{ SALES_POLICY_VERSIONS : versioned
  SALES_POLICY_VERSIONS ||--o{ PROMOTION_RULES : applies
  STUDENTS ||--o{ QUOTES : quoted
  QUOTES ||--o{ QUOTE_VERSIONS : versioned
  SALES_POLICY_VERSIONS ||--o{ QUOTE_VERSIONS : priced_by
  QUOTE_VERSIONS ||--|{ QUOTE_LINES : contains
  PACKAGE_VERSIONS ||--o{ QUOTE_LINES : priced_package
  QUOTE_VERSIONS ||--o| CONTRACTS : accepted_as
  STUDENTS ||--o{ CONTRACTS : signs
  CONTRACTS ||--|{ CONTRACT_LINES : contains
  CONTRACT_LINES ||--o{ RECEIVABLES : billed
  PAYMENT_TRANSACTIONS ||--o{ PAYMENT_ALLOCATIONS : splits
  RECEIVABLES ||--o{ PAYMENT_ALLOCATIONS : settled_by
  FINANCIAL_JOURNALS ||--|{ FINANCIAL_JOURNAL_LINES : records
  FINANCIAL_ACCOUNTS ||--o{ FINANCIAL_JOURNAL_LINES : classified
  CONTRACTS ||--o{ REFUND_REQUESTS : refunded
  STUDENTS ||--o{ FEE_TRANSFER_REQUESTS : source_or_target
```

## C. Lớp / Điểm danh / Số buổi / Bảo lưu

```mermaid
erDiagram
  CLASSES ||--o{ CLASS_SCHEDULE_RULES : recurring
  CLASSES ||--o{ CLASS_SESSIONS : sessions
  CLASSES ||--o{ CLASS_TEACHER_ASSIGNMENTS : staffing
  STUDENTS ||--o{ ENROLLMENTS : attends
  CLASSES ||--o{ ENROLLMENTS : includes
  CONTRACT_LINES ||--o{ ENTITLEMENT_GRANTS : rights
  STUDENTS ||--o{ ENTITLEMENT_GRANTS : owns
  ENTITLEMENT_GRANTS ||--o{ ENTITLEMENT_LEDGER_ENTRIES : records
  ENTITLEMENT_GRANTS ||--o{ ENROLLMENTS : permits
  CLASS_SESSIONS ||--o{ ATTENDANCE_RECORDS : checks
  ENROLLMENTS ||--o{ ATTENDANCE_RECORDS : attended_by
  ATTENDANCE_RECORDS ||--o{ ATTENDANCE_REVISIONS : edits
  ATTENDANCE_RECORDS ||--o{ ABSENCE_ALLOWANCE_USAGES : consumes_quota
  STUDENTS ||--o{ CLASS_TRANSFER_REQUESTS : requests
  CLASS_TRANSFER_REQUESTS ||--o| CLASS_TRANSFER_EXECUTIONS : executes
  STUDENTS ||--o{ RESERVATION_REQUESTS : pauses
  RESERVATION_REQUESTS ||--o{ RESERVATION_EFFECTS : imposes
  STUDENTS ||--o{ STUDENT_EXIT_REQUESTS : exits
```

## D. LMS / CSKH / Duyệt / BI

```mermaid
erDiagram
  STUDENTS ||--o{ TEST_ATTEMPTS : tests
  TEST_VERSIONS ||--o{ TEST_ATTEMPTS : assigned
  TEST_ATTEMPTS ||--o{ TEST_EVALUATIONS : reviewed
  STUDENTS ||--o{ TRIAL_REPORTS : trialled
  CLASS_SESSIONS ||--o{ TRIAL_REPORTS : during
  CLASSES ||--o{ HOMEWORK_ASSIGNMENTS : assigns
  HOMEWORK_ASSIGNMENTS ||--o{ HOMEWORK_SUBMISSIONS : submitted
  STUDENTS ||--o{ MONTHLY_REPORTS : receives
  MONTHLY_REPORTS ||--o{ MONTHLY_REPORT_VERSIONS : publishes
  MONTHLY_REPORT_VERSIONS ||--o{ REPORT_DELIVERIES : sends
  STUDENTS ||--o{ HAPPY_CALLS : contacted
  STUDENTS ||--o{ RENEWAL_CASES : potential
  RENEWAL_CASES ||--o{ RENEWAL_CASE_EVENTS : tracked
  RENEWAL_MEETINGS ||--o{ RENEWAL_MEETING_ITEMS : reviews
  RENEWAL_CASES ||--o{ RENEWAL_MEETING_ITEMS : reviewed_in
  WORKFLOW_DEFINITIONS ||--o{ WORKFLOW_VERSIONS : versions
  WORKFLOW_VERSIONS ||--o{ WORKFLOW_INSTANCES : executes
  WORKFLOW_INSTANCES ||--o{ WORKFLOW_APPROVALS : steps
  METRIC_DEFINITIONS ||--o{ METRIC_DEFINITION_VERSIONS : definitions
```

## E. Dòng dữ liệu chính (logic event flow)

```mermaid
flowchart LR
  A[Lead / QL] --> B[Person + Student Master]
  B --> C[Check-in / Test / Trial]
  C --> D[Quote + Contract]
  D --> E[Receivable + Payment]
  D --> F[Entitlement Grant]
  F --> G[Enrollment + Class Session]
  G --> H[Confirmed Attendance]
  H --> I[Entitlement Ledger]
  I --> J[Remaining Units + Forecast]
  J --> K[Renewal Review]
  E --> L[Finance Reports]
  K --> M[Renew Contract]
  M --> F
```