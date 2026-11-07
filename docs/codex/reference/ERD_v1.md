# DATABASE ERD v1.0 — Multi-tenant LMS + CRM SaaS

**Baseline:** Master PRD v1.0, 06/11/2026. **Trạng thái:** Logical ERD & schema contract; chưa phải DDL production.  
**Nền tảng:** PostgreSQL; multi-tenant shared database; modular monolith; dữ liệu được phân quyền theo tenant, branch, vai trò và assignment.

## 0. Quy ước bắt buộc

- **`[T]` bảng thuộc tenant**, mặc định có `id uuid PK`, `tenant_id uuid NOT NULL FK tenants(id)`, `created_at timestamptz NOT NULL`, `updated_at timestamptz NOT NULL`, `created_by uuid NULL`, `updated_by uuid NULL`, `row_version int NOT NULL DEFAULT 1`. Với mọi `[T]`, tạo `UNIQUE (tenant_id,id)` để hỗ trợ composite FK. `created_by`/`updated_by` tham chiếu actor/user trong phạm vi quyền thích hợp, không được lấy từ body client.
- **`[P]` bảng cấp platform**, không có tenant_id; chỉ truy cập qua service/role nền tảng. **`[B]` bảng bridging** vẫn thuộc tenant nếu kết nối đối tượng tenant.
- FK trong mô tả `a -> b` là quan hệ tham chiếu; triển khai `FOREIGN KEY (tenant_id, a_id) REFERENCES b(tenant_id,id)` cho hai bảng `[T]`, không chỉ FK trên UUID. Cấm cho cập nhật `tenant_id` của một record sau khi tạo.
- Tiền: `numeric(18,2)` + `currency char(3)`; số buổi có thể chia: `numeric(10,2)` (mặc định 1.00); điểm số dùng `numeric(8,3)`; phần trăm dùng `numeric(7,4)` lưu **percentage points** (vd 10.0000 = 10%). Không dùng float cho tiền.
- Mốc thời gian: `timestamptz` lưu UTC; `date` khi là ngày học/ngày hiệu lực theo timezone tenant/branch; khoảng hiệu lực theo `[valid_from, valid_to)`; kết thúc NULL = vô thời hạn.
- Trạng thái: dùng lookup/catalog hoặc PostgreSQL check+app state machine; không xóa lịch sử. `metadata jsonb` chỉ cho metadata mở rộng, không thay cho quan hệ hay trường dùng filter/KPI.
- Các trường PII nhạy cảm (điện thoại, email, địa chỉ, thông tin trẻ em): mã hóa hoặc kiểm soát truy cập, masking, consent và retention; với tìm kiếm phone dùng `phone_normalized`/deterministic token bảo vệ thích hợp, không đặt hash không salt dùng làm xác thực.
- Mỗi bảng `[T]` bên dưới liệt kê **cột nghiệp vụ ngoài những cột nền mặc định**. Dấu `?` = nullable, `!` = NOT NULL; `FK` nêu đối tượng đích; `UQ` unique trong tenant; có thể thêm index theo mục 11.

## 1. Domain 01 — SaaS Platform / Identity / Access

| Bảng | Cột nghiệp vụ (ngoài mặc định) | Quan hệ & constraints trọng yếu |
|---|---|---|
| `tenants` [P] | `id uuid PK`, `code text UQ`, `legal_name text!`, `display_name text!`, `status text!`, `timezone text!`, `base_currency char(3)!`, `created_at`, `updated_at` | Root tổ chức; trạng thái onboard/active/suspended/closed |
| `tenant_settings` [T] | `key text!`, `value jsonb!`, `version int!`, `effective_from timestamptz!` | UQ(tenant_id,key,version), config phải kiểm version |
| `branches` [T] | `code text!`, `name text!`, `timezone text?`, `address_id uuid?`, `is_active boolean!` | UQ(tenant_id,code); address FK `addresses` |
| `platform_users` [P] | `id uuid PK`, `auth_subject text UQ`, `email text?`, `display_name text!`, `status text!`, `mfa_enforced boolean`, `created_at`, `updated_at` | User đăng nhập có thể thuộc nhiều tenant |
| `tenant_memberships` [T] | `user_id uuid!`, `employee_code text?`, `status text!`, `joined_at`, `left_at?` | FK user -> platform_users; UQ(tenant_id,user_id) |
| `roles` [T] | `code text!`, `name text!`, `system_role boolean!`, `scope_type text!` | UQ(tenant_id,code) |
| `permissions` [P] | `id uuid PK`, `resource text!`, `action text!`, `code text UQ` | Platform catalog, vd `attendance.confirm` |
| `role_permissions` [T,B] | `role_id uuid!`, `permission_id uuid!` | UQ(tenant_id,role_id,permission_id); FK permission -> platform |
| `membership_roles` [T,B] | `membership_id uuid!`, `role_id uuid!`, `valid_from timestamptz!`, `valid_to timestamptz?` | Ngày hiệu lực + FK composite |
| `membership_branch_scopes` [T,B] | `membership_id uuid!`, `branch_id uuid!`, `valid_from`, `valid_to?` | User chỉ xem branch được cấp |
| `support_grants` [T] | `platform_operator_user_id uuid!`, `approved_by_user_id uuid!`, `reason text!`, `valid_from`, `valid_to`, `revoked_at?`, `ticket_ref?` | Time-bound, không dùng implicit superadmin |
| `subscription_plans` [P] | `id`, `plan_code text UQ`, `name`, `features jsonb`, `limits jsonb`, `status` | Platform pricing plan |
| `tenant_subscriptions` [T] | `plan_id uuid!`, `status`, `started_at`, `ended_at?`, `billing_cycle`, `provider_ref?` | FK plan -> subscription_plans |
| `tenant_usage_periods` [T] | `period_start date!`, `period_end date!`, `metric_code text!`, `used numeric!` | UQ(tenant_id,metric_code,period_start) |
| `audit_logs` [T] | `actor_user_id uuid?`, `action text!`, `resource_type text!`, `resource_id uuid!`, `occurred_at timestamptz!`, `before_data jsonb?`, `after_data jsonb?`, `reason text?`, `request_id uuid?`, `ip_hash text?` | Append-only, riêng partition theo thời gian; redaction PII |

**Ranh giới:** user thuộc global platform; membership/roles/scopes thuộc tenant. `tenant_id` từ authenticated tenant membership; tuyệt đối không tin `tenant_id` ở JSON request.

## 2. Domain 02 — People / CRM / Marketing / Check-in

| Bảng | Cột nghiệp vụ | Quan hệ & constraints |
|---|---|---|
| `addresses` [T] | `line1 text?`, `ward text?`, `province text?`, `country_code char(2)!`, `postal_code text?` | Địa chỉ có tenant scope |
| `persons` [T] | `full_name text!`, `preferred_name text?`, `dob date?`, `gender_code text?`, `address_id uuid?`, `merged_into_person_id uuid?`, `status text!` | Master person; self FK merge, phải qua transaction/audit |
| `contact_points` [T] | `person_id uuid!`, `kind text!`, `value_encrypted bytea?`, `normalized_token text?`, `is_primary boolean`, `verified_at?` | Nhiều số/email; index token, không global unique điện thoại |
| `students` [T] | `person_id uuid!`, `student_code text!`, `school_name text?`, `school_grade text?`, `lifecycle_status text!`, `first_enrolled_at?` | UQ(tenant_id,person_id), UQ(tenant_id,student_code); person -> persons |
| `guardians` [T] | `person_id uuid!`, `occupation text?`, `notes text?` | UQ(tenant_id,person_id); guardian cũng là person |
| `student_guardians` [T,B] | `student_id uuid!`, `guardian_id uuid!`, `relationship_code text!`, `is_primary boolean`, `is_financial_contact boolean`, `valid_from`, `valid_to?` | N:N; hai học sinh chung phụ huynh KHÔNG được gộp |
| `marketing_channels` [T] | `code text!`, `name text!`, `kind text!`, `is_active boolean` | UQ(tenant_id,code); Page/Zalo/Ads/Event/School/KHGT/CTV/Walk-in |
| `campaigns` [T] | `channel_id uuid?`, `code text!`, `name text!`, `start_at?`, `end_at?`, `budget_amount?`, `branch_id?` | UQ(tenant_id,code); lead attribution |
| `lead_inquiries` [T] | `person_id uuid?`, `branch_id uuid?`, `channel_id uuid!`, `campaign_id uuid?`, `external_ref text?`, `received_at timestamptz!`, `status text!`, `qualified_at?`, `owner_membership_id?` | Một person có nhiều inquiries; external-ref uniqueness scoped by provider/channel khi không null |
| `lead_attributions` [T] | `lead_id uuid!`, `touch_kind text!`, `channel_id uuid!`, `campaign_id uuid?`, `utm jsonb?`, `occurred_at timestamptz!`, `source_ref text?` | First/latest/conversion attribution bằng event thực; không overwrite first touch |
| `lead_stage_events` [T] | `lead_id uuid!`, `stage_code text!`, `entered_at timestamptz!`, `left_at?`, `actor_membership_id?`, `reason?` | Stage history cho cohort funnel; một active stage theo quy tắc CRM |
| `crm_activities` [T] | `person_id uuid?`, `lead_id uuid?`, `activity_type text!`, `occurred_at timestamptz!`, `summary text?`, `owner_membership_id?`, `next_action_at?` | Call, Zalo, page, tư vấn, lịch hẹn |
| `crm_assignments` [T] | `lead_id uuid!`, `membership_id uuid!`, `valid_from`, `valid_to?`, `assignment_reason text?` | Lưu lịch sử người được giao, không ghi đè owner |
| `checkins` [T] | `person_id uuid!`, `lead_id uuid?`, `branch_id uuid!`, `arrived_at timestamptz!`, `handled_by_membership_id?`, `intake_status text!`, `checkin_origin text!`, `form_submission_id uuid?` | Walk-in được tạo person trước; check-in nhiều lần |
| `intake_forms` [T] | `name text!`, `schema_version int!`, `field_schema jsonb!`, `status text!`, `branch_id?` | Form cấu hình versioned |
| `intake_submissions` [T] | `form_id uuid!`, `person_id uuid?`, `submitted_at`, `payload_encrypted jsonb?`, `consent_id uuid?`, `source_token_hash text?` | QR token expiring; dữ liệu kiểm duyệt trước khi merge |
| `consent_records` [T] | `person_id uuid!`, `guardian_person_id uuid?`, `purpose_code text!`, `basis text!`, `notice_version text!`, `granted_at?`, `withdrawn_at?`, `evidence_file_id uuid?` | Lưu đồng ý theo mục đích (marketing, học tập, tin nhắn) |
| `referral_relationships` [T] | `referred_person_id uuid!`, `referrer_person_id uuid?`, `referrer_code text?`, `lead_id uuid?`, `reward_status text!` | Không tự tạo một người nếu chỉ có referral code |

**Cần phân biệt:** person (định danh) ≠ lead_inquiry (một lần phát sinh nhu cầu) ≠ student (vai trò học sinh) ≠ enrollment (một lần tham gia lớp). QL là event/trạng thái một inquiry thỏa điều kiện phone; không tự động tạo bảng QL master khác.

## 3. Domain 03 — Assessment / Trial

| Bảng | Cột nghiệp vụ | Quan hệ & constraints |
|---|---|---|
| `test_banks` [T] | `branch_id?`, `name text!`, `test_type text!`, `status` | Đầu vào/giữa kỳ/cuối kỳ/thi thử |
| `test_versions` [T] | `test_bank_id uuid!`, `version_no int!`, `duration_minutes int!`, `max_score numeric`, `rubric jsonb`, `published_at?` | UQ(tenant_id,test_bank_id,version_no), immutable sau publish |
| `test_questions` [T] | `test_version_id uuid!`, `skill_code text!`, `question_type text!`, `body jsonb!`, `answer_key_encrypted jsonb?`, `max_points numeric!`, `sort_order int!` | Answer key cần role hạn chế |
| `test_attempts` [T] | `student_id uuid!`, `test_version_id uuid!`, `attempt_no int!`, `started_at`, `submitted_at?`, `status`, `auto_score?`, `final_score?` | UQ(tenant_id,student_id,test_version_id,attempt_no) |
| `test_answers` [T] | `attempt_id uuid!`, `question_id uuid!`, `answer_payload jsonb?`, `auto_score?`, `submitted_at?` | UQ(tenant_id,attempt_id,question_id) |
| `test_evaluations` [T] | `attempt_id uuid!`, `skill_code text!`, `reviewer_membership_id uuid!`, `score?`, `rubric_results jsonb?`, `comment text?`, `reviewed_at` | Human grading & approval |
| `test_result_documents` [T] | `attempt_id uuid!`, `file_id uuid!`, `version_no int!`, `published_at?`, `published_by?` | Immutable PDF snapshot |
| `trial_reports` [T] | `student_id uuid!`, `session_id uuid!`, `enrollment_id uuid!`, `teacher_membership_id uuid!`, `report_version int!`, `ratings jsonb`, `comments text?`, `recommended_pathway_id?`, `status`, `file_id?` | Trial enrollment/entitlement phải hợp lệ trước session; UQ(tenant_id,session_id,student_id,report_version) |

## 4. Domain 04 — Product / Curriculum / Academic Catalog

| Bảng | Cột nghiệp vụ | Quan hệ & constraints |
|---|---|---|
| `products` [T] | `code text!`, `name text!`, `category text!`, `status text!`, `branch_scope text!` | UQ(tenant_id,code) |
| `product_branch_availability` [T,B] | `product_id uuid!`, `branch_id uuid!`, `valid_from`, `valid_to?` | N:N sản phẩm-cơ sở |
| `programs` [T] | `product_id uuid!`, `code text!`, `name text!`, `learning_goal text?` | UQ(tenant_id,code) |
| `pathways` [T] | `program_id uuid!`, `branch_id uuid?`, `name text!`, `status text!` | Mẫu lộ trình theo tenant/branch |
| `pathway_versions` [T] | `pathway_id uuid!`, `version_no int!`, `curriculum jsonb!`, `effective_from date!`, `effective_to date?`, `published_at?` | UQ(tenant_id,pathway_id,version_no); immutable published |
| `pathway_steps` [T] | `pathway_version_id uuid!`, `step_no int!`, `target_level text?`, `required_lessons numeric?`, `required_assessment jsonb?` | UQ(tenant_id,pathway_version_id,step_no) |
| `packages` [T] | `product_id uuid!`, `program_id uuid?`, `code text!`, `name text!`, `status text!` | UQ(tenant_id,code) |
| `package_versions` [T] | `package_id uuid!`, `version_no int!`, `lesson_units numeric(10,2)!`, `list_price numeric(18,2)!`, `currency char(3)!`, `policy_scope jsonb?`, `effective_from date!`, `effective_to date?` | UQ(tenant_id,package_id,version_no); positive price/units; snapshot |
| `package_pathways` [T,B] | `package_version_id uuid!`, `pathway_version_id uuid!`, `is_default boolean!` | Link vào phiên bản thay vì bản editable |
| `attendance_policy_versions` [T] | `code text!`, `branch_id uuid?`, `package_version_id uuid?`, `version_no int!`, `free_absence_limit numeric!`, `eligible_absence_types text[]!`, `late_rule jsonb!`, `makeup_rule jsonb!`, `effective_from date!`, `effective_to date?`, `approved_at?` | Rule binding cụ thể vào entitlement, version immutable |
| `reservation_policy_versions` [T] | `code text!`, `branch_id uuid?`, `version_no int!`, `short_max_lessons numeric?`, `long_min_lessons numeric?`, `calendar_rules jsonb!`, `approval_definition_id uuid?`, `effective_from date!` | Xác định chính xác biên đúng 4 buổi trước khi publish |
| `refund_policy_versions` [T] | `code text!`, `branch_id?`, `version_no int!`, `formula_spec jsonb!`, `effective_from date!`, `approved_at?` | Engine định giá rút phí cần replay |
| `transfer_policy_versions` [T] | `code text!`, `branch_id?`, `version_no int!`, `allowed_scopes jsonb!`, `conversion_formula jsonb!`, `effective_from date!` | Quy đổi tiền/buổi rõ ràng |

## 5. Domain 05 — Promotions / Quote / Sales / Contract

| Bảng | Cột nghiệp vụ | Quan hệ & constraints |
|---|---|---|
| `sales_policy_campaigns` [T] | `code text!`, `name text!`, `branch_id uuid?`, `start_at timestamptz!`, `end_at timestamptz!`, `status text!`, `priority int!` | UQ(tenant_id,code); cảnh báo campaign chồng lấn |
| `sales_policy_versions` [T] | `campaign_id uuid!`, `version_no int!`, `eligible_customer_type text[]`, `price_anchor text!`, `stacking_config jsonb!`, `discount_cap_pct numeric?`, `rounding_rule jsonb!`, `approved_at?` | UQ(tenant_id,campaign_id,version_no), freeze published |
| `promotion_rules` [T] | `policy_version_id uuid!`, `sequence_no int!`, `rule_type text!`, `value_amount?`, `value_pct?`, `base_selector text!`, `eligibility jsonb!`, `stack_group text?`, `max_discount_amount?` | `rule_type`: ADD_PCT/SEQUENTIAL_PCT/VOUCHER_BEFORE/VOUCHER_AFTER/...; CHECK giá trị hợp lệ |
| `promo_vouchers` [T] | `code text!`, `policy_rule_id uuid!`, `initial_value numeric!`, `remaining_value numeric!`, `max_redemptions int?`, `expires_at?`, `assigned_person_id?` | UQ(tenant_id,code); reservation tránh redeem 2 lần |
| `voucher_redemptions` [T] | `voucher_id uuid!`, `quote_id uuid?`, `contract_id uuid?`, `redeemed_amount numeric!`, `redeemed_at!`, `status!` | Atomic redemption and reversal |
| `quotes` [T] | `quote_no text!`, `student_id uuid!`, `branch_id uuid!`, `sale_type text!`, `status!`, `currency`, `valid_until?`, `issued_at?`, `owner_membership_id?`, `approved_workflow_id?` | UQ(tenant_id,quote_no); New/Renew |
| `quote_versions` [T] | `quote_id uuid!`, `version_no int!`, `policy_version_id uuid!`, `subtotal_amount numeric!`, `discount_amount numeric!`, `net_amount numeric!`, `pricing_trace jsonb!`, `snapshot jsonb!`, `finalized_at?` | UQ(tenant_id,quote_id,version_no); immutable finalized |
| `quote_lines` [T] | `quote_version_id uuid!`, `package_version_id uuid!`, `quantity numeric!`, `list_price numeric!`, `net_amount numeric!`, `pathway_version_id uuid?` | Giá snapshot per line |
| `contracts` [T] | `contract_no text!`, `student_id uuid!`, `branch_id uuid!`, `accepted_quote_version_id uuid?`, `sale_type text!`, `status text!`, `signed_at?`, `signed_file_id?`, `sales_membership_id?` | UQ(tenant_id,contract_no); immutable signature evidence |
| `contract_lines` [T] | `contract_id uuid!`, `package_version_id uuid!`, `pathway_version_id uuid?`, `lesson_units numeric!`, `gross_amount numeric!`, `discount_amount numeric!`, `net_amount numeric!`, `currency` | Line may create entitlement grant only after business activation |
| `contract_status_events` [T] | `contract_id uuid!`, `status text!`, `effective_at timestamptz!`, `reason?`, `actor_membership_id?` | Append-only history |

**Pricing invariant:** `(quote_version_id, policy_version_id, snapshot, pricing_trace)` xác định duy nhất giá lúc phát hành. Báo giá cũ không tự reprice khi CSBH đổi.

## 6. Domain 06 — Finance / Receivables / Refund / Transfer

| Bảng | Cột nghiệp vụ | Quan hệ & constraints |
|---|---|---|
| `receivables` [T] | `contract_id uuid!`, `contract_line_id uuid?`, `due_date date!`, `amount_due numeric!`, `currency`, `status text!` | Chia nhiều kỳ thu; amount_due >= 0 |
| `payment_transactions` [T] | `payment_no text!`, `student_id uuid!`, `branch_id uuid!`, `method text!`, `installment_flag boolean!`, `provider_ref text?`, `amount numeric!`, `currency`, `status text!`, `received_at?`, `confirmed_at?`, `confirmed_by?`, `idempotency_key text!` | UQ(tenant_id,payment_no), UQ(tenant_id,idempotency_key); cash/bank/POS |
| `payment_allocations` [T] | `payment_id uuid!`, `receivable_id uuid!`, `amount numeric!`, `allocated_at timestamptz!`, `status text!` | Σ alloc active <= confirmed payment and receivable |
| `financial_accounts` [T] | `code text!`, `name text!`, `account_type text!`, `currency`, `status` | Tenant accounting/subledger account chart |
| `financial_journals` [T] | `journal_no text!`, `source_type text!`, `source_id uuid!`, `posted_at?`, `status!`, `idempotency_key text!`, `reversal_of_journal_id uuid?` | UQ(tenant_id,journal_no), idempotent; posted immutable |
| `financial_journal_lines` [T] | `journal_id uuid!`, `account_id uuid!`, `student_id uuid?`, `branch_id uuid?`, `debit_amount numeric!`, `credit_amount numeric!`, `currency char(3)!` | CHECK one-sided positive; sum debit=sum credit per journal currency |
| `refund_requests` [T] | `student_id uuid!`, `contract_id uuid!`, `requested_amount numeric!`, `approved_amount?`, `currency`, `policy_version_id uuid!`, `calculation_snapshot jsonb!`, `workflow_instance_id?`, `status text!`, `reason text!` | approved != paid |
| `refund_disbursements` [T] | `refund_id uuid!`, `payment_ref text?`, `amount numeric!`, `paid_at timestamptz?`, `confirmed_by?`, `journal_id uuid?`, `idempotency_key text!` | Completed only after confirmed disbursement |
| `fee_transfer_requests` [T] | `from_student_id uuid!`, `to_student_id uuid!`, `from_grant_id uuid?`, `to_grant_id uuid?`, `transfer_mode text!`, `requested_lessons?`, `requested_amount?`, `approved_lessons?`, `approved_amount?`, `policy_version_id uuid!`, `workflow_instance_id?`, `status text!` | Source and recipient same tenant; cannot transfer to self unless explicitly business-approved |
| `fee_transfer_executions` [T] | `request_id uuid!`, `executed_at timestamptz!`, `financial_journal_id uuid?`, `entitlement_transfer_ref uuid?`, `idempotency_key text!` | UQ(tenant_id,request_id); debit-credit atomic |
| `billing_documents` [T] | `contract_id uuid?`, `student_id uuid!`, `document_type text!`, `provider_ref text?`, `number text?`, `status text!`, `issued_at?`, `source_snapshot jsonb!`, `file_id uuid?` | Invoices/adjustments; e-invoice via provider adapters |
| `payment_reconciliations` [T] | `payment_id uuid!`, `external_ref text?`, `matched_at?`, `matched_by?`, `status text!`, `evidence_file_id?` | Không coi user nhập tiền là tiền đã đối soát |

**Ledger:** Journal là sổ phụ phục vụ audit/đối chiếu; doanh thu theo chuẩn kế toán và hóa đơn pháp lý cần adapter/quy tắc riêng. `refund_requests`/`fee_transfer_requests` lưu quyết định, `financial_journals` lưu tác động đã thực hiện.

## 7. Domain 07 — Classes / Scheduling / Enrollments

| Bảng | Cột nghiệp vụ | Quan hệ & constraints |
|---|---|---|
| `rooms` [T] | `branch_id uuid!`, `code text!`, `name text!`, `capacity int?`, `active boolean!` | UQ(tenant_id,branch_id,code) |
| `classes` [T] | `branch_id uuid!`, `program_id uuid!`, `pathway_version_id uuid?`, `code text!`, `name text!`, `capacity int?`, `status text!`, `start_date date?`, `end_date date?` | UQ(tenant_id,branch_id,code); không hard delete lớp đã học |
| `class_teacher_assignments` [T] | `class_id uuid!`, `membership_id uuid!`, `role_code text!`, `skill_code text?`, `valid_from timestamptz!`, `valid_to timestamptz?` | Nhiều GV/kỹ năng và GVCN; overlap theo role nếu chính sách cấm |
| `class_schedule_rules` [T] | `class_id uuid!`, `timezone text!`, `recurrence_rule text!`, `local_start_time time!`, `duration_minutes int!`, `valid_from date!`, `valid_to date?` | RRULE immutable versions khi lịch thay đổi |
| `class_sessions` [T] | `class_id uuid!`, `session_no int?`, `planned_start timestamptz!`, `planned_end timestamptz!`, `actual_start?`, `actual_end?`, `room_id?`, `status text!`, `origin_rule_id?`, `cancel_reason?` | CHECK end>start; UQ(tenant_id,class_id,session_no) where session_no not null |
| `session_teacher_assignments` [T] | `session_id uuid!`, `membership_id uuid!`, `skill_code?`, `role_code text!` | Cover teacher substitutions per session |
| `enrollments` [T] | `student_id uuid!`, `class_id uuid!`, `enrollment_type text!`, `entitlement_grant_id uuid!`, `status text!`, `valid_from timestamptz!`, `valid_to timestamptz?`, `started_by_transfer_id uuid?` | N:N Student-Class theo thời gian; hỗ trợ parallel enrollment nếu policy cho phép |
| `enrollment_events` [T] | `enrollment_id uuid!`, `event_type text!`, `effective_at timestamptz!`, `actor_membership_id?`, `details jsonb?` | Append-only lịch sử gia nhập/rời lớp |
| `class_transfer_requests` [T] | `student_id uuid!`, `from_enrollment_id uuid!`, `to_class_id uuid!`, `requested_effective_at timestamptz!`, `last_old_session_id uuid?`, `status text!`, `reason text!`, `workflow_instance_id?` | Request state riêng; scheduler thực hiện đúng mốc |
| `class_transfer_executions` [T] | `request_id uuid!`, `old_enrollment_id uuid!`, `new_enrollment_id uuid!`, `effective_at timestamptz!`, `idempotency_key text!` | UQ(tenant_id,request_id); atomic end/start |
| `session_change_events` [T] | `session_id uuid!`, `change_type text!`, `old_snapshot jsonb!`, `new_snapshot jsonb!`, `approved_by?`, `occurred_at timestamptz!` | Audit hủy/đổi/bù |

**Trùng lịch:** không đơn giản cấm mọi overlap enrollment vì có đăng ký song song hợp lệ. Cần check collision theo `class_sessions` / `session_teacher_assignments` / room tại thời điểm tạo hoặc đổi lịch (transaction lock); nên bổ sung exclusion constraints với lịch tài nguyên nếu materialize booking.

## 8. Domain 08 — Attendance / Lesson Rights / Absence

| Bảng | Cột nghiệp vụ | Quan hệ & constraints |
|---|---|---|
| `entitlement_grants` [T] | `student_id uuid!`, `contract_line_id uuid?`, `grant_type text!`, `package_version_id uuid?`, `attendance_policy_version_id uuid?`, `total_units numeric!`, `valid_from timestamptz!`, `valid_to?`, `status text!` | Một grant = quyền học từ hợp đồng/trial/transfer/bonus; total_units >=0 |
| `entitlement_ledger_entries` [T] | `grant_id uuid!`, `student_id uuid!`, `entry_type text!`, `units_delta numeric(10,2)!`, `effective_at timestamptz!`, `source_type text!`, `source_id uuid!`, `reversal_of_entry_id uuid?`, `idempotency_key text!` | Append-only; UQ(tenant_id,grant_id,idempotency_key), `remaining=Σ units_delta` |
| `attendance_records` [T] | `session_id uuid!`, `enrollment_id uuid!`, `student_id uuid!`, `status text!`, `absence_permission text?`, `late_minutes int?`, `reason?`, `recorded_by_membership_id uuid!`, `recorded_at timestamptz!`, `confirmed_at?`, `confirmed_by?`, `version int!` | UQ(tenant_id,session_id,student_id) current record; history in attendance_revisions |
| `attendance_revisions` [T] | `attendance_id uuid!`, `revision_no int!`, `before_snapshot jsonb?`, `after_snapshot jsonb!`, `changed_by_membership_id uuid!`, `changed_at timestamptz!`, `reason text!` | UQ(tenant_id,attendance_id,revision_no); immutable |
| `absence_allowance_usages` [T] | `grant_id uuid!`, `attendance_id uuid!`, `policy_version_id uuid!`, `units numeric!`, `status text!`, `reversal_of_usage_id uuid?` | UQ active allowance/attendance; `Σ active units <= free_absence_limit` under serialized lock |
| `makeup_entitlements` [T] | `student_id uuid!`, `source_attendance_id uuid!`, `grant_id uuid!`, `units numeric!`, `expires_at?`, `status text!` | Theo chính sách; tránh trừ/ghi tăng hai lần |
| `attendance_session_finalizations` [T] | `session_id uuid!`, `finalized_by_membership_id uuid!`, `finalized_at timestamptz!`, `attendance_count int!`, `status text!` | UQ(tenant_id,session_id) current finalized; revisions audit |

**Quy tắc bút toán:** grant +96; có mặt -1; vắng miễn phí 0; vắng sau quota -1; điều chỉnh từ -1 sang 0 => bút toán +1 có `reversal_of_entry_id`; idempotency theo **(grant, nguồn sự kiện, phiên bản, loại bút toán)**. Không cho balance âm bằng lock + kiểm tra transaction. Trial dùng grant riêng. Bảo lưu có thể khóa việc sử dụng grant trong khoảng ngày; không được ghi giảm buổi chỉ vì bảo lưu.

## 9. Domain 09 — Student Operations / Reservation / Exit

| Bảng | Cột nghiệp vụ | Quan hệ & constraints |
|---|---|---|
| `reservation_requests` [T] | `student_id uuid!`, `enrollment_id uuid?`, `grant_id uuid!`, `policy_version_id uuid!`, `reservation_kind text!`, `start_date date!`, `end_date date!`, `eligible_lessons numeric!`, `held_lessons numeric!`, `held_value numeric(18,2)?`, `reason text!`, `workflow_instance_id?`, `status text!` | CHECK(end_date>=start_date); ngắn/dài theo version; GVCN->KT->QL |
| `reservation_effects` [T] | `request_id uuid!`, `grant_id uuid!`, `effective_from timestamptz!`, `effective_to timestamptz?`, `effect_type text!`, `status text!` | Freeze entitlement/scheduling; overlap conflicts kiểm soát |
| `reservation_resumptions` [T] | `request_id uuid!`, `resumed_at timestamptz!`, `target_enrollment_id uuid?`, `approved_by?`, `notes?` | Ngày quay lại và xếp lớp mới nếu cần |
| `student_exit_requests` [T] | `student_id uuid!`, `enrollment_id uuid!`, `exit_type text!`, `last_session_id uuid!`, `effective_at timestamptz!`, `reason_code text!`, `reason_detail?`, `workflow_instance_id uuid!`, `status text!` | Exit type DROP_OUT/GRADUATION, luôn QL approve |
| `student_status_periods` [T] | `student_id uuid!`, `status_group text!`, `status_code text!`, `valid_from timestamptz!`, `valid_to timestamptz?`, `source_type text!`, `source_id uuid!` | Thời kỳ trạng thái Active/Reserved/Graduate... cho báo cáo lịch sử |
| `exit_reason_catalog` [T] | `code text!`, `name text!`, `exit_type text!`, `is_active boolean!` | UQ(tenant_id,code) |

## 10. Domain 10 — LMS / Reports / CSKH / Renewal / Workflow

| Bảng | Cột nghiệp vụ | Quan hệ & constraints |
|---|---|---|
| `learning_materials` [T] | `program_id uuid?`, `class_id uuid?`, `file_id uuid!`, `title text!`, `visibility text!` | Teacher/parent scope |
| `lesson_plans` [T] | `session_id uuid!`, `teacher_membership_id uuid!`, `content jsonb!`, `published_at?` | Lesson plan vs real delivery log |
| `lesson_delivery_logs` [T] | `session_id uuid!`, `teacher_membership_id uuid!`, `actual_content text!`, `completed_at timestamptz!`, `remarks?` | UQ(tenant_id,session_id,teacher_membership_id) if one per teacher |
| `homework_assignments` [T] | `class_id uuid!`, `session_id uuid?`, `title text!`, `instructions text?`, `due_at timestamptz!`, `created_by_membership_id uuid!` | Theo lớp và buổi |
| `homework_submissions` [T] | `assignment_id uuid!`, `student_id uuid!`, `submitted_at?`, `status text!`, `file_id?`, `grade?`, `feedback?` | UQ(tenant_id,assignment_id,student_id); history revisions if needed |
| `academic_assessments` [T] | `student_id uuid!`, `class_id uuid?`, `assessment_type text!`, `skill_code?`, `score numeric?`, `max_score numeric?`, `assessed_at timestamptz!`, `assessor_membership_id uuid!` | Test ngoài online cũng lưu tại đây với source ref |
| `student_quality_periods` [T] | `student_id uuid!`, `class_id uuid?`, `rating_code text!`, `valid_from`, `valid_to?`, `assessed_by_membership_id uuid!` | Xuất sắc/Tốt/Khá/TB/Yếu cấu hình |
| `monthly_reports` [T] | `student_id uuid!`, `branch_id uuid!`, `period_month date!`, `status text!`, `owner_membership_id?`, `released_at?` | UQ(tenant_id,student_id,period_month) (theo student; nếu yêu cầu theo enrollment thì thay grain) |
| `monthly_report_versions` [T] | `report_id uuid!`, `version_no int!`, `attendance_snapshot jsonb!`, `payment_snapshot jsonb!`, `assessment_snapshot jsonb!`, `homework_snapshot jsonb!`, `teacher_comments text?`, `file_id?`, `published_at?` | UQ(tenant_id,report_id,version_no); released immutable |
| `report_deliveries` [T] | `report_version_id uuid!`, `guardian_id uuid!`, `channel text!`, `sent_at?`, `delivery_status text!`, `provider_ref?` | Theo dõi PH đã nhận/chưa |
| `happy_calls` [T] | `student_id uuid!`, `guardian_id uuid?`, `report_version_id uuid?`, `caller_membership_id uuid!`, `called_at timestamptz!`, `call_outcome text!`, `summary text!`, `satisfaction_score?`, `next_action_at?` | Lịch sử nhiều lần |
| `customer_cases` [T] | `student_id uuid!`, `source_type text!`, `source_id uuid?`, `category text!`, `priority text!`, `status text!`, `owner_membership_id uuid?`, `due_at?`, `resolved_at?` | Khiếu nại/chất lượng/CSKH |
| `renewal_cases` [T] | `student_id uuid!`, `source_grant_id uuid!`, `expected_expiry_at?`, `likelihood text!`, `status text!`, `owner_membership_id uuid?`, `target_package_version_id?`, `next_action_at?`, `outcome_contract_id?`, `lost_reason?` | UQ theo source_grant + renewal cycle khi cần |
| `renewal_case_events` [T] | `renewal_case_id uuid!`, `status text!`, `likelihood text?`, `note text?`, `event_at timestamptz!`, `actor_membership_id?` | Không overwrite lịch sử đánh giá |
| `renewal_meetings` [T] | `branch_id uuid!`, `meeting_at timestamptz!`, `horizon_months int!`, `chair_membership_id uuid!`, `summary?`, `status text!` | Horizon 3/6 tùy filter |
| `renewal_meeting_items` [T] | `meeting_id uuid!`, `renewal_case_id uuid!`, `assessment_snapshot jsonb!`, `decision text?`, `assignee_membership_id?`, `due_at?` | UQ(tenant_id,meeting_id,renewal_case_id), đồng bộ task về renewal case |
| `workflow_definitions` [T] | `code text!`, `name text!`, `subject_type text!`, `branch_id?`, `status text!` | Approval engine definition |
| `workflow_versions` [T] | `definition_id uuid!`, `version_no int!`, `steps_spec jsonb!`, `effective_from timestamptz!`, `published_at?` | UQ(tenant_id,definition_id,version_no); frozen per instance |
| `workflow_instances` [T] | `workflow_version_id uuid!`, `subject_type text!`, `subject_id uuid!`, `status text!`, `initiated_by_membership_id uuid!`, `started_at timestamptz!`, `completed_at?` | Subject refs validated in domain service, polymorphic cannot standard FK |
| `workflow_approvals` [T] | `instance_id uuid!`, `step_no int!`, `assigned_membership_id?`, `acted_by_membership_id?`, `action text!`, `acted_at?`, `comment?` | Không skip các bước bắt buộc; separation-of-duties |
| `tasks` [T] | `subject_type text!`, `subject_id uuid!`, `owner_membership_id uuid!`, `due_at?`, `priority text!`, `status text!`, `completed_at?` | Contextual tasks + SLA |
| `notifications` [T] | `recipient_membership_id uuid?`, `recipient_person_id uuid?`, `channel text!`, `template_version_id uuid?`, `payload jsonb!`, `status text!`, `sent_at?` | Consent & rate limits |
| `automation_rules` [T] | `code text!`, `trigger_event text!`, `conditions jsonb!`, `actions jsonb!`, `branch_id?`, `is_enabled boolean!`, `version int!` | Config safe DSL, không arbitrary code |

## 11. Domain 11 — Files / Integration / Analytics / Imports

| Bảng | Cột nghiệp vụ | Quan hệ & constraints |
|---|---|---|
| `stored_files` [T] | `object_key text!`, `bucket text!`, `mime_type text!`, `bytes bigint!`, `checksum_sha256 text!`, `privacy_level text!`, `uploaded_by_membership_id?`, `retention_until?` | UQ(tenant_id,object_key); object key tenant-scoped; private only |
| `document_templates` [T] | `code text!`, `name text!`, `document_type text!`, `branch_id?`, `status text!` | UQ(tenant_id,code) |
| `document_template_versions` [T] | `template_id uuid!`, `version_no int!`, `schema jsonb!`, `file_id?`, `published_at?` | Snapshot release |
| `integration_connections` [T] | `branch_id?`, `provider text!`, `external_account_id text!`, `status text!`, `credentials_secret_ref text?`, `permissions jsonb?`, `connected_at?` | Unique(provider,external_account_id) per tenant; secrets outside DB |
| `webhook_inbox` [T] | `connection_id uuid!`, `provider_event_id text!`, `received_at timestamptz!`, `signature_valid boolean!`, `payload_ref uuid?`, `process_status text!`, `processed_at?` | UQ(tenant_id,connection_id,provider_event_id), retry safe |
| `event_outbox` [T] | `aggregate_type text!`, `aggregate_id uuid!`, `event_type text!`, `event_version int!`, `payload jsonb!`, `occurred_at timestamptz!`, `published_at?` | Outbox in same DB transaction as mutation |
| `import_batches` [T] | `branch_id?`, `source_type text!`, `source_file_id uuid?`, `status text!`, `started_at`, `completed_at?`, `created_count int`, `updated_count int`, `rejected_count int` | Staging/preview before commit |
| `import_rows` [T] | `batch_id uuid!`, `source_row_no int!`, `raw jsonb!`, `mapped jsonb?`, `status text!`, `error_codes jsonb?`, `linked_person_id?` | UQ(tenant_id,batch_id,source_row_no) |
| `metric_definitions` [T] | `code text!`, `name text!`, `grain text!`, `numerator_spec jsonb?`, `denominator_spec jsonb?`, `time_basis text!`, `status text!` | UQ(tenant_id,code); published version needed |
| `metric_definition_versions` [T] | `metric_id uuid!`, `version_no int!`, `sql_model_ref text!`, `definition jsonb!`, `published_at?` | No arbitrary tenant SQL execution; curated query builder |
| `funnel_definitions` [T] | `name text!`, `version_no int!`, `stages jsonb!`, `count_mode text!`, `cohort_window jsonb?`, `branch_id?`, `published_at?` | stage list configurable, definitions versioned |
| `report_snapshots` [T] | `report_type text!`, `period_start timestamptz!`, `period_end timestamptz!`, `filters jsonb!`, `metric_version_ids uuid[]?`, `payload jsonb!`, `generated_at timestamptz!` | Snapshot for frozen historical reports |

## 12. Truy vết quan hệ và cardinality chính

- `tenants 1→N branches / memberships / students / contracts / classes`.
- `platform_users N↔N tenants` qua `tenant_memberships`; `memberships N↔N branches` qua `membership_branch_scopes`; `memberships N↔N roles` qua `membership_roles`.
- `persons 1→0..1 students`, `persons 1→0..1 guardians`, `students N↔N guardians` qua `student_guardians`.
- `persons 1→N lead_inquiries`; `lead_inquiries 1→N lead_stage_events / lead_attributions`; `persons 1→N checkins`.
- `students 1→N quotes/contracts/test_attempts/enrollments/renewal_cases`; `contracts 1→N contract_lines`; `contract_lines 0..N entitlement_grants`.
- `classes 1→N class_sessions`, `students N↔N classes` qua `enrollments` (time-valid); `class_sessions 1→N attendance_records`.
- `entitlement_grants 1→N entitlement_ledger_entries`; `attendance_records 0..N revisions`, `0..N allowance usages`; confirmed attendance induces exactly one effective consumption *state* per grant/session/student, represented by immutable ledger movements.
- `contracts 1→N receivables`; `payments N↔N receivables` qua allocations; `financial_journals 1→N journal_lines`.
- `class_transfer_requests 0..1→class_transfer_executions`; `reservation_requests 1→N reservation_effects`; `refund_requests 1→N refund_disbursements` (partial refunds permitted); `fee_transfer_requests 0..1→fee_transfer_executions`.
- `monthly_reports 1→N versions 1→N deliveries`; `renewal_meetings N↔N renewal_cases` qua `renewal_meeting_items`.

## 13. Invariants – bắt buộc DB constraints hoặc transactional domain service

| ID | Invariant | Cơ chế |
|---|---|---|
| I01 | Không liên kết đối tượng từ 2 tenants khác nhau | Composite FK `(tenant_id,id)` + RLS + integration tests |
| I02 | Không truy cập chi nhánh ngoài scope | App RBAC + membership_branch_scopes + query predicate/DB guard |
| I03 | Mọi thay đổi người dùng có audit | App domain event + append-only audit; outbox same transaction |
| I04 | Person không bị nhân bản bởi stage | Identity resolver; merge process audited; không unique phone |
| I05 | Trial / paid class cần entitlement hiệu lực | Enrollment service transaction/trigger guard |
| I06 | Không trừ buổi hai lần khi retry điểm danh | Unique idempotency + lock grant + ledger reversal khi edit |
| I07 | Không vượt số buổi vắng miễn phí | Lock/serializable on grant/policy allowance during confirmation |
| I08 | Không cho grant balance < 0 | Serialize per grant, lock & check balance, optional materialized balance invariant |
| I09 | Không 2 active enrollment trùng lịch trái chính sách | Collision checks by class sessions, not arbitrary one-class-only uniqueness |
| I10 | Chuyển lớp đúng thời điểm, không rơi học sinh | Atomic end-old/create-new, effect scheduled, request idempotency |
| I11 | Bảo lưu không tự phát sinh tiêu thụ | Attendance eligibility guards + reservation effective range |
| I12 | Dừng học chỉ sau quản lý xác nhận | Workflow status gate; last_session validates class membership |
| I13 | Chính sách giá đã publish / quote finalized bất biến | Immutable versions + pricing trace + quote snapshot |
| I14 | Discount/voucher đúng thứ tự, không vượt trần | Pricing engine deterministic + golden tests |
| I15 | Không thể spend cùng voucher hai lần ngoài quota | Atomic reservation/redemption + constraints |
| I16 | Số tiền allocated không vượt payment confirmed | Lock payment & receivable, check sums transactional |
| I17 | Journal posted tổng debit = tổng credit | Deferred constraint trigger before commit, by currency |
| I18 | Posted journal immutable; sửa bằng reversal | DB trigger + service permissions |
| I19 | Refund approved ≠ refund paid | Disbursement confirmed + journal posted => completed |
| I20 | Transfer phí không tạo one-sided debit/credit | Single DB transaction + paired ledger movements + idem key |
| I21 | Renewal event không tự làm tăng Active 2 lần | Unique student headcount + metric dictionary grain |
| I22 | Active/Retention có thể tái lập lịch sử | status/effective periods, event time & cutoff, snapshots |
| I23 | Số buổi còn lại khác số buổi đã tới lớp | Entitlement ledger vs attendance events separated |
| I24 | Không phát hành monthly report chỉnh sửa không có version | immutable report versions and PDFs |
| I25 | Webhook retries không nhân bản Lead/Payment | Provider event uniqueness + outbox/inbox processing |
| I26 | Tenant suspended không đồng nghĩa xóa dữ liệu | scoped auth restrictions + legal retention + export process |
| I27 | Gia hạn/renew cần phân biệt contract bổ sung | `sale_type` + renewal linked to source grant/preceding contract |
| I28 | Backdated changes không làm KPI thay đổi âm thầm | temporal version/audit + documented restatement policy |

## 14. Mẫu DDL tenant isolation + RLS (mẫu dùng thật, cần test trong app)

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE tenants (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 code text NOT NULL UNIQUE,
 legal_name text NOT NULL,
 display_name text NOT NULL,
 status text NOT NULL,
 timezone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
 base_currency char(3) NOT NULL DEFAULT 'VND',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE persons (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 full_name text NOT NULL,
 dob date,
 status text NOT NULL DEFAULT 'ACTIVE',
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (tenant_id,id)
);
CREATE TABLE students (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES tenants(id),
 person_id uuid NOT NULL,
 student_code text NOT NULL,
 lifecycle_status text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (tenant_id,id),
 UNIQUE (tenant_id,person_id),
 UNIQUE (tenant_id,student_code),
 FOREIGN KEY (tenant_id,person_id) REFERENCES persons(tenant_id,id)
);

-- Runtime role không là owner, không BYPASSRLS; session context gắn vào 1 transaction.
ALTER TABLE persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE persons FORCE ROW LEVEL SECURITY;
CREATE POLICY persons_tenant_select ON persons FOR SELECT
 USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);
CREATE POLICY persons_tenant_insert ON persons FOR INSERT
 WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);
CREATE POLICY persons_tenant_update ON persons FOR UPDATE
 USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);
CREATE POLICY persons_tenant_delete ON persons FOR DELETE
 USING (tenant_id = NULLIF(current_setting('app.tenant_id',true),'')::uuid);
-- Thêm tương tự cho students và mọi bảng tenant-owned.
-- Trên service: BEGIN; SELECT set_config('app.tenant_id', validatedTenantId, true); ... COMMIT;
-- KHÔNG cho user tùy ý SET tenant_id; tenant context phải lấy từ session membership xác thực.
```

**Cảnh báo quan trọng:** `current_setting` dựa vào session setting chỉ an toàn khi client DB là backend tin cậy, kết nối DB không public, role runtime không được tự giả mạo context; với connection pooling phải dùng **transaction-local** setting trên mọi request. RLS tenant filter không thay branch-level RBAC. Data migrations phải có quyền riêng và audit. Owner/superuser/BYPASSRLS có thể bypass nếu không cấu hình đúng.

## 15. Các chỉ mục (indexes) và scale

- Mọi FK `(tenant_id, referenced_id)` có index ở bên tham chiếu; thêm `(tenant_id,branch_id, status, created_at)` cho các bảng hay lọc theo cơ sở.
- `lead_stage_events (tenant_id,stage_code,entered_at)`, `checkins (tenant_id,branch_id,arrived_at)`, `contracts (tenant_id,branch_id,signed_at)`, `class_sessions (tenant_id,class_id,planned_start)`.
- `attendance_records (tenant_id,session_id,student_id)` unique; `entitlement_ledger_entries (tenant_id,grant_id,effective_at)`; `payment_transactions (tenant_id,received_at,status)`.
- Partial indexes cho `status='ACTIVE'`/`status='PENDING'` tùy workload; cân nhắc partition by time cho `audit_logs`, `event_outbox`, `attendance_records` khi dung lượng đủ lớn.
- Scope của `phone_normalized`/external provider IDs phải được định nghĩa để không vô tình gộp anh chị em hoặc các tenant.
- Truy vấn báo cáo: `metric_fact` curated read models; incremental/materialized aggregation theo tenant, date và dimension. Không chạy trực tiếp nhiều join N:N phức tạp ở Dashboard thời gian thực.

## 16. Checklist kiểm thử đặc biệt (ưu tiên Stage 1–5)

1. Tenant A không thể SELECT/INSERT/UPDATE/DELETE record Tenant B dù biết UUID.
2. Chèn `students(tenant=A,person_id=B)` thất bại tại FK.
3. Người có scope cơ sở 1 không thấy dữ liệu cơ sở 2; head office scope toàn tenant thì có.
4. Hai anh chị em chung số phụ huynh: 2 `students`, 1 `guardian` liên kết N:N.
5. Một person nhiều lead inquiries: chỉ một student master, first-touch không mất.
6. Cùng event webhook replay 10 lần: chỉ một inbound record/nguồn xử lý.
7. Quote 30 triệu CK10%, CK thêm 5% additive/sequential và voucher trước/sau ra 4 kết quả xác định.
8. Đổi CSBH hôm sau không làm quote cũ đổi.
9. Check-in Walk-in tạo person + check-in mà không bắt buộc có lead từ page.
10. Trial 1 buổi không làm giảm grant paid.
11. Lưu điểm danh ba lần không trừ buổi ba lần.
12. Sửa absent unexcused thành excused miễn phí: có bút toán trả buổi đúng một lần.
13. Gói 96 với 4 buổi vắng miễn trừ: buổi thứ 5 bị trừ theo policy, các lần sửa không vượt quota.
14. Bảo lưu cắt qua lịch nghỉ lễ: tính theo session được dạy/được duyệt, không lấy số ngày / 7.
15. Chuyển FT139→FT143 theo effective time, old enrollment ends, new one starts atomically.
16. Dừng học sau buổi cuối, QL chưa duyệt thì không thay Active.
17. Thanh toán hai đợt; tổng phân bổ không vượt thực thu.
18. Refund duyệt nhưng chưa chuyển tiền: trạng thái không phải COMPLETED.
19. Chuyển 10 buổi A→B: ledger bên A, B cùng commit hoặc cùng rollback.
20. Báo cáo Active đầu/cuối tháng và funnel cohort có kết quả khớp chi tiết theo cùng cutoff.

## 17. Quyết định mở (đưa vào ADR, chưa hard-code)

- Dùng RLS bằng transaction-local tenant context và kiểm soát branch ở backend hay thêm branch policy DB; quyền support break-glass.
- Scope `/contracts`, `/students`, `/payments` theo chi nhánh sở hữu hay nhiều chi nhánh tham gia; chi phí chuyển phí liên cơ sở.
- Mô hình `academic assessment` chi tiết theo từng skill và rubric cho IELTS/TOEFL/KET/PET.
- Thế nào là Active có phí/miễn phí, Trial, Bảo lưu, nghỉ ngang trong báo cáo theo từng tenant.
- Bảo lưu ngắn hạn `<4`, dài hạn `>4`: xử lý **đúng 4** là một boundary cần người dùng/tenant quyết định.
- Phí đã trả góp/chi phí POS, thuế, hóa đơn điều chỉnh, revenue recognition.
- Giá trị buổi chuyển khi khác sản phẩm/cơ sở, đơn vị quy đổi (tiền/buổi), snapshot pricing.
- Status taxonomy của Lead/QL, check-in, trial trong phễu tùy chỉnh và xử lý skip-stage.
- Quy tắc policy change đối với gói phí đã bán (grandfather/version).
- `monthly_reports` grain theo student/tháng hay student/enrollment/tháng khi có song song nhiều lớp.
- Retention/backup/export/deletion/legal hold và tenant hosting region.

## 18. Acceptance gate để bắt đầu DDL/Prisma migration

**Đủ điều kiện thiết kế migration đầu tiên** khi: (1) naming/types/coding conventions xác nhận; (2) tenant isolation tests viết trước; (3) luồng cốt lõi `person→lead→checkin→contract→grant→enrollment→attendance` có sequence diagram; (4) pricing và entitlement ledger có golden test; (5) role permissions matrix; (6) có chiến lược migrations/backup, không tự deploy DB schema chưa review.

**Gợi ý phân bước migration:** `001_platform_identity` → `002_people_crm` → `003_catalog_pricing` → `004_sales_finance` → `005_classes_entitlements` → `006_operations` → `007_lms_customer_success` → `008_integrations_analytics`.
