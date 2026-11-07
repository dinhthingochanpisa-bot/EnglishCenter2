# STATE MACHINES v1.0 — LMS + CRM SaaS

**Baseline:** Master PRD v1.0 + ERD v1.0 (06/11/2026). **Trạng thái:** đặc tả đề xuất, cần xác nhận chính sách trước khi chốt migration và API. `Event` là sự kiện nghiệp vụ logic, không bắt buộc event sourcing/microservices.

## 1. Quy tắc chung cho mọi state machine

- Mỗi transition có `from → to`, trigger, permission, guard, side effect, audit. Backend là source of truth; UI không tự set trạng thái.
- Ghi `occurred_at` (thời điểm sự kiện), `effective_at` (thời điểm hiệu lực nếu khác), `actor_membership_id`, `workflow_instance_id`, `reason`, `request_id/idempotency_key` khi cần.
- Workflow `APPROVED` chưa chắc `EFFECTIVE` hay `COMPLETED`. Với bảo lưu, dừng học, chuyển lớp và rút phí, các trạng thái phải riêng biệt.
- Mỗi transition dùng optimistic locking (`row_version`) và DB transaction; external side effects qua outbox/job có retry idempotent.
- Trường thông tin lịch sử đã phát hành/ký/ghi sổ là immutable; thay đổi bằng version hoặc reversal, không overwrite.
- Nếu các bước bị bỏ qua theo cấu hình (không Test/Trial) thì không ép funnel cứng. Funnel analytics dựa trên stage history và cohort.

## 2. Lead/Qualified Lead + Check-in

`lead_inquiries.status`: `NEW → QUALIFIED → CONTACTING → APPOINTMENT_SET → CHECKED_IN → CONVERTED`; nhánh `NEW/QUALIFIED/CONTACTING/APPOINTMENT_SET → LOST`, `LOST → REOPENED → CONTACTING`.

| Transition | Guard | Side effects |
|---|---|---|
| NEW→QUALIFIED | Đủ tiêu chí QL cấu hình (ví dụ SĐT hợp lệ) | `qualified_at`, `lead_stage_events` |
| *→CHECKED_IN | Có check-in xác nhận, linked person, branch | `checkins`, stage event; giữ nguyên first attribution |
| *→CONVERTED | Hợp đồng có hiệu lực tham chiếu student/person | Đánh dấu conversion; không xóa lead |
| *→LOST/REOPENED | Có reason, actor quyền CRM | Activity, audit + history |

**Điểm then chốt:** `lead_inquiries` là cơ hội/liên hệ, không đồng nhất `students.lifecycle_status`. Khách walk-in có thể tạo person + check-in + lead attribution walk-in mà không có lead online.

## 3. Placement Test & Trial

`test_attempts`: `CREATED → IN_PROGRESS → SUBMITTED → AUTO_GRADED/PENDING_MANUAL → REVIEWED → RELEASED`; có thể `VOIDED` với quyền và reason. Kết quả công bố phải lưu snapshot/phiên bản, được quyền in.

`trial`: `REQUESTED → ELIGIBLE → ENROLLED → ATTENDED → REPORT_DRAFT → REPORT_APPROVED → CLOSED`, nhánh `CANCELLED/NO_SHOW`. Guard: có trial entitlement còn hiệu lực, không vượt buổi cho phép; không thể xếp học thử nếu thiếu entitlement hợp lệ. Không yêu cầu Trial nếu contract chính thức đã tạo quyền học.

## 4. Quotes / Sales Policy / Contracts

`promotion_policies`/version: `DRAFT → PENDING_REVIEW → APPROVED → PUBLISHED → EXPIRED/RETIRED`; từ `PENDING_REVIEW → REJECTED → DRAFT`. Published version bất biến, quote lưu reference policy version + calculation snapshot.

`quotes`: `DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → ISSUED → ACCEPTED`; nhánh `CHANGES_REQUESTED → DRAFT`, `REJECTED`, `EXPIRED`, `CANCELLED`. Điều kiện `ISSUED`: có quote version approved; điều kiện `ACCEPTED`: khách chấp thuận trong thời hạn giữ giá hoặc có phê duyệt ngoại lệ.

`contracts`: `DRAFT → PENDING_SIGNATURE → SIGNED → ACTIVE → COMPLETED`; nhánh `CANCELLED/TERMINATED` theo policy. `SIGNED` không có nghĩa đã nhận tiền; finance và quyền học quyết định hiệu lực enrollment.

## 5. Payment / Receivable

`receivable`: `OPEN → PARTIALLY_PAID → PAID`, nhánh `OVERDUE` là trạng thái tính theo due-date, không nhất thiết là state lưu cứng; `ADJUSTED/VOIDED` qua bút toán. `payment`: `INITIATED → PENDING_VERIFICATION → CONFIRMED`, nhánh `FAILED/REJECTED/REVERSED`. Khi `CONFIRMED` tạo financial journal/bút toán và allocation đến receivable; webhook retry không được ghi trùng. `CONFIRMED` yêu cầu evidence và permission KT hoặc provider settlement được ủy quyền.

## 6. Enrollment & Class Transfer

`enrollments`: `PLANNED → ACTIVE → ENDED`; nhánh `CANCELLED` chỉ khi chưa có session attendance/financial effect. Lưu `valid_from`, `valid_to` dạng `[start,end)`.

`class_transfer_requests`: `DRAFT → SUBMITTED → VALIDATED → APPROVED → SCHEDULED → EXECUTED`; nhánh `REJECTED`, `CANCELLED`, `BLOCKED`. `SCHEDULED` là đã được chấp thuận nhưng chưa chuyển.

**Guard để EXECUTED:** `effective_at` đã tới; buổi cuối tại lớp cũ đã hoàn tất hoặc đã được xử lý ngoại lệ; lớp đến mở và còn sức chứa; không chồng lịch/xung đột active enrollment trái policy; entitlement hợp lệ. **Side effects trong một DB transaction:** set `old_enrollment.valid_to = effective_at`; tạo `new_enrollment.valid_from = effective_at`; ghi `class_transfer_executions` unique by request; giữ nguyên entitlement balance; tạo audit/outbox. Worker retry không tạo enrollment thứ hai.

**Trường hợp biên:** Không có buổi học trước effective date, lớp hủy buổi cuối, chuyển khi đang bảo lưu, chuyển lớp trùng ngày học 2 lớp; phải định nghĩa chính sách xử lý, không suy ra ngày học cuối từ `request_created_at`.

## 7. Class Session, Attendance & Entitlement

`class_sessions`: `PLANNED → CONFIRMED → IN_PROGRESS → COMPLETED`; nhánh `CANCELLED`, `RESCHEDULED`. Đổi lịch phải lưu session provenance; session cancelled không tiêu thụ buổi theo mặc định.

`attendance_records`: `DRAFT → CONFIRMED → LOCKED`; sửa sau `CONFIRMED` tạo `attendance_revisions`, đồng thời reverse-and-repost phần tiêu thụ buổi **một lần**, trong transaction. Values: `PRESENT`, `LATE` (+ minutes), `ABSENT_EXCUSED`, `ABSENT_UNEXCUSED`. Trạng thái thiếu điểm danh là `NOT_MARKED` cho đến khi confirm, không mặc định absent.

**Entitlement invariant:** balance = sum(grants, reversals, consumption, transfers, adjustments). Mỗi `(tenant_id,session_id,student_id,effect_type)` chỉ có một effect active; key nguồn bảo vệ chống double charging. Policy vắng miễn phí là version ràng vào quyền học; `free_absence_limit` per package/center, eligible absence types cấu hình. Ví dụ 96 buổi, được miễn tối đa 4 buổi đủ điều kiện: 4 buổi đầu không trừ; buổi thứ 5 trừ 1. Sửa lịch sử điểm danh phải recompute allowance và posted consumption theo trình tự thời gian, có reversal rõ ràng.

## 8. Bảo lưu (tạm dừng học)

`reservation_requests`: `DRAFT → SUBMITTED → AWAITING_HOMEROOM → AWAITING_ACCOUNTING → AWAITING_MANAGER → APPROVED → SCHEDULED → ACTIVE → ENDED → RESUMED`; nhánh `REJECTED`, `CANCELLED`.

- `reservation_kind`: SHORT/LONG theo `reservation_policy_versions`, không hard-code ngưỡng 4; trường hợp đúng 4 buổi do policy xác định.
- Guard trình: start/end hợp lệ, không xung đột bảo lưu khác, entitlement và lớp hợp lệ, số buổi được bảo lưu/giá trị tính ra có snapshot.
- GVCN duyệt chuyên môn → KT duyệt số buổi/giá trị → QL phê duyệt. Có thể cấu hình hạn mức và delegation nhưng không bỏ qua SoD tối thiểu.
- `APPROVED` không phải `ACTIVE`; tới `start_date` worker tạo `reservation_effects`, dừng tiêu thụ với session trong thời gian bảo lưu theo policy. Sau `end_date` hoặc duyệt kết thúc sớm, `RESUMED`; nếu cần xếp lớp mới tạo enrollment mới.
- Tác động đến chỉ số Active phải tuân metric dictionary (không ngầm tính bảo lưu là nghỉ ngang).

## 9. Dừng học: Nghỉ ngang / Tốt nghiệp

`student_exit_requests`: `DRAFT → SUBMITTED → AWAITING_MANAGER → APPROVED → SCHEDULED → EFFECTIVE`; nhánh `REJECTED/CANCELLED`.

- `exit_type`: `DROP_OUT` hoặc `GRADUATION`; cả hai bắt buộc QL xác nhận.
- Guard: `last_session_id` thuộc enrollment, đã hoặc sẽ là buổi cuối hợp lệ; chọn reason code phù hợp; không có transfer/bảo lưu conflict không xử lý.
- `effective_at` là mốc sau buổi học cuối, theo quy ước `[start,end)`; tới mốc mới đóng enrollment. Không tự động refund; số buổi, công nợ vẫn được giữ trong ledger.
- Student lifecycle tổng hợp không xóa lịch sử; có thể trở lại/renew về sau theo hồ sơ cũ.

## 10. Refund (rút phí)

`refund_requests`: `DRAFT → SUBMITTED → ACCOUNTING_REVIEW → MANAGER_REVIEW → APPROVED → AWAITING_DISBURSEMENT → PAID`; nhánh `CHANGES_REQUESTED`, `REJECTED`, `CANCELLED`, `PAYMENT_FAILED`.

- Calculation snapshot gồm các gói, thực đóng, số buổi tiêu thụ, còn lại, số tiền đủ điều kiện, các khoản khấu trừ.
- `APPROVED` không phát sinh trạng thái `PAID`. Chỉ KT có thẩm quyền `finance.refund.disburse` mới xác nhận đã chuyển tiền qua chứng từ/đối soát.
- Khi hoàn phí thành công: post financial journal, xử lý quyền học liên quan bằng ledger entries, audit + notification. Idempotency key ngăn double refund. Không cho refund > eligible paid balance.

## 11. Fee Transfer (chuyển phí)

`fee_transfer_requests`: `DRAFT → SUBMITTED → ACCOUNTING_REVIEW → MANAGER_REVIEW → APPROVED → READY_TO_EXECUTE → EXECUTED`; nhánh `REJECTED`, `CANCELLED`, `FAILED_RETRYABLE`.

- Chọn from_student, to_student và source grant, target product/grant; mode `AMOUNT` hoặc `LESSONS`; có calculation snapshot + policy version. Không chuyển vượt source, không mượn grant ở tenant khác.
- `EXECUTED` chỉ khi **một transaction duy nhất** đã ghi source debit, receiver credit, financial journal nếu có và `fee_transfer_executions` unique. Trường hợp conversion rate/rounding phải định nghĩa trước.
- Failure trước commit → không có bên nào được chuyển. Retry sau commit → no-op idempotent.

## 12. Happy Call / Monthly Report / Renewal

`monthly_reports`: `DRAFT → TEACHER_COMPLETED → REVIEWED → RELEASED`; có thể `REVISION_REQUESTED → DRAFT`. `RELEASED` lưu snapshot, version, file; sửa bằng phiên bản mới và log.

`happy_calls`: ghi **lịch sử tương tác** theo bản ghi, không nên state machine phức tạp. Task hậu gọi: `OPEN → IN_PROGRESS → RESOLVED/CANCELLED`, có due-date và owner.

`renewal_cases`: `NOT_STARTED → CONTACT_PENDING → CONTACTING → QUOTED → NEGOTIATING → WON/LOST`; nhánh `ON_HOLD`, `REOPENED`. Likelihood (HIGH/MEDIUM/LOW/UNKNOWN) là **một chiều dữ liệu khác**, có lịch sử event; không thay cho trạng thái. `WON` chỉ khi có renew contract đủ điều kiện (cần metric dictionary).

`renewal_meetings`: `DRAFT → IN_PROGRESS → CLOSED`. Mỗi item lưu assessment snapshot và task follow-up, không sửa kết quả họp cũ không có version.

## 13. Workflow engine (dùng chung)

`workflow_instances`: `CREATED → RUNNING → APPROVED/REJECTED/CANCELLED`; `workflow_approvals`: `PENDING → APPROVED/REJECTED/REQUEST_CHANGES/DELEGATED`. Khi một step `APPROVED`, workflow engine mở step sau theo `workflow_versions.steps_spec`; chỉ phê duyệt bởi membership được ủy quyền có hiệu lực. Workflow completed **không được trực tiếp tự thực thi nghiệp vụ** nếu chưa qua domain guard và transaction.

## 14. Test cases bắt buộc trước khi code

| ID | Tình huống | Expected |
|---|---|---|
| SM-01 | Lead từ Facebook check-in rồi ký hợp đồng | Một person/student, attribution nguồn ban đầu còn |
| SM-02 | Walk-in không có lead online | Tạo check-in & attribution walk-in hợp lệ |
| SM-03 | Trial không có quyền học | Bị từ chối xếp lớp |
| SM-04 | Quote 10%+5% cộng thẳng vs tuần tự | Ra giá đúng hai phương thức, giữ snapshot |
| SM-05 | Ghi nhận thanh toán lại cùng webhook | Chỉ một financial posting |
| SM-06 | Điểm danh buổi học hai lần | Không trừ lặp |
| SM-07 | Sửa vắng→có mặt đã chốt | Reverse/repost đúng, audit có before/after |
| SM-08 | 96 buổi, miễn 4 lần vắng đủ điều kiện | Lần thứ 5 trừ 1, không trừ 4 lần đầu |
| SM-09 | Sửa ngày học quá khứ làm đổi thứ tự 4 lần miễn | Recompute đúng allowance, không double ledger |
| SM-10 | Chuyển lớp scheduled trước khi buổi cuối kết thúc | Không chuyển sớm |
| SM-11 | Worker chạy lại chuyển lớp | Một new enrollment duy nhất |
| SM-12 | Chuyển khi lớp mới đã đủ sĩ số | Bị chặn hoặc exception approval |
| SM-13 | Bảo lưu đã duyệt nhưng chưa tới ngày | Chưa ACTIVE, không freeze sớm |
| SM-14 | Bảo lưu 4 buổi tại policy biên 4 | Phân loại theo policy version, không hard-code |
| SM-15 | Nghỉ ngang thiếu QL approve | Không hiệu lực |
| SM-16 | Tốt nghiệp có ngày cuối không thuộc lớp | Không hiệu lực |
| SM-17 | Refund đã duyệt nhưng KT chưa chuyển tiền | Không được PAID |
| SM-18 | Refund retry webhook/confirm | Không hoàn hai lần |
| SM-19 | Chuyển phí debit thành công nhưng credit fail | Toàn transaction rollback |
| SM-20 | Transfer từ tenant A sang B | Bị chặn ở API + DB |
| SM-21 | CSBH cũ đã publish rồi chỉnh giá | Tạo version mới; quote cũ bất biến |
| SM-22 | Report tháng phát hành rồi điểm sửa | Bản phát hành giữ snapshot, bản mới version |
| SM-23 | Renewal WON không có renew contract hợp lệ | Bị chặn |
| SM-24 | Hai manager cùng duyệt cùng step | optimistic lock, chỉ một transition thắng |

## 15. Mapping ERD & ADR còn mở

Mapping đến `lead_inquiries`, `lead_stage_events`, `test_attempts`, `quotes`, `contracts`, `receivables`, `payments`, `class_sessions`, `enrollments`, `class_transfer_requests`, `class_transfer_executions`, `attendance_records`, `attendance_revisions`, `entitlement_ledger_entries`, `reservation_requests`, `reservation_effects`, `student_exit_requests`, `refund_requests`, `refund_disbursements`, `fee_transfer_requests`, `fee_transfer_executions`, `monthly_reports`, `happy_calls`, `renewal_cases`, `renewal_case_events`, `workflow_instances`, `workflow_approvals`.

**ADR trước migration:** (1) ngày tính chuyển lớp ở timezone branch và xử lý buổi cuối hủy; (2) bảo lưu dưới/trên/đúng ngưỡng theo định mức buổi; (3) chính sách xếp lớp song song; (4) quyền học có phí/miễn phí/trial và công nợ; (5) điều kiện renewal WON và phân biệt LT2; (6) rule tính Active cho học sinh bảo lưu/trial; (7) reversal và cách phân bổ sổ quyền học theo nhiều package.