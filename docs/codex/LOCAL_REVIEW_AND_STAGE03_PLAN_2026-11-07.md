# LumaOS — Báo cáo đối chiếu mã nguồn và kế hoạch trước Stage 03

**Ngày:** 2026-11-07, Asia/Bangkok.  
**Repository:** https://github.com/dinhthingochanpisa-bot/EnglishCenter2  
**Baseline tài liệu:** commit `3b89c9e77c99236254a41f6c04d1b9a62aa3312e`.  
**Kết luận:** Stage 01–02 có nền tảng hoạt động, nhưng chưa đủ bằng chứng nghiệm thu để mở Stage 03 hoặc triển khai production.

## 1. Phạm vi và nguyên tắc đối chiếu

Đã đọc `AGENTS.md`, `CODEX_START_HERE.md` và toàn bộ 17 tệp trong `docs/codex/` tại baseline, bao gồm 6 tài liệu reference. Bộ này là tài liệu bàn giao chính thức của dự án; khi khác biệt với mã nguồn/test, ghi nhận cụ thể, không mặc định một bên luôn đúng.

Repository tại baseline chỉ chứa tài liệu bàn giao và README ban đầu; mã nguồn ứng dụng nằm trong workspace trên máy Windows. Workspace chưa có `.git` và lệnh Git chưa có trong PATH, nên không thể cung cấp `git status`/`git diff` của các thay đổi chưa commit. Không coi đây là checkout đã đồng bộ.

Lượt đánh giá chỉ đọc mã nguồn, log và chạy kiểm tra không ghi dữ liệu nghiệp vụ. Các bản vá focus, đường dẫn TypeScript và các tệp kiểm thử hiện có được giữ nguyên. Khi chuẩn bị xuất bản theo yêu cầu người dùng, bổ sung tài liệu chính thức vào các đường dẫn chưa tồn tại, thêm báo cáo này và củng cố `.gitignore`; không thay thế mã nguồn bằng bản ZIP hay bản cũ trên remote.

## 2. Kiến trúc hiện tại

```text
Trình duyệt
  → Next.js 16 / React 19 / TypeScript
  → BFF /api/backend/... cùng origin, phiên HttpOnly
  → NestJS REST API /v1/...
  → OIDC actor + membership + permission + branch/object scope
  → Prisma 6 transaction theo tenant
  → PostgreSQL 16: RLS/FORCE RLS + composite tenant FK + audit

Keycloak 26.8.1: browser Authorization Code + PKCE
Docker Compose: PostgreSQL và Keycloak local demo
```

- Backend là modular monolith; chưa cần tách microservices.
- Frontend chỉ gọi backend được phân quyền, không dùng Prisma/PostgreSQL trực tiếp.
- `backend/src/auth.ts` xác minh JWT; `authorization.ts` kiểm tra membership/role/scope; `prisma.service.ts` đặt tenant context trong transaction và dùng các kết nối DB theo vai trò.
- `tenant.service.ts` xử lý SaaS Core; `crm.service.ts` xử lý nghiệp vụ Person/Lead/Check-in/Customer 360.
- Mã nguồn có 28 Prisma models: 14 SaaS Core + 14 CRM, với 4 migrations hiện có.
- ERD reference gồm 136 bảng thuộc 11 domain là thiết kế đích, không phải 136 bảng đã được triển khai.
- Person/Customer/Student 360 phải giữ định danh xuyên suốt. `CUSTOMER` hiện nghĩa là đã đến điểm bán; không đồng nghĩa học sinh đã trả phí/Active.
- Chính sách tenant/branch phải cấu hình được, có phiên bản và thời gian hiệu lực. Finance ledger và entitlement ledger là hai khái niệm riêng trong các stage tương lai.

## 3. Trạng thái Stage 01–02 và bằng chứng

| Phần | Đã có / bằng chứng | Giới hạn |
|---|---|---|
| Stage 01 SaaS Core | Tenant, branch, user/membership, RBAC, audit, subscription và tenant isolation foundation | Không đồng nghĩa mọi yêu cầu SaaS thương mại/support/billing đã hoàn tất |
| Stage 02 CRM | Person Master, nguồn/campaign, Lead/QL, chăm sóc, Check-in, Customer 360, QR feature gate | Chưa nghiệm thu toàn bộ browser UAT và 20 tình huống acceptance |
| Kiểm tra chạy lại khi đánh giá | Static 15/15; isolated logic 9/9; Stage 02 kiểm tra syntax/schema/rules PASS | Không thay thế DB/API/browser E2E |
| Dịch vụ lúc đánh giá | Backend health, frontend và OIDC discovery đều HTTP 200 | HTTP 200 không chứng minh đang chạy chính xác source revision hay toàn bộ nghiệp vụ |
| Log của lượt kiểm thử trước trong phiên làm việc | API 53/53; OIDC HTTP 13 assertions; 6 unit test; backend typecheck/build; frontend typecheck PASS | API chạy trên stack demo đang có; không phải clean-install replay hay visual browser QA |
| Handoff từ máy người dùng/WSL | Runner từng báo PostgreSQL/Prisma/RBAC/RLS và frontend build PASS; Chrome đăng nhập và mở Lead list | Cần giữ log tương ứng và tái lập trước sign-off cuối cùng |
| Môi trường Codex Windows | Frontend build/Prisma validate bị thiếu binary Windows, tải binary bị chặn; Docker/WSL bị từ chối truy cập | Đây là blocker môi trường, không phủ định kết quả WSL đã ghi nhận |

Các lệnh chỉ đọc vừa chạy lại:

```text
node verification/verify_static.mjs
node verification/verify_logic.mjs
node verification/verify_stage02.mjs
```

Log local đã có ở `verification/artifacts/stage3-gate/summary.json`, `live-summary.json`, `api-e2e.log`, `oidc-http.log` và `unit-tests.log`. Thư mục artifacts chứa bằng chứng local, không đưa nguyên log runtime vào Git để tránh lộ thông tin ngoài dự kiến. Báo cáo đã làm sạch nằm trong tài liệu này và `verification/STAGE3_READINESS_2026-11-07.md`.

## 4. Lỗi còn tồn tại và khác biệt giữa tài liệu với local

| ID / ưu tiên | Hiện trạng đối chiếu | Việc còn làm và tiêu chí đạt |
|---|---|---|
| BUG-UI-001 / P0 | `frontend/components/ui.tsx` đã có patch: effect chạy một lần, `onCloseRef`, ưu tiên control trong modal body. Chưa có bằng chứng browser xác nhận hết lỗi; chưa thấy xử lý giữ Tab trong dialog | Giữ bản vá, kiểm tra gõ ≥20 ký tự ở từng field, Tab/Shift+Tab, Esc, click ngoài, trả focus về launcher; không mất input khi render lại |
| QA-001 / P0 | `verification/verify_stage02.mjs` đã dùng `createRequire` và TypeScript backend-local; không còn phụ thuộc đường dẫn NVM cố định | Xác minh Node 22/WSL, đường dẫn Unicode/khoảng trắng và thông báo rõ khi thiếu dependency; không sửa lại phần đã đúng |
| QA-002 / P0 | Runner vẫn khởi chạy backend/frontend mà chưa kiểm tra port/ownership; probe có thể trúng service cũ | Kiểm tra port, PID, readiness và tương thích; dừng rõ hoặc reuse có xác minh; chỉ cleanup tiến trình runner sở hữu; test fresh-run và services-already-running |
| QA-003 / P1 | `verification/generate_dev_realm.py` có `emailVerified` nhưng không có email; realm hiện tại từng được chỉnh tay | Thêm email synthetic, giữ stable subject và non-temporary credentials; chứng minh fresh disposable realm login được không cần chỉnh GUI; không reset realm hiện tại |
| QA-004 / P1 | HTTP Code+PKCE callback đạt, browser regression toàn luồng chưa có | Kiểm thử UI thật: login, Lead/QL, care, Check-in, Customer 360, keyboard, hết phiên, lỗi API và branch permissions |
| SEC-001 / P1 | Handoff ghi nhận lịch sử 14 dependency vulnerabilities; chưa có audit mới. Hai lockfile local đã tồn tại, root dependency declarations khớp package.json | Audit backend/frontend, triage từng advisory, nâng cấp tương thích, kiểm thử lại; không `npm audit fix --force` |
| CI / P1 | `.github/workflows/ci.yml` vẫn dùng `npm install`; chưa có CRM seed/RLS smoke riêng, OIDC và browser regression | Cài đặt tái lập từ lockfile, bổ sung Stage 02 seed/security checks và E2E phù hợp; chạy CI thành công sau xuất bản |
| QA-UX / P1 | Chưa nghiệm thu đầy đủ error UX/contextual flow | Form giữ input khi 401/403/409 hoặc API chậm, không báo thành công giả, chống submit lặp |
| PROD-001 | Public QR đang tắt theo yêu cầu | Giữ `PUBLIC_INTAKE_ENABLED=false` đến khi consent/retention/rate-limit/anti-abuse và acceptance được hoàn tất |

Không dùng tổng số assertion API như bằng chứng toàn bộ acceptance matrix đã đạt. Còn cần concurrency Check-in, branch/object scope, role revoke/suspension, audit isolation và source attribution, cùng các trường hợp QR-enabled chỉ trong môi trường thử nghiệm phù hợp.

## 5. Kế hoạch trước Stage 03

### Bước 1 — Baseline và bảo toàn local

Đưa source và bộ handoff vào cùng một baseline Git có thể review; giữ lịch sử remote. Không ghi secrets, generated realm, node_modules, build, cache hoặc archive backup. Giữ tất cả bản vá local đã xác nhận. Chưa reset DB/volume hoặc dừng process không rõ ownership.

### Bước 2 — Đóng P0

Nghiệm thu Modal bằng browser và keyboard; xác nhận QA-001 đã đạt thay vì làm lại; sửa runner/port lifecycle tối thiểu. File tác động dự kiến: `frontend/components/ui.tsx`, có thể `crm-console.tsx`, `verification/verify_stage02.mjs`, `verification/run_local_full_e2e.sh` và các test liên quan.

### Bước 3 — Tái lập môi trường test

Sửa generator Keycloak profile; thống nhất runtime/dependency theo môi trường Windows hoặc WSL, không dùng chung native dependency tree Linux/Windows. Chạy build, migration, seed synthetic và RLS/FK tests trên môi trường thử nghiệm riêng; không tự xóa realm/volume đang dùng. File chính: generator, Compose/runbook, lockfiles và runner.

### Bước 4 — Hồi quy, bảo mật và CI

Chạy API suite mở rộng, SQL isolation tests bằng runtime role, browser UAT và concurrency/branch/revocation tests. Review audit dependency hiện tại, upgrade có chọn lọc, dùng cài đặt tái lập và hoàn thiện CI. Chỉ đánh dấu PASS theo command/output/môi trường thực tế; giữ riêng static, unit, integration, API E2E và browser E2E.

### Bước 5 — Thiết kế rồi mới triển khai Stage 03

- Tạo PRD, wireframe, calculation examples và ADR được chốt cho Product/Program/Package/Pathway có version/effective dates.
- Pricing/CSBH phải xác định additive hay sequential discounts, voucher trước/sau phần trăm, stacking, cap, rounding, thời điểm giữ giá và ngoại lệ.
- Quote lưu policy version, snapshot và calculation trace; bản đã duyệt/phát hành không tự đổi khi CSBH đổi.
- Workflow kế toán review và thẩm quyền quản lý cần rõ ràng, không tự duyệt toàn bộ giao dịch của mình.
- Golden tests gồm 30 triệu, CK 10% + 5%: additive = 25,5 triệu; sequential = 25,65 triệu trước voucher; thêm voucher ordering, cap, overlap và version freeze.
- Migrations mới phải có composite tenant FK/RLS và negative tenant/branch tests. Contract/payment triển khai ở stage tiếp theo, không rút gọn vào một trạng thái CRM.

## 6. Mâu thuẫn nghiệp vụ cần lưu ADR

Reference `State_Machines_v1.md` gắn Lead `CONVERTED` với hợp đồng có hiệu lực. Stage 02 hiện tại và tài liệu hợp nhất gắn `CONVERTED` với Check-in hoàn tất. Giữ hành vi Stage 02 đang được kiểm thử; trước khi thêm hợp đồng cần ADR và mapping conversion events rõ ràng, không tự đổi enum hay diễn giải lại lịch sử.

Historical PRD cũng đề cập CSV import ở Stage 02, nhưng baseline triển khai hiện tại chưa có import workflow tương ứng. Cần xác nhận đây là backlog/gap phạm vi, không báo chức năng đã tồn tại chỉ vì có trong reference.

## 7. Điều kiện mở Stage 03

1. Các P0 được đóng bằng bằng chứng, đặc biệt focus/keyboard và runner lifecycle.
2. Build/typecheck/unit, fresh test realm, migrations và RLS/FK integration tái lập được.
3. API và browser regression đạt; các acceptance còn thiếu được kiểm thử hoặc ghi rõ quyết định phạm vi.
4. Dependency audit/security blockers được review; QR public tiếp tục tắt.
5. ADR pricing/quote cần thiết đã được chốt; Stage 03 bắt đầu bằng một vertical slice có schema/API/UI/test rõ ràng.

**Hiện tại: chưa mở Stage 03, chưa production-ready, không dùng dữ liệu trẻ em thật.**

## 8. Tác động xuất bản và rollback

Trong lúc chuẩn bị xuất bản, remote có thêm các đặc tả Stage 03/04 trong `docs/engineering-v2/stages/`, tại commit `3f322e9042a7dfd32615637c806434cea69f60d6`. Các tài liệu mới được giữ nguyên và bổ sung vào local; commit mã nguồn được đặt sau lịch sử mới thay vì ghi đè nhánh. Sự hiện diện của đặc tả không có nghĩa Stage 03/04 đã được triển khai hoặc nghiệm thu; báo cáo đối chiếu ở trên vẫn ghi rõ baseline tài liệu đã đánh giá.

Lần xuất bản này đưa mã nguồn hiện có, bản vá local và tài liệu lên repository; không tuyên bố các lỗi trong backlog đã được sửa. Commit có thể kích hoạt CI hiện có, nhưng không có bước deploy production. Khi cần rollback, tạo commit revert các thay đổi xuất bản, giữ lịch sử và không reset dữ liệu hoặc force-push nhánh.
