# ADR register – rà soát Permission Matrix v1.0 + State Machines v1.0

**Ngày:** 2026-11-06. **Quy tắc:** mục chưa được chốt không được tự giả định trong ứng dụng. `Core decision` có thể dùng ngay cho Stage 01; `Pending` cần duyệt trước khi module liên quan được thực thi.

| ID | Quyết định | Tình trạng | Tác động / thời điểm cần chốt |
|---|---|---|---|
| ADR-001 | Tenant độc lập; một user có thể thuộc nhiều tenant, quyền từ membership | Core decision | Stage 01; áp dụng |
| ADR-002 | Branch scopes theo thời gian, deny-by-default, SoD cho giao dịch tài chính | Core decision | Stage 01; áp dụng |
| ADR-003 | Platform admin không mặc định xem PII; support grant có hạn | Core decision | Stage 01; service support cần review riêng |
| ADR-004 | Quản lý cơ sở được duyệt báo giá tối đa bao nhiêu; ngưỡng vượt trần | Pending | Pricing/Quote stage |
| ADR-005 | Bảo lưu dưới/trên/đúng 4 buổi; GVCN có bắt buộc duyệt mọi trường hợp | Pending; cấu hình được | Student Operations |
| ADR-006 | Một người có nhiều chức danh; cách phối hợp role + scope, delegation | Pending; baseline union of permissions, scope per role | IAM authorization services |
| ADR-007 | Phụ huynh được xem lịch sử tài chính/rút phí đến đâu | Pending | Parent portal |
| ADR-008 | Xuất dữ liệu lớn/PII: hạn mức, dual approval, watermark | Pending | PII export |
| ADR-009 | Khi lớp cuối bị hủy/đổi, chuyển lớp theo mốc nào; xếp song song | Pending | Class Transfer |
| ADR-010 | Số buổi miễn phí và vắng loại nào được miễn, xử lý học bù | Configurable decision | Entitlements & Attendance |
| ADR-011 | Gói trial/miễn phí/có phí, công nợ có chặn xếp lớp hay không | Pending | Enrollments |
| ADR-012 | Metric Active cho Trial/Bảo lưu; định nghĩa Renew/LT2 WON | Pending | BI & Renewal |
| ADR-013 | Cách quy đổi giá trị học còn lại khi rút/chuyển phí; nhiều gói | Pending | Advanced Finance |
| ADR-014 | Reversal và phân bổ entitlement theo nhiều gói | Pending | Entitlement ledger |
| ADR-015 | SaaS plan/giới hạn/giá bán và thời gian retention tenant | Pending; schema flexible | Commercial launch |
| ADR-016 | Owner/migrator/runtime roles; OIDC provider, secrets & hosting | Technical choice requiring provisioning | Before DB deployment |

## Stage 01 defaults (technical, NOT business policy)
- RLS guards tenant boundary only. Application validates actual membership, role action, branch scope, and current validity.
- Time intervals use `[valid_from, valid_to)` with UTC timestamps (`timestamptz`); branch timezone matters only when converting local scheduling times.
- Role assignment time ranges cannot overlap for the same membership/role (and likewise branch scope). Adjacent ranges allowed.
- `tenant_settings` is versioned JSONB; approval/state machine settings not hard-coded into schema.
- Demo seed grants **only** branch-management permission to demo tenant admins to avoid implying a complete approved role matrix.

## Blocking decisions before production deployment
- Confirm auth provider identity claims, tenant switching and membership revalidation.
- Approve migration role/app role provisioning, credentials, backup/restore, incident recovery.
- Approve support impersonation workflow and global service access to tenants/platform_users.
- Approve exact permission grant templates, effective-time handling and segregation-of-duties enforcement.
