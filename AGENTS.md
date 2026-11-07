# AGENTS.md — LumaOS (LMS + CRM SaaS)

> Áp dụng cho mọi tác vụ Codex trong repository này. Đọc `CODEX_START_HERE.md` và `docs/codex/HANDOFF_STATUS.md` trước khi sửa code. Nếu nội dung tài liệu mâu thuẫn với code đang có, kiểm tra code, test và hỏi/ghi ADR; không mặc định tài liệu hoặc code là tuyệt đối đúng.

## Product contract
- LumaOS là **SaaS multi-tenant** cho các trung tâm ngoại ngữ độc lập, mỗi tenant có thể có nhiều branch. Luồng dữ liệu xuyên suốt: Marketing sources → Lead → QL → chăm sóc trước bán → Check-in → Test/Trial → báo giá/hợp đồng/học phí → lớp/điểm danh → CSKH/tái ký/kết thúc.
- **Student/Customer 360°** là hồ sơ xuyên suốt, không tạo person/student mới ở mỗi stage. `CUSTOMER` tại CRM nghĩa là **đã đến điểm bán**, không phải học sinh đã đóng phí/Active.
- Ưu tiên **Contextual Actions**: thao tác tại nơi phát sinh (danh sách lớp, hồ sơ học sinh, Lead), nhưng backend giữ quyền và nghiệp vụ.
- Chính sách tại tenant/branch **cấu hình được, có phiên bản**, không hard-code: nghỉ miễn phí, bảo lưu, CSBH, giá/voucher, workflow, báo cáo.

## Mandatory security invariants
1. Mọi đọc/ghi dữ liệu tenant phải xác minh OIDC, tenant membership, role permission, branch/object scope **ở backend**, và dùng transaction tenant-scoped/RLS phù hợp. Không tin `tenantId` hay quyền do client tự gửi. UI chỉ ẩn/hiện cho UX.
2. Giữ composite tenant foreign keys, PostgreSQL RLS/FORCE RLS, negative tests Tenant A↔B; không nới quyền service runtime để “cho chạy được”.
3. Không lưu/đưa vào git `.env`, `infra/.env.test`, `frontend/.env.local`, Keycloak realm có secret, API token, password, dữ liệu thật của trẻ em. Không in secrets trong log/chat. Dùng demo synthetic.
4. Tài chính, số buổi, approval có tính lịch sử: sử dụng ledger và audit trail, tránh update xóa dấu vết. Không triển khai quy tắc chưa chốt dưới dạng mặc định bất biến.
5. `PUBLIC_INTAKE_ENABLED=false` đến khi có consent/retention, rate-limit, abuse controls và security acceptance. Không bật QR công khai trên Internet chỉ để test.
6. Test-only password grant (`lms-smoke-cli`) không dùng ở production; browser dùng Authorization Code + PKCE và session HttpOnly.

## Coding method (required)
- BẮT ĐẦU: `git status --short`, đọc tài liệu liên quan, xác nhận các thay đổi chưa commit; không ghi đè bản vá người dùng.
- Đối với bug: **reproduce → root cause → minimum change → regression test → verify → report**. Đối với feature: user story + acceptance criteria + edge cases + schema impact + API → implement vertical slice → test.
- Mọi schema change phải đi qua Prisma migration có review, PostgreSQL constraint/RLS tests, không sửa trực tiếp DB production, không `prisma db push` thay migrations.
- Không bao giờ chạy lệnh phá dữ liệu (`docker compose down -v`, `prisma migrate reset`, TRUNCATE, DELETE hàng loạt) khi chưa xác thực chỉ tác động môi trường demo và được người dùng đồng ý.
- Không chạy `npm audit fix --force` tự động; đánh giá từng CVE/compatibility, commit lockfile nếu tạo.
- Không tự khẳng định PASS: báo **đã chạy/không chạy**, command, môi trường, stdout/stderr và blocker; phân biệt static, unit, integration, E2E API, browser E2E, production readiness.
- Thay đổi nhỏ, tránh refactor không liên quan; update tài liệu, changelog, test; tóm tắt file đã sửa và hướng dẫn rollback.

## Current stage & next action
- Stage 01 SaaS Core và Stage 02 CRM có code và có kết quả kiểm thử trên máy người dùng; đọc `docs/codex/HANDOFF_STATUS.md` để biết bằng chứng và giới hạn.
- **Ưu tiên hiện tại: ổn định Stage 02** (Modal focus, automation portability, Keycloak demo profile, browser regression), rồi mới Stage 03 Product/Curriculum/Pricing.
- Không giả định patch focus đã có trong local workspace; kiểm tra `frontend/components/ui.tsx` trước khi sửa.

## Map (existing code, not an implementation request)
- `backend/src/{main,auth,authorization,prisma.service,tenant.service,crm.service,crm.controllers,crm.rules}.ts`
- `backend/prisma/schema.prisma`, `backend/prisma/migrations/`, `backend/prisma/seeds/`
- `frontend/components/{ui,crm-console,tenant-console}.tsx`, `frontend/app/`, `frontend/lib/`
- `infra/docker-compose.{test,oidc}.yml`, `verification/run_local_full_e2e.sh`, `verification/api_e2e_smoke.py`
- API contracts: `docs/API_STAGE02.md`, security/DB design: `docs/STAGE02_ERD.md`, `docs/OPEN_DECISIONS.md`
- Codex handoff: `docs/codex/`; historical conceptual specs: `docs/codex/reference/`.

## Definition of Done
All acceptance criteria addressed; no cross-tenant authorization regression; migrations reviewed when applicable; relevant unit/integration/E2E tests pass (or blockers disclosed); UI tested with real keyboard navigation; builds/typechecks pass; no secrets or real PII committed; docs updated; deployment impact and rollback included.


## Codex project Skills — Stage 02+ (installed in this repository)
The project Skills are located under \`.agents/skills/<skill-name>/SKILL.md\`. Read and invoke the relevant Skill on task type (explicit names can be used as \`$skill-name\` in Codex):
- \`$lumaos-stage-gate\`: any stage acceptance, G0–G5 sign-off, CI/PR readiness. Evidence must match HEAD and product-owner G3 sign-off remains separate.
- \`$lumaos-tenant-security\`: authentication, membership/branch permissions, RLS, schema/API changes, sensitive PII and finance. Require tenant A/B negative tests.
- \`$lumaos-business-rules\`: product/pricing, promotions, attendance/lesson entitlement, contracts, refund/transfer, renewal/BI. Use approved ADR + versioned golden fixtures; no unapproved defaults.
- \`$lumaos-browser-uat\`: real UI bug, Lead/detail/login/Check-in flows and Stage UI acceptance. Use the installed Playwright MCP when available and verify the running revision.

For current Stage 02 status read \`docs/codex/STAGE02_REPORT.md\` (2026-11-08 consolidated report). Historic PASS does not prove current commit; a green CI does not replace the user's UAT. Existing security/secret/DB protection rules above override any proposed skill workflow.
