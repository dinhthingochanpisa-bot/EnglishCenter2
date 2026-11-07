# PERMISSION MATRIX v1.0 — LMS + CRM SaaS

**Baseline:** Master PRD v1.0 + ERD v1.0 (06/11/2026). **Trạng thái:** đề xuất để review và đóng băng trước khi code; không tự coi là quyết định chính sách đã được duyệt.

## 1. Mô hình cấp quyền

- Phân biệt **platform admin** (quản lý nền tảng SaaS) và **tenant admin** (quản trị tổ chức khách hàng). Không có quyền tự động xem dữ liệu trẻ em chỉ do là platform admin. Hỗ trợ truy cập cần `support_grants` có lý do, thời hạn, phê duyệt và log.
- Một `platform_user` có nhiều `tenant_memberships`; mỗi membership có roles + `membership_branch_scopes` theo ngày hiệu lực. Cấm chọn tenant bằng `tenant_id` do client gửi nếu không kiểm tra membership.
- Quyền thực thi = **tenant active + membership active + permission action + phạm vi dữ liệu + điều kiện trạng thái + separation of duties + subscription entitlement**. Mọi kiểm tra tại API/service; RLS là lớp phòng thủ thứ hai.
- Quyền đọc PII và tài chính độc lập với quyền đọc hồ sơ; masking phone/email mặc định ở danh sách nếu không có `pii.read_sensitive`.
- Nguyên tắc **deny by default**; không có permission => từ chối. Tránh vai trò “superuser” không giới hạn. Tenant admin vẫn bị ràng buộc bởi tenant.

## 2. Vai trò chuẩn (tenant có thể sao chép/tùy chỉnh)

| Mã | Vai trò | Phạm vi mặc định |
|---|---|---|
| `TENANT_ADMIN` | Chủ/Quản trị tổ chức | TENANT |
| `EXECUTIVE` | Quản lý cấp cao | TENANT |
| `BRANCH_MANAGER` | Quản lý cơ sở | ASSIGNED_BRANCHES |
| `MARKETING` | Marketing | ASSIGNED_BRANCHES + assigned campaigns |
| `SALES` | Tư vấn viên | OWNED_OR_ASSIGNED (hoặc Branch khi được cấp) |
| `CUSTOMER_SUCCESS` | CSKH/QLHV | ASSIGNED_STUDENTS/CLASSES, theo cơ sở |
| `ACADEMIC_MANAGER` | Quản lý học thuật | ASSIGNED_BRANCHES |
| `TEACHER` | Giáo viên/GVCN | ASSIGNED_CLASSES/SESSIONS |
| `ACCOUNTANT` | Kế toán | ASSIGNED_BRANCHES, các hợp đồng giao việc |
| `PARENT_STUDENT` | Phụ huynh/học sinh (portal về sau) | SELF/LINKED_STUDENTS |
| `PLATFORM_ADMIN` | Vận hành SaaS | PLATFORM metadata, không trực tiếp tenant PII |

**Phạm vi:** `SELF`, `OWNED_OR_ASSIGNED`, `ASSIGNED_STUDENTS`, `ASSIGNED_CLASSES`, `ASSIGNED_BRANCHES`, `TENANT`, `PLATFORM`; scope hợp nhất chỉ khi có rule rõ ràng. `TENANT` không vượt tenant.

## 3. Ký hiệu ma trận

`R` xem; `C` tạo; `U` sửa bản nháp; `S` trình; `A` duyệt; `X` thực thi/ghi sổ; `E` xuất/tải; `CFG` cấu hình; `-` mặc định không quyền. `*` yêu cầu guard theo scope/assignment/state, **không** mặc định quyền toàn tenant. Các biểu thức sau là baseline: tenant có thể tạo vai trò mới nhưng **không bỏ qua invariant bảo mật và SoD**.

## 4. Ma trận nhóm tài nguyên

| Tài nguyên / hành động | Tenant admin | Executive | Branch manager | MKT | Sales | CSKH | Academic manager | GV | KT | Parent |
|---|---|---|---|---|---|---|---|---|---|---|
| Tenant/branch/role settings | CFG | R | R/U* branch config | - | - | - | - | - | - | - |
| User/assignment | CFG | R/assign | R/assign* | R* | R* | R* | R* | R* | R* | - |
| Campaign/channel/attribution | R/CFG | R | R* | C/R/U* | R* | R* | - | - | R aggregated | - |
| Lead/QL & CRM activity | R | R | R* | C/R/U* | C/R/U* | R/U* | - | - | R restricted | - |
| Person/student/guardian | R/E* | R/E* | R/U* | R masked* | R/U* | R/U* | R* | R* | R limited* | R self |
| Check-in / QR intake | R | R | R | R* | C/R/U* | C/R/U* | - | - | - | C self, verify |
| Test/Trial & chuyên môn | R | R | R | - | R* | R* | C/R/A* | C/R/U* | - | R released |
| Product/pathway/package | CFG | CFG/approve | R/CFG* | R | R | R | R/CFG* | R | R/validate | R published |
| CSBH, voucher, pricing policy | CFG | CFG/A | Propose/CFG* within cap | R | R/apply | R | - | - | R/A finance* | R published |
| Quote | R | R/A* | R/A* | - | C/R/U/S* | C/R/U/S* | - | - | R/A finance* | R own issued |
| Contract | R | R/A* | R/A* | - | C/R/S* | R* | - | - | R/verify* | R own |
| Payment/receivable/debt | R/E | R/E | R* limited | Aggregated | R own* | R restricted* | - | - | C/R/U/X/E* | R own |
| Refund / fee transfer | R | R/A* | R/A* | - | C/S* per policy | C/S* | R* if relevant | - | R/A/X* | R own final |
| Class/schedule/teacher assignment | CFG/R | R | C/R/U* | - | R* | C/R/U* | C/R/U/A* | R* | R limited | R released |
| Enrollment/class transfer | R | R | R/A* | - | R* | C/R/S/X* per workflow | R/A* | R* | R financial effect* | R own |
| Attendance | R | R | R/override* | - | R* | R* | R/override* | C/R/U/confirm* | R count only | R own released |
| Entitlement ledger | R | R | R limited | - | R remaining* | R remaining* | R remaining* | R remaining* | R/X adjustments* | R own remaining |
| Reservation/stop/graduation | R | R | A* | - | R* | C/R/S* | A* for academic phase | R/A* if GVCN | A* reservation finance | R own approved |
| Homework/learning report | R | R | R | - | R summary* | C/R/E* | C/R/A* | C/R/U* | R fee segment | R released |
| Happy call / renewal | R | R | R/assign/A* | - | C/R/U* assigned | C/R/U* assigned | R academic | R summary* | R fee snapshot | R own published |
| BI metric & dashboard | CFG | R/E | R/E* | R marketing* | R own* | R caseload* | R academic* | R class* | R finance* | - |
| Integration credentials | CFG (restricted) | R status | R status | R status | - | - | - | - | R status | - |
| Audit logs | R restricted | R filtered | R branch filtered | - | - | - | R relevant | - | R finance events | - |

**Ghi chú:** `A` không phải phê duyệt mọi workflow; mỗi step lấy từ `workflow_versions`, điều kiện giá trị tiền, cơ sở, vai trò và SoD. Tenant admin không tự động được tự duyệt giao dịch của chính mình.

## 5. Danh mục permission codes tối thiểu

```text
platform.tenant.manage; platform.support_grant.request; platform.support_grant.approve
org.branch.manage; org.membership.manage; iam.role.manage; iam.permission.assign
crm.lead.read; crm.lead.create; crm.lead.update; crm.lead.assign; crm.checkin.create
crm.person.read; crm.person.update; pii.read_sensitive; pii.export
assessment.test.create; assessment.test.grade; assessment.test.release
assessment.trial.enroll; assessment.trial.report.write; assessment.trial.report.approve
catalog.product.manage; catalog.package.publish; catalog.pathway.manage
pricing.policy.draft; pricing.policy.approve; pricing.policy.publish; pricing.quote.create; pricing.quote.submit; pricing.quote.approve
sales.contract.create; sales.contract.sign; sales.contract.cancel
finance.receivable.read; finance.payment.record; finance.payment.confirm; finance.refund.submit; finance.refund.approve; finance.refund.disburse
finance.transfer.submit; finance.transfer.approve; finance.transfer.execute; finance.ledger.adjust
academic.class.manage; academic.schedule.manage; academic.teacher.assign; academic.enrollment.manage
academic.attendance.write; academic.attendance.confirm; academic.attendance.override
academic.entitlement.read; academic.entitlement.adjust
academic.reservation.submit; academic.reservation.approve_academic; academic.reservation.approve_finance; academic.reservation.approve_manager
academic.exit.submit; academic.exit.approve; academic.class_transfer.submit; academic.class_transfer.execute
lms.assignment.manage; lms.assessment.grade; lms.monthly_report.approve; lms.monthly_report.release
cskh.happy_call.write; cskh.renewal.manage; cskh.renewal_meeting.manage
workflow.instance.read; workflow.step.act; workflow.definition.manage
bi.dashboard.read; bi.metric.manage; bi.export; audit.read; integration.manage
```

## 6. Approval matrix + Separation of Duties (SoD)

| Nghiệp vụ | Người đề nghị | Bước phê duyệt (baseline) | Execute/finalize | Guard bắt buộc |
|---|---|---|---|---|
| Báo giá | Sales/CSKH | KT kiểm tra giá; QL nếu vượt ngưỡng/ngoại lệ | Quote service phát hành | Không sửa quote version đã duyệt |
| Chính sách bán hàng | QL/Executive | Cấp có quyền publish; KT review cấu phần giá | Publish version | Không sửa version đã áp dụng |
| Bảo lưu | CSKH | GVCN → KT → QL | Operations service theo ngày hiệu lực | Người đề nghị không tự duyệt tất cả bước |
| Dừng học | CSKH | QL xác nhận | Operations service sau buổi cuối | Cần `last_session_id`; không tự hoàn phí |
| Chuyển lớp | CSKH | QL tùy chính sách, hoặc auto nếu đủ guard | Scheduler/execution worker | Không tạo 2 enrollment xung đột |
| Rút phí | CSKH/Sales | KT kiểm tra → QL duyệt | KT xác nhận đã thanh toán | Approve ≠ Paid; chứng từ và idempotency |
| Chuyển phí | CSKH/Sales | KT → QL | Finance/entitlement service atomic | Ghi hai phía đồng thời, không chuyển vượt |
| Sửa điểm danh đã chốt | GV đề nghị | Academic manager/QL tùy mức | Attendance service reverse/repost | Có lý do và revision |
| Điều chỉnh số buổi thủ công | CSKH/KT đề nghị | KT + QL tùy mục đích | Entitlement service | Không sửa ledger cũ trực tiếp |

**SoD tối thiểu:** người tạo/đề nghị không được một mình tự xác nhận toàn bộ giao dịch tiền; `finance.payment.confirm` và `finance.refund.disburse` cần bằng chứng; các bước duyệt phải được lưu actor thực tế, không chỉ role. Workflow policy xác định khi nào được ủy quyền, không cho impersonation.

## 7. Hành động theo màn hình (Contextual Actions)

- Danh sách lớp → chuyển lớp / bảo lưu / nghỉ ngang / tốt nghiệp. UI chỉ render nếu có permission; backend vẫn bắt buộc kiểm đầy đủ.
- Student 360 → báo giá, hợp đồng, thu phí, rút/chuyển phí, Happy Call, Renewal. Mỗi modal giữ ID đối tượng nguồn và refresh lại data sau commit.
- Lịch dạy → điểm danh theo `class_sessions`. Chỉ GV được phân công ở buổi đó (hoặc người có override) mới được xác nhận.
- Báo cáo tháng → giáo viên viết đánh giá; CSKH/QLHV phát hành sau bước review; số liệu tài chính chỉ read from Finance.
- Họp Renewal → QL update assessment, tạo task, phân công người phụ trách; thay đổi ghi event về Student 360.

## 8. Security & API acceptance tests

1. Token tenant A gửi `tenant_id=B` → 403/404; không thông tin tồn tại khác tenant.
2. Tenant A dùng ID class/student/contract thuộc B trong payload → bị chặn cả ở API và composite FK.
3. Membership chỉ có branch A không xem được student branch B; truy cập theo `OWNED` khi được giao vẫn phải có chính sách scope rõ.
4. Teacher lớp X không sửa điểm danh lớp Y; GV cũ hết ngày phân công không sửa session mới.
5. Sales không đổi CSBH đã publish, không tự xác nhận thanh toán.
6. KT không tự xác nhận giao dịch hoàn tiền do chính mình tạo và duyệt toàn bộ, nếu SoD đang áp dụng.
7. Parent chỉ đọc linked students có hiệu lực; không tải report của trẻ khác bằng URL đoán.
8. Support grant hết hạn hoặc bị revoke → ngay lập tức ngừng truy cập; đầy đủ audit.
9. Export PII phải có permission riêng và được audit, có masking theo cột.
10. RLS phải test với non-owner application DB role, connection pool và tenant context reset; deny nếu tenant context thiếu.

## 9. Mapping ERD và quyết định còn mở

Map sang `roles`, `permissions`, `role_permissions`, `membership_roles`, `membership_branch_scopes`, `tenant_memberships`, `support_grants`, `workflow_definitions`, `workflow_versions`, `workflow_instances`, `workflow_approvals`, `audit_logs` (ERD v1.0).

**ADR cần chốt:** (a) QL cơ sở có được duyệt báo giá trong giới hạn nào; (b) GVCN bắt buộc duyệt mọi bảo lưu hay chỉ gói chính thức; (c) cách phân quyền một người đồng thời giữ nhiều chức danh; (d) mức độ phụ huynh được xem tài chính và tình trạng rút phí; (e) xuất dữ liệu số lượng lớn, giới hạn và xác nhận.
