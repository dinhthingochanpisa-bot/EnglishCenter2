# Codex first task — Engineering Specification v2.0

**Copy the Vietnamese prompt below into Codex in the actual LumaOS workspace.**

---

Bạn đang tiếp quản dự án **LumaOS – LMS + CRM SaaS đa tổ chức**. Mã nguồn hiện ở thư mục workspace trên máy tôi; tài liệu nền tảng ở repository GitHub dinhthingochanpisa-bot/EnglishCenter2.

**Bắt buộc đọc:**
1. AGENTS.md và CODEX_START_HERE.md.
2. docs/codex/HANDOFF_STATUS.md, PRODUCT_AND_WORKFLOWS.md, ARCHITECTURE_AND_CODEMAP.md.
3. docs/engineering-v2/README.md và toàn bộ 8 tài liệu nền tảng.
4. docs/engineering-v2/stages/STAGE_03_PRODUCT_PRICING_QUOTE.md đến STAGE_09_INTEGRATIONS_PORTAL_SAAS_OPERATIONS.md.
5. docs/codex/reference/* (Master PRD, ERD, Permission Matrix, State Machines, ADR).

**Yêu cầu trước khi lập trình:**
- Kiểm tra thực tế mã nguồn ở backend, frontend, infra, verification. Không viết lại Stage 01–02; không suy luận tài liệu là tính năng đã triển khai.
- Kiểm tra và xử lý bug form Lead mất focus sang nút X, củng cố runner kiểm thử và fresh Keycloak demo, thực hiện UAT Stage 02 trước khi bắt đầu Stage 03.
- Đối chiếu đặc tả v2.0 với Prisma schema/API hiện tại; lập bảng thay đổi và rủi ro, danh sách quyết định nghiệp vụ đang mở. Những quyết định chưa chốt phải được đánh dấu BLOCKED/ADR chứ không tự mặc định.
- **Không thực hiện lệnh xóa DB/volume, reset migration, force push hoặc commit secrets**. Chỉ dùng demo data giả lập.

**Kế hoạch Stage 03:**
1. Trích xuất user stories/Acceptance Criteria của Catalog, Packages, Pathways, CSBH/Pricing Engine, Quote/Approval.
2. Tạo thiết kế schema + tenant FK/RLS, dự thảo OpenAPI 3.1 và UI flow tương thích với app.
3. Viết golden fixtures test cho CK additive/sequential, voucher trước/sau, cap, effective windows, New/Renew, row version và cross-tenant.
4. Trình tôi phê duyệt ADR pricing còn mở trước khi đưa quy tắc không thể đảo ngược vào production code.
5. Sau khi tôi chấp thuận, triển khai lát cắt nhỏ Product/Package trước, có kiểm thử DB/API/browser và PR.

**Báo cáo tôi theo cấu trúc:**
- Hiện trạng repository/source và kết quả test thật (PASS/FAIL/BLOCKED).
- Những hạng mục v2.0 đã rõ, những điểm cần chủ sản phẩm quyết định.
- Danh sách file/API/Prisma dự kiến thay đổi, migration và kế hoạch rollback.
- Lộ trình từng lát cắt có Definition of Done và kết quả kiểm thử.
- Những gì bạn không thể chạy hoặc xác minh phải nêu rõ, tuyệt đối không báo đã hoàn thành khi chưa chạy thử.

Mọi API phải được backend phân quyền và mọi tenant data phải được cô lập cả tại service lẫn PostgreSQL RLS. Mọi tác động phí/buổi học cần trace/ledger không thể sửa lịch sử trực tiếp.

---

**Notes for Codex:** User runs Windows + WSL/Ubuntu and Docker; original Stage 01/02 source is local, GitHub docs may exist without code. Never overwrite local source by cloning docs-only repo on top of working directory. Fetch and merge docs safely first.
