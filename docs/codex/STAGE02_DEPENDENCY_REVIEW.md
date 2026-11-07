> **Báo cáo tổng hợp Stage 02:** [STAGE02_REPORT.md](STAGE02_REPORT.md). Nội dung bên dưới được giữ để truy vết lịch sử; xem báo cáo tổng hợp để biết kết quả mới nhất.

# Stage 02 dependency review — 2026-11-07

## Actual audit evidence

Original backend lockfile: **14 findings (10 high, 4 moderate, 0 critical)**. Frontend audit passed the high/critical threshold. Local advisory requests are blocked; counts come from actual GitHub Actions registry audits, not guessed from versions.

Targeted candidate: **0 high, 0 critical, 5 moderate**. [Candidate run 42362839486](https://github.com/dinhthingochanpisa-bot/EnglishCenter2/actions/runs/42362839486) passed audit and the complete disposable PostgreSQL/Keycloak/API/browser regression before its generated package/lockfile were imported locally.

No `npm audit fix --force`, framework-major migration, Prisma-major migration, SQL migration, database reset or volume deletion was used. Local installed node_modules were not replaced with another platform's binaries; the new lockfile is verified on CI via npm ci.

## Reviewed transitive resolution

| Package | Previous | Candidate lock | Reason / compatibility evidence |
|---|---|---|---|
| body-parser | 1.20.4 | 1.20.9 | Same-major patch; compressed request-body DoS advisory GHSA-27r3-jxmh-p828 |
| multer | 2.0.2 | 2.5.0 | Same-major update; multiple multipart cleanup/field-name/fileFilter DoS advisories including GHSA-q7qp-rjg7-q26m |
| js-yaml | 4.1.0 | 4.3.2 | Same-major update; merge-key/omap CPU exhaustion including GHSA-2883-xcg3-v3hh |
| lodash | 4.17.21 | 4.18.1 | Same-major resolution; template injection GHSA-r5fr-rjxr-66jc |
| effect | 3.18.4 | 3.22.4 | Same-major update; async context contamination GHSA-38f7-945m-qr2g |
| qs | 6.14.3 | 6.17.1 | Same-major update; parser/stringifier resource exhaustion advisories |
| deepmerge-ts | 7.1.5 | 8.0.2 | Deliberate scoped override under @prisma/config; recursive merge exhaustion GHSA-ggr8-5vv4-36mx. This utility major change was tested with Prisma generate/validate/migrate and full integration; Prisma itself remains 6.19.0 |

Overrides constrain resolution; committed lockfile records the tested exact artifacts/integrity. Future lockfile refreshes require the same audit and integration tests. Existing upload behavior is not certified beyond current endpoints; future file-upload modules need their own security tests.

## Residual findings and release boundary

The five moderate npm findings are on `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `@nestjs/swagger`, and `file-type` (including propagated findings). Relevant advisories include [core output injection](https://github.com/advisories/GHSA-36xv-jgw5-4q75), [file-type ASF parser loop](https://github.com/advisories/GHSA-5v7r-6r5c-r473), and [file-type ZIP decompression bomb](https://github.com/advisories/GHSA-j47w-4g3g-c36v).

Do not assume these are unreachable or acceptable merely because integration passes. Their full remediation requires a separately tested Nest/Swagger and file-type upgrade or documented security-owner risk decision. The Stage 02 CI policy blocks high/critical; passing it is not a declaration of zero vulnerabilities or production security approval. Keep production/pilot security sign-off separate from the stabilization test gate.

## Repeat

```text
node verification/audit_dependencies.mjs backend
node verification/audit_dependencies.mjs frontend
```

The script writes full advisory JSON under ignored artifacts, prints package/severity/fix metadata, and fails on audit endpoint errors. Advisory network failure is BLOCKED, never PASS. CI archives audit JSON independently from application runtime artifacts.
