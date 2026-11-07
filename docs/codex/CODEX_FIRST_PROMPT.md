# Prompt đầu tiên gửi cho Codex

> Copy nguyên nội dung bên dưới sau khi mở **đúng thư mục `workspace`** trong Codex. Bắt đầu bằng đánh giá và plan, không vội triển khai Stage 03.

```text
Bạn đang tiếp quản dự án LumaOS — LMS + CRM + Finance + BI SaaS multi-tenant cho trung tâm ngoại ngữ. Đây là repository đang chạy thật trên máy Windows/Ubuntu WSL2 của tôi; không tạo project mới.

Hãy đọc theo thứ tự: AGENTS.md, CODEX_START_HERE.md, docs/codex/HANDOFF_STATUS.md, PRODUCT_AND_WORKFLOWS.md, ARCHITECTURE_AND_CODEMAP.md, NEXT_TASKS.md, TEST_RUNBOOK.md, SECURITY_AND_DATA.md và các reference có liên quan.

Trước bất cứ thay đổi nào:
1) Kiểm tra `pwd`, `git status --short`, các tiến trình/port, cấu trúc repo; không làm mất code local, .env hoặc dữ liệu demo.
2) Phân biệt đã triển khai (Stage 01/02) với mới thiết kế (Stage 03–09). KHÔNG nói đã sản xuất xong toàn hệ thống.
3) Tóm tắt kiến trúc đang có, tình trạng kiểm thử từ tài liệu và xác minh bằng code/test phù hợp.
4) Cho tôi plan theo thứ tự ưu tiên, acceptance criteria, impacted files, rủi ro; thực hiện từng việc có kiểm thử.

Nhiệm vụ đầu tiên: Stabilize Stage 02, ưu tiên lỗi focus trong New Lead modal: cứ nhập 1 ký tự ở họ tên/người liên hệ/SĐT thì focus nhảy sang nút X. Kiểm tra xem bản vá trong frontend/components/ui.tsx đã được áp dụng chưa; nếu chưa, sửa tối thiểu và thêm test hồi quy browser/keyboard. Kế tiếp sửa đường dẫn TypeScript hard-code trong verification/verify_stage02.mjs và kịch bản start backend khi port 3001/3000 đã có server chạy.

Bằng chứng đã có: trên máy tôi PostgreSQL/Prisma/RBAC/RLS và frontend build báo PASS; Nest health HTTP 200; 46 check E2E API/tenant isolation/CRM báo PASS; Chrome đã đăng nhập Keycloak và mở Lead & QL; BUG focus trên browser vẫn cần xác nhận đã sửa. demo-a/demo-b từng phải thêm email trong Keycloak thì OIDC mới PASS. Đây chỉ là local demo, chưa production.

Luật bất biến: tenant isolation/RLS/RBAC thực thi backend; frontend chỉ gọi API được phân quyền; không xóa/merge hồ sơ tùy tiện; không hard-code chính sách; không dùng dữ liệu học sinh thật; không đưa mật khẩu/token lên log/git; không chạy lệnh xóa volume/reset DB khi chưa được phép.

Hãy bắt đầu bằng việc nêu kết quả kiểm tra repository và kế hoạch ngắn; sau đó làm T-001 và T-002 trước, cung cấp diff và các test command/output thực tế. Nếu không thể chạy browser test, nói rõ và đưa cách xác nhận thủ công.
```
