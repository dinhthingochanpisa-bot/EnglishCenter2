# LumaOS — BẮT ĐẦU VỚI CODEX

Đây là **bộ tài liệu bàn giao**, không phải bộ mã nguồn mới. Mã nguồn đang ở thư mục `workspace` mà người dùng đã giải nén và chạy trên máy Windows/Ubuntu WSL2. Đặt `AGENTS.md` tại **gốc workspace**, và thư mục `docs/codex/` vào `workspace/docs/codex/`.

## Thứ tự đọc cho Codex
1. `AGENTS.md` — quy tắc bắt buộc.
2. `docs/codex/HANDOFF_STATUS.md` — tình trạng thật, điều gì đã/chưa được nghiệm thu.
3. `docs/codex/PRODUCT_AND_WORKFLOWS.md` — sản phẩm và nghiệp vụ đã chốt.
4. `docs/codex/ARCHITECTURE_AND_CODEMAP.md` — stack, bảng, module, đường dẫn file.
5. `docs/codex/NEXT_TASKS.md` — backlog có thứ tự và Definition of Done.
6. `docs/codex/TEST_RUNBOOK.md` — lệnh kiểm thử, cách tránh port conflict.
7. `docs/codex/SECURITY_AND_DATA.md` và `docs/codex/OPEN_DECISIONS.md`.
8. Nếu cần chi tiết tương lai: `docs/codex/reference/` (snapshot PRD/ERD/roles/states từ giai đoạn thiết kế; **không được coi mọi bảng đã triển khai**).

## Việc đầu tiên giao Codex
Dán nguyên prompt trong `docs/codex/CODEX_FIRST_PROMPT.md` vào Codex khi mở đúng workspace.

## Cách đặt tài liệu vào project
- Giải nén ZIP tài liệu **vào thư mục `workspace`** (nơi có `backend`, `frontend`, `infra`, `verification`).
- Không ghi đè các thư mục mã nguồn. Gói chỉ thêm `AGENTS.md`, `CODEX_START_HERE.md`, `docs/codex/`.
- Nếu đang sử dụng VS Code: **File → Open Folder → chọn `workspace`**, không mở riêng `frontend` hay `backend`. Chọn WSL nếu thao tác trên Ubuntu.
- Nếu dùng Codex từ CLI/IDE, cho Codex quyền đọc thư mục repository và nhắc nó **đọc AGENTS.md trước**, sau đó đề xuất plan trước khi sửa.

## Cảnh báo
- Không gửi `.env.test`, cookie, token, private keys cho Codex qua chat công khai hoặc commit git.
- Bản ZIP này có các **reference specs** ở dạng Markdown và không chứa mật khẩu, dữ liệu học sinh thật.
- Giữ thay đổi local đã thực hiện (kể cả bản vá form focus) và backup trước khi Codex đồng bộ/clean git.