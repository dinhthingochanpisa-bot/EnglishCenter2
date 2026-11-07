# Hướng dẫn dành cho người dùng (không cần lập trình)

## Cài bộ tài liệu bàn giao
1. Giải nén `LumaOS_Codex_Handoff_v1.zip`.
2. Mở thư mục `workspace` hiện có (chứa `backend`, `frontend`, `infra`, `verification`).
3. Sao chép **AGENTS.md** và **CODEX_START_HERE.md** từ ZIP vào `workspace`.
4. Sao chép cả thư mục **docs/codex** vào `workspace/docs` (không ghi đè file `docs/API_STAGE02.md` cũ).
5. Mở `workspace` trong VS Code/Codex. Không mở nhầm thư mục chứa ZIP hoặc thư mục `frontend` đơn lẻ.
6. Mở `docs/codex/CODEX_FIRST_PROMPT.md`, copy đoạn prompt và gửi Codex.

## Việc Codex nên làm trước
- Kiểm tra source và log hiện có; không xóa dữ liệu demo.
- Sửa và kiểm tra lỗi **form mất focus khi gõ**.
- Củng cố script kiểm thử và bảo mật. Chỉ sau khi Stage 02 ổn định mới bắt đầu Stage 03.

## Cảnh báo
- Không chia sẻ file `infra/.env.test` và các `.env*`, mật khẩu, token, cookie cho người khác.
- Nếu Codex xin chạy lệnh xóa dữ liệu/volume, yêu cầu nó giải thích tác động trước.
- Khi Codex sửa xong, yêu cầu nó báo: file đã sửa, kết quả test, lỗi còn lại, thao tác bạn cần làm tiếp.
