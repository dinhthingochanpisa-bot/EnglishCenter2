# LumaOS — Báo cáo tổng hợp Stage 02

Cập nhật: **2026-11-08, Asia/Bangkok**. Repository: [EnglishCenter2](https://github.com/dinhthingochanpisa-bot/EnglishCenter2). Nhánh làm việc: `fix/stage02-stabilization-gate`; [PR #1](https://github.com/dinhthingochanpisa-bot/EnglishCenter2/pull/1) vẫn Draft.

Đây là báo cáo chính hợp nhất 11 báo cáo Stage 01–02/Stage 02 và kết quả kiểm thử liên quan. Các báo cáo gốc được giữ làm lịch sử; khi trạng thái cũ khác kết quả mới, dùng thời điểm, nguồn chạy và fingerprint dưới đây để đối chiếu.

## 1. Kết luận hiện tại

**Các kiểm tra Stage 02 đã chạy đều đạt sau sửa lỗi, bao gồm browser thật và cách ly tenant. Chưa có nghiệm thu G3 của chủ sản phẩm; chưa được duyệt production hoặc mở Stage 03.**

| Hạng mục | Kết quả đã có | Giới hạn |
|---|---|---|
| Browser Chrome đầy đủ | **25/25 PASS**, exit 0 trên source khớp fingerprint | Không thay thế nghiệm thu sản phẩm; chưa kiểm tra IME hệ điều hành hoặc fixture UI nhiều membership |
| Direct Playwright MCP | PASS nhập/lưu ngày giờ, xác thực lại khi còn SSO, đổi demo-a→demo-b, Tenant B bị chặn A bằng 403 | Phân biệt với CI Chrome và HTTP OIDC |
| Unit backend | **6/6 PASS** | Bộ unit hiện có |
| Regression service/auth/lifecycle/login | **22/22 PASS** | Là kiểm thử độc lập, không cộng dồn thành số ca nghiệm thu sản phẩm |
| Static / isolated logic | **15/15**, **9/9 PASS**; Stage 02 schema/rules PASS | Static không chứng minh runtime |
| API chính / API mở rộng | **80 / 45 PASS** | Chạy trên stack demo đang có; thêm dữ liệu synthetic |
| API quyền branch/assignment | **9 PASS** bằng token người dùng hạn chế quyền | Không dùng token admin thay cho kiểm tra hạn chế quyền |
| OIDC HTTP mới nhất | **14 assertions PASS**; dòng tổng kết không tính thêm | Có callback, PKCE, HttpOnly và yêu cầu xác thực lại; không phải browser UI |
| SQL trực tiếp | **5 nhóm PASS**: RLS, grants/audit, composite FK và trigger CRM | Không replay migration từ DB trống trong lượt local này |
| Build/typecheck | Backend và frontend PASS trong các lượt sửa tương ứng | Không thay bằng nhận định từ HTTP 200 |
| Audit dependency local gần nhất | Backend **0 high, 0 critical, 6 moderate**; frontend **0 findings** | PASS ngưỡng high/critical không phải hết lỗ hổng |
| Public QR | Giữ **`PUBLIC_INTAKE_ENABLED=false`**, API tạo link và submit công khai trả 503 | CRM-11–13 cho luồng QR bật còn BLOCKED |

Các kết quả trên là bằng chứng của những lượt chạy đã ghi nhận, không phải tuyên bố vừa chạy lại mọi bộ test trong lúc biên tập báo cáo này.

## 2. Phạm vi đã triển khai

- Nền SaaS Core: tenant, branch, identity/membership, RBAC, scope, audit và nền tảng tenant isolation.
- CRM: Person Master, Source/Campaign, Lead/QL, phân công, chăm sóc/hẹn tiếp, Check-in, Walk-in, Customer 360, lịch sử nguồn/sự kiện và cổng tính năng QR.
- Định danh Person được giữ xuyên suốt; số điện thoại trùng không tự gộp người hoặc anh/chị/em. `CUSTOMER` nghĩa là đã tới điểm bán, không đồng nghĩa đã đóng phí hay Active student.
- Stack: Next.js 16/React 19 → BFF `/api/backend/...` với phiên HttpOnly → NestJS → Prisma 6 tenant transaction → PostgreSQL 16 với RLS/FORCE RLS, composite FK và audit. Browser dùng Keycloak Authorization Code + PKCE.
- Schema nền gồm 14 bảng SaaS Core và 14 bảng CRM trong 4 migration hiện có. ERD đích/reference lớn hơn là thiết kế tương lai, không phải các bảng đã triển khai.
- CSV import được nhắc trong PRD lịch sử nhưng chưa có workflow tương ứng ở baseline; giữ là gap/backlog, không coi đã nghiệm thu. Stage 03–09 chưa được triển khai bởi các lượt sửa này.

## 3. Nhận diện source và môi trường

Fingerprint chín file ứng dụng đã đối chiếu với `/api/version` trên port 3000 và header:

```text
4dc53554b14ca76cd37edd1e1794c6aa65a72c6b4620c2cfea54f80e9a67416e
```

Tạo bằng `node verification/write_source_revision.mjs`. Danh sách bao gồm trang chủ, shared UI, CRM console, controllers/Core service/main backend, CRM service, contracts và route đăng nhập. Fingerprint không phải chữ ký triển khai hoặc attestation tiến trình backend.

Môi trường local đã xác minh: Node 22, Ubuntu/WSL, Chrome 157 headless, PostgreSQL/Keycloak demo đang chạy; frontend `:3000`, backend `:3001`, Keycloak `:18080`, PostgreSQL `:55432`. `/health/live` trả 200 `{"ok":true}`; OpenAPI có `/v1/me/tenants`. Chỉ dùng fixture synthetic.

Metadata `.git` không khả dụng trong môi trường thực thi này. Vì vậy không chứng nhận nhánh/local diff bằng Git; khi xuất bản, đối chiếu blob local với cây remote, giữ lịch sử và dùng cập nhật nhánh có kiểm tra head. Các lần frontend giữ cache/fingerprint cũ đã được giải quyết bằng restart đúng frontend từ terminal người dùng; không ghi PASS của bản cũ cho source mới.

## 4. Các lỗi và cải tiến đã xử lý

| Vấn đề | Nguyên nhân / cách sửa | Bằng chứng |
|---|---|---|
| Modal mất focus khi gõ | Effect từng phụ thuộc handler không ổn định; giữ handler bằng ref, effect ổn định, chọn control có thể thao tác; giữ focus trong dialog, Tab/Shift+Tab wrap, Escape và trả focus | Browser gõ liên tục ≥20 ký tự có dấu ở ba trường, bàn phím và reopen PASS |
| Script verification phụ thuộc NVM/path | Dùng module resolution thay cho giả định đường dẫn một máy; loader isolated TS resolve theo module nguồn | Static, logic, typecheck và regression PASS |
| Runner trùng port, probe nhầm service | Preflight port; explicit reuse kiểm tra tương thích; chỉ dừng process do runner sở hữu; health không tự chứng minh source | Lifecycle tests, kiểm tra source gate và thực tế chặn frontend cũ |
| Demo Keycloak thiếu profile | Generator thêm email/tên synthetic, requiredActions rỗng, password không temporary; subject realm thử riêng được namespace | Generator 5/5; bằng chứng fresh realm trước đó; không reset realm đang dùng |
| Vào tenant cần UUID/thử API Platform Admin | `/v1/me/tenants` kiểm tra membership ACTIVE trong tenant/RLS; tự vào khi chỉ một tenant; chooser dùng code/tên khi nhiều tenant | API discovery, service regression, tự vào A/B trong browser |
| Chi tiết Lead khó tìm | Mở modal ngay, có loading/error, Person/contact, branch/source, lịch sử care/event/touch; Escape trả focus | Direct MCP và Chrome đầy đủ |
| Chi tiết Lead hiển thị sai QL | API detail thiếu `isQualified`; thêm cờ derive từ phone chuẩn hóa, vẫn mask số và giữ `qualifiedAt` lịch sử | Red/green regression; API và browser detail PASS |
| Person thiếu/sai branch trả 500 | UUID validator ném Error thường; đổi sang HTTP 400 cho giá trị thiếu, sai hoặc không phải string | Service và live API PASS; không nới permission |
| Ô ngày giờ chăm sóc bị xóa | `datetime-local` nhận chuỗi UTC sau mỗi ký tự; giữ chuỗi local trong state, chỉ đổi ISO lúc submit | MCP nhập/sửa/xóa/giữ qua rerender và POST 201; giờ local 2026-11-10 14:30 ở Asia/Bangkok lưu **2026-11-10T07:30:00.000Z** trong activity và Lead |
| Đăng nhập tự quay về demo-a | App logout xóa cookie app nhưng còn SSO Keycloak; explicit login thêm `prompt=login`, giữ PKCE/state/nonce | MCP và Chrome xác nhận hiện mật khẩu khi còn SSO; `Restart login` cho nhập tài khoản khác; đổi sang B và A bị 403 |
| Dependency high lịch sử | Cập nhật transitive resolution/lockfile có kiểm tra tương thích, không `npm audit fix --force` | CI lịch sử và audit local mới; còn 6 moderate |

`prompt=login` không phải global logout mọi ứng dụng Keycloak. Phiên app còn hiệu lực vẫn có thể truy cập như bình thường; khi explicit login, phải xác thực lại. Không có tài khoản demo bị hard-code trong route đăng nhập.

## 5. Kiểm thử, bằng chứng và diễn tiến

### Kết quả local đã ghi nhận

| Lớp | Lệnh / cách chạy | Nơi giữ bằng chứng local (ignored) |
|---|---|---|
| Static | `node verification/verify_static.mjs` | `verification/artifacts/care-login-fix-20261108/static.log` |
| Isolated logic | `node verification/verify_logic.mjs` | Cùng thư mục, `logic.log` |
| Schema/rules | `node verification/verify_stage02.mjs` | Cùng thư mục, `stage02-static.log` |
| Unit | `npm test` từ `backend` | Terminal và summary các lượt chạy |
| Regression | `node --test verification/*.test.mjs` | Cùng thư mục, `regressions.log` (22 PASS) |
| Build/typecheck | `npm run build`, `npm run typecheck` trong từng app | Terminal; summary/source-only baseline dưới các thư mục artifacts |
| Realm generator | `python3 verification/test_realm_generator.py` | Terminal, 5 PASS trong lượt trước |
| Main/extended API | `verification/api_e2e_smoke.py`, `verification/stage02_extended_smoke.py` với opt-in và env riêng | `verification/artifacts/stage02-retest-20261108/` — `api_e2e_smoke.log`, `extended-api.log` |
| Restricted API | `verification/restricted_roles_smoke.py` | Cùng thư mục, `restricted-roles.log` |
| SQL | `psql -X -v ON_ERROR_STOP=1` trong container; 4 smoke script cũ + `crm_integrity_smoke.sql` | Cùng thư mục: `rls_*.log`, `composite_fk_smoke.log`, `crm-integrity.log` |
| OIDC HTTP | `python3 verification/oidc_http_smoke.py` | `verification/artifacts/care-login-fix-20261108/oidc-http-after-restart.log` (14 assertions) |
| Chrome/CDP | `node verification/browser_e2e.mjs` | Cùng thư mục, `full-browser.log`, `full-browser-summary.json` (25 PASS) |
| Direct MCP | `care_datetime.browser.js`, `login_reauth.browser.js` và đối chiếu request/API | Cùng thư mục, `summary.json`, `care-datetime-entered.png`; không chụp màn hình password |
| Audit | `node verification/audit_dependencies.mjs backend` / `frontend` | `verification/artifacts/stage02-retest-20261108/*-audit.log` và audit JSON |

SQL RLS/grants/audit chạy bằng `app_runtime`; owner chỉ dùng riêng để kiểm tra FK/trigger độc lập. Dữ liệu SQL thử rollback. API test thêm Source/Campaign, Person/Lead/care/Check-in synthetic và để nguyên, không dọn bằng DELETE. Fixture quyền hạn có tenant Gate riêng; subject của hai identity synthetic mới được căn theo ID Keycloak REST thực tế; không đổi tài khoản demo hiện có.

### CI — tách khỏi local và MCP

- [Run 42363351604](https://github.com/dinhthingochanpisa-bot/EnglishCenter2/actions/runs/42363351604), commit `a8ca2922f048ecbcb13c9e1c4ed207357d480e8f`: CI lịch sử ghi nhận audit, Prisma/migrations/RLS/FK, build và full browser PASS.
- [Run 42370906997](https://github.com/dinhthingochanpisa-bot/EnglishCenter2/actions/runs/42370906997), commit `c66c82032b26c87475dbde9e6ca8869f4e49e115`: báo cáo PR lịch sử ghi 19 Chrome assertions, API 76, HTTP OIDC 13, fresh realm và quyền branch PASS.
- [Run 42396416148](https://github.com/dinhthingochanpisa-bot/EnglishCenter2/actions/runs/42396416148), commit `7be426741f64b6e8ecc750ca2128fd6fdfe7d946`: trạng thái **completed/success** đã đọc trực tiếp từ GitHub khi tổng hợp. Commit này **chưa gồm** bản sửa ngày giờ và `prompt=login` mới nhất.
- Commit tổng hợp và các bản sửa mới cần CI riêng; không gán PASS của commit cũ cho commit mới hoặc coi thay đổi workflow là bằng chứng CI đã chạy.

### Lịch sử kết quả — không cộng dồn assertion

| Mốc | Kết quả / giới hạn ở thời điểm đó | Cách hiểu hiện tại |
|---|---|---|
| 2026-11-06 | Static đạt; thiếu Docker/DB/dependencies, runtime BLOCKED | Báo cáo môi trường ban đầu, không phủ định kiểm thử runtime sau |
| Handoff WSL/Chrome | API 46 PASS; login/list thấy hoạt động; focus lỗi; runner đôi lúc không start | Bằng chứng đầu tiên, đã được mở rộng |
| Review local 2026-11-07 | API 53, HTTP OIDC 13; Windows binary/WSL/Docker blockers; G3 đóng | Giữ riêng môi trường Windows và các kết quả Linux/CI về sau |
| Stabilization/CI | API 69; Chrome CI 15 rồi 19; generator/runner/security được củng cố | Không phải tổng số test hiện tại |
| MCP trước restart | `/api/version` 404, thiếu Chrome/sudo hoặc source không khớp | Không có PASS source mới từ các lượt này |
| MCP UAT đầu tiên đầy đủ | 19 PASS, 2 FAIL, 7 BLOCKED | Hai lỗi QL/branch đã sửa; browser blocker đã đóng ở lượt sau |
| Retest | API 80 + extended 45 + restricted 9; SQL 5 nhóm; fingerprint cũ còn chặn browser | Backend/SQL đạt trước khi browser mới được chạy |
| Sau sửa ngày giờ/đăng nhập và restart | Fingerprint hiện tại khớp; direct MCP đạt, Chrome **25/25**, regression **22/22**, HTTP OIDC **14** | Kết quả mới nhất cho các phần đã kiểm tra; G3/QR/production vẫn riêng |

Các lỗi thử nghiệm trung gian được giữ trong artifacts: API gọi trước khi backend ready; fixture Gate subject chưa khớp; exact-text locator quá chặt; logout ngoài viewport; loader TS chưa resolve dependency; SQL test dùng sai thông báo trigger mong đợi. Chúng được phân biệt với lỗi ứng dụng và với kết quả rerun thành công.

## 6. Đối chiếu acceptance CRM-01–20

| ID | Bằng chứng / trạng thái |
|---|---|
| CRM-01 | PASS main API A↔B read/write denial, guessed Person ID, audit; browser B gọi A nhận 403 |
| CRM-02 | PASS restricted-user API branch read denial và service tests |
| CRM-03 | PASS anh/chị/em dùng chung số liên hệ vẫn là Person riêng |
| CRM-04 | PASS tạo Lead không phone → NEW, QL false |
| CRM-05 | PASS phone chuẩn hóa → QL; timestamp lần đầu giữ nguyên; detail/list thống nhất |
| CRM-06 | PASS chuyển stage không hợp lệ bị 400 |
| CRM-07 | PASS stale Lead/Person rowVersion bị 409, không ghi đè dữ liệu mới |
| CRM-08 | PASS hai completion đồng thời: một thành công, một 409; một guardian link/audit completion |
| CRM-09 | PASS API mismatch rejection, SQL composite tenant FK và Check-in/Campaign trigger |
| CRM-10 | PASS thiếu dữ liệu bắt buộc hoặc guardian phone sai không complete được |
| CRM-11–13 | **BLOCKED** cho QR-enabled acceptance; chưa bật QR, cần quyết định phạm vi và security/privacy gate |
| CRM-14 | PASS masking số điện thoại qua API/UI khi không có quyền nhạy cảm |
| CRM-15 | PASS audit Tenant A không xuất hiện ở Tenant B |
| CRM-16 | PASS giữ source đầu tiên, append first/follow-up touch history |
| CRM-17 | PASS người không có quyền assign bị 403 |
| CRM-18 | PASS assignee sai branch bị 400; rowVersion không đổi sau request bị từ chối |
| CRM-19 | PASS API public intake/create invite giữ 503 khi feature tắt |
| CRM-20 | PASS browser offline hiện lỗi thật, giữ input/modal; chỉ báo thành công sau khi backend xác nhận |

Không dùng số lượng PASS để thay thế quyết định phạm vi hoặc sign-off của chủ sản phẩm.

## 7. Bảo mật, dependency và các việc còn mở

- Backend vẫn kiểm tra OIDC, membership ACTIVE, permission, branch/object scope và transaction tenant-scoped. Không tin tenantId/quyền từ client; không mở rộng runtime grants, không bỏ FORCE RLS/composite FK/audit.
- Audit lịch sử ban đầu: 14 findings (10 high, 4 moderate); sau remediation CI ghi 5 moderate; audit local gần nhất ghi **6 moderate** gồm propagated Nest/Swagger/mapped-types/file-type. Đây là các lượt/advisory khác nhau, không gọi là 0 vulnerabilities. Cần nâng cấp có kiểm thử hoặc quyết định rủi ro của chủ bảo mật trước release.
- Các override/transitive lock đã được báo cáo: body-parser, multer, js-yaml, lodash, effect, qs; deepmerge-ts override giới hạn dưới `@prisma/config` có thử Prisma/integration. Không đổi major Nest/Prisma hay chạy audit fix --force trong các bản sửa gần nhất.
- Giữ public intake tắt đến khi consent/retention, rate limit/anti-abuse, privacy và security acceptance đủ. Chủ sản phẩm cần quyết định nghiệm thu Stage 02 trong phạm vi QR tắt hay tiếp tục làm QR-enabled acceptance.
- Chưa thử native OS Vietnamese IME composition; Unicode có dấu qua browser đã đạt. Chưa có fixture browser thật cho nhiều membership; service regression đã kiểm tra nhiều/không/inactive membership. Chưa chờ session tự hết hạn trong browser; unit/isolated expiry và logout đã đạt. Scenario hidden/disabled controls chuyên biệt chưa được nghiệm thu trực tiếp.
- Local không replay migration từ DB trống; CI lịch sử có clean integration ở source tương ứng. Native Windows dependency/WSL restrictions trước đây không được coi đã sửa trên mọi máy.
- MFA/admin production, rate limiting, invitation acceptance, CSP/CSRF/threat review, backup và observability vẫn cần đánh giá release riêng; temporary Keycloak admin demo không phải thiết kế production.
- Mâu thuẫn reference: Lead CONVERTED từng được gắn với hợp đồng; Stage 02 hiện tại dùng Check-in hoàn tất. Giữ hành vi đang test; cần ADR/mapping trước khi thêm hợp đồng, không tự diễn giải lại lịch sử.
- **G3 chưa ký; Stage 03 chưa được mở.** Sau nghiệm thu Stage 02 và quyết định QR, lập kế hoạch Stage 03 và chốt ADR-201/202/203/223 về precedence/stacking/cap, voucher, rounding/freeze và tách quyền approval; không áp chính sách giá/voucher mặc định chưa được duyệt.

## 8. Chạy lại an toàn và rollback

Với stack demo đang chạy, kiểm tra port và `/api/version` trước. Không chạy runner bootstrap/reset trên môi trường đang giữ dữ liệu. Các script API cần credentials local ignored và opt-in; không dán giá trị env vào chat/log.

```text
node verification/write_source_revision.mjs
node verification/verify_static.mjs
node verification/verify_logic.mjs
node verification/verify_stage02.mjs
node --test verification/*.test.mjs
python3 verification/test_realm_generator.py
python3 verification/run_live_acceptance.py
python3 verification/oidc_http_smoke.py
node verification/browser_e2e.mjs
```

Chạy `npm run typecheck`, `npm test` và `npm run build` trong backend; frontend có typecheck/build. Chỉ restart đúng tiến trình ứng dụng đã xác minh; không dùng pkill/killall node. `run_local_full_e2e.sh` dùng cho môi trường disposable; chế độ `--reuse-services` có kiểm tra tương thích nhưng health không tự chứng minh source. Không `docker compose down -v`, migrate reset, db push hoặc dọn dữ liệu hàng loạt.

Không có schema change trong các bản sửa QL/UUID/ngày giờ/login. Rollback bằng commit revert có review trên nhánh; hoặc đối chiếu source-only baseline ignored rồi hoàn nguyên đúng phần sửa, giữ bản vá mới của người dùng. Build/restart backend nếu rollback backend, regenerate fingerprint và restart frontend nếu rollback frontend/hash list. Không rollback/reset data. Fixture synthetic và realm thử giữ nguyên trừ khi được cho phép dọn riêng.

Không đưa `.env`, generated realm credentials, gate.env, token/cookie/browser profile, raw network captures, node_modules/build/cache/ZIP hoặc PII thật lên Git. Chỉ báo cáo đã làm sạch và mã nguồn/test được commit. Chưa merge main hay deploy production.

## 9. Danh mục nguồn đã hợp nhất

| Báo cáo gốc | Nội dung đã hợp nhất |
|---|---|
| [HANDOFF_STATUS.md](HANDOFF_STATUS.md) | Quan sát máy người dùng, issue ledger, product boundary và giới hạn môi trường |
| [LOCAL_REVIEW_AND_STAGE03_PLAN_2026-11-07.md](LOCAL_REVIEW_AND_STAGE03_PLAN_2026-11-07.md) | Kiến trúc, nguồn đã/đang có, gap CSV/reference, roadmap và ADR chưa chốt |
| [ISSUE_2_UAT.md](ISSUE_2_UAT.md) | Tenant discovery, friendly identity, detail modal, fingerprint và UAT follow-up |
| [STAGE02_DEPENDENCY_REVIEW.md](STAGE02_DEPENDENCY_REVIEW.md) | Advisory/override/lockfile review, CI lịch sử, residual release risks |
| [STAGE02_STABILIZATION_GATE.md](STAGE02_STABILIZATION_GATE.md) | Focus/runner/realm fixes, concurrency, CI, scope QR và gate Stage 03 |
| [STAGE02_MCP_UAT_20261108.md](STAGE02_MCP_UAT_20261108.md) | Direct MCP 19/2/7 checkpoint, hai defect ban đầu và giới hạn UAT |
| [STAGE02_RETEST_FIXES_20261108.md](STAGE02_RETEST_FIXES_20261108.md) | Fix QL/UUID, expanded API, SQL constraints và quyền restricted |
| [CARE_DATETIME_LOGIN_FIX_20261108.md](CARE_DATETIME_LOGIN_FIX_20261108.md) | Red/green ngày giờ/SSO, source cuối, MCP và Chrome 25/25 |
| [RUNTIME_VERIFICATION_REPORT.md](../../verification/RUNTIME_VERIFICATION_REPORT.md) | Runtime BLOCKED ban đầu, cấu hình auth test và các bước chưa chạy khi đó |
| [STAGE3_READINESS_2026-11-07.md](../../verification/STAGE3_READINESS_2026-11-07.md) | API 53/HTTP 13, Windows blockers và điều kiện chưa mở Stage 03 |
| [VERIFICATION_STATUS.md](../../verification/VERIFICATION_STATUS.md) | Stage 01 static/security foundation và pilot checklist lịch sử |

Các snapshot `verification/static_report.txt` và `verification/logic_report.txt` được đối chiếu như lịch sử static/logic, không thay log mới. Contract/tiêu chí tiếp tục nằm ở [ACCEPTANCE_TESTS.md](../ACCEPTANCE_TESTS.md), [API_STAGE02.md](../API_STAGE02.md), [STAGE02_ERD.md](../STAGE02_ERD.md) và [TEST_RUNBOOK.md](TEST_RUNBOOK.md); đó là tài liệu kỹ thuật/runbook, không phải kết quả test bổ sung.
