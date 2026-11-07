# Stage 02 retest and fixes — 2026-11-08

Status: backend/source/SQL checks PASS; **full post-fix browser gate BLOCKED by stale frontend fingerprint**. This is not full Stage 02 acceptance or production approval. The earlier two application defects are fixed and directly rechecked.

## Changes

- `backend/src/crm.service.ts`: Lead detail now derives `isQualified` from the normalized phone, matching the list. Masking, authorization and historical `qualifiedAt` are preserved.
- `backend/src/contracts.ts`: missing, malformed and non-string UUIDs now produce HTTP 400 through `BadRequestException`, instead of generic HTTP 500. No tenant/branch authorization is relaxed.
- `verification/crm_detail.test.mjs`: seven regression tests cover both defects, phone masking and denied authorization. Before fix: 6 failures/1 pass; after: 7 pass within the 21-test regression suite.
- Expanded API checks for both fixes; added `stage02_extended_smoke.py` for catalog, Person, assignment and Walk-in coverage; added `crm_integrity_smoke.sql` for live database FK/trigger/RLS metadata checks.
- Browser runner asserts the QL detail label. Fingerprint now covers eight application files, adding CRM service and contracts; still not a signed deployment/backend attestation.
- The isolated TypeScript test loader now resolves imports relative to each source module, so it can load the Nest exception import from backend dependencies. No dependency replacement.
- CI includes the new service/SQL regressions; live acceptance includes the extended API suite; sanitizer allowlist includes its log. No CI run is claimed here.

## Current verification

| Layer | Command / check | Result |
|---|---|---|
| Source | `node verification/verify_static.mjs` | PASS 15/15 |
| Isolated logic | `node verification/verify_logic.mjs` | PASS 9/9 after loader correction, including expired-session rejection |
| Stage 02 static | `node verification/verify_stage02.mjs` | PASS; 38 application TS/TSX files parsed; schema/rules checked |
| Backend | `npm run build`, `npm run typecheck`, `npm test` from backend | PASS; 6 unit tests |
| Frontend | `npm run build`, `npm run typecheck` from frontend | PASS; generated next-env imports restored to pre-task dev form |
| Service/lifecycle | `node --test verification/authorization.test.mjs verification/assignment.test.mjs verification/my_tenants.test.mjs verification/service_lifecycle.test.mjs verification/crm_detail.test.mjs` | PASS 21/21 |
| Realm generator | `python3 verification/test_realm_generator.py` | PASS 5/5; no existing realm restart/import |
| Database | Existing 4 SQL smoke scripts plus `crm_integrity_smoke.sql`, via container psql with ON_ERROR_STOP | PASS 5 groups; test writes roll back |
| Main live API | `ALLOW_DEMO_E2E=true python3 verification/api_e2e_smoke.py`, local env loaded privately | PASS 80 checks |
| Extended live API | `ALLOW_DEMO_E2E=true python3 verification/stage02_extended_smoke.py` | PASS 45 checks |
| Restricted roles | `ALLOW_DEMO_E2E=true python3 verification/restricted_roles_smoke.py` | PASS 9 checks with actual restricted-user tokens |
| OIDC HTTP | `python3 verification/oidc_http_smoke.py` | PASS 13 assertions plus final summary; not browser interaction |
| Dependency audit | `node verification/audit_dependencies.mjs backend` / `frontend` | PASS high/critical threshold; backend 6 moderate, frontend 0 findings |
| Full browser after fix | `node verification/browser_e2e.mjs` | BLOCKED: source identity assertion detects stale frontend and exits 1 before workflow |
| Direct MCP diagnosis | Real isolated-context OIDC login, existing synthetic Lead detail, missing/invalid branch requests | QL label corrected; both invalid requests 400; logout 200. Frontend still stale: diagnostic evidence only |

SQL ran as app_runtime for RLS/grant/audit checks and as database owner only for independent composite-FK/trigger checks. No grants were widened. Main API includes simultaneous completion, duplicate rejection, version conflicts, siblings sharing a guardian phone without merging, audit/source history, masking and A/B isolation. Extended API covers Source/Campaign validation, Person search/update/version conflicts, assignment, existing Person reuse, Walk-in 360 and public-submit-disabled behavior.

## CRM acceptance traceability

| Cases | Current evidence |
|---|---|
| CRM-01 | Main API A/B isolation and guessed Person ID denial |
| CRM-02,17,18 | Restricted-user live branch/assignment suite plus service tests |
| CRM-03–07 | Main API siblings, NEW/QL, historical qualification and invalid/stale updates |
| CRM-08 | Main API concurrent completion: one success, one 409, one guardian/audit effect |
| CRM-09 | Main API mismatch rejection; independent CRM FK/check-in/campaign SQL triggers |
| CRM-10 | Incomplete completion rejected; extended API invalid guardian phone rejected |
| CRM-11–13 | BLOCKED for enabled QR scope; feature remains disabled |
| CRM-14–16 | Masked phones, cross-tenant audit denial and immutable first attribution with appended touches |
| CRM-19 | Invite creation and direct public submission both return 503 |
| CRM-20 | Previous direct browser run passed; fresh full post-fix browser run pending source-verified frontend |

## Remaining gates and evidence

Expected eight-file source revision: `78be2e7d6e2967ac61d68673dd33794c6f25ecbec169ba1936a2551a873407a7`.
Frontend :3000 still serves: `9cbc9a1819a9b39e8c26b6bed6d2859ffda615018913bfe3a3da5190ed1860d0`.
Backend :3001 was rebuilt, restarted only through the session owned by this task and verified by live regression behavior. PostgreSQL/Keycloak remained healthy. Git metadata is unavailable in this execution environment, so commit/local diff cannot be certified.

User was asked asynchronously to Ctrl+C and rerun `npm run dev` in the frontend terminal, because that foreground process is outside this execution environment's PID view. Once `/api/version` and the header match the expected revision, rerun the full Chrome suite and direct MCP regression. Do not bypass the fingerprint assertion. Native OS IME and a dedicated multi-membership browser fixture remain untested. Natural session expiry was not waited out in-browser; isolated expiry checks pass. No fresh migration replay was attempted against retained data.

Artifacts: ignored `verification/artifacts/stage02-retest-20261108/` contains sanitized test logs, `summary.json`, source-only baseline copies, and `qualified-detail-diagnostic.png`. The screenshot contains synthetic names/masked phone only. Do not publish `gate.env`, browser profiles, login snapshots, cookies or credentials. The known local-secret scan passed for selected textual evidence. Prior failures (backend not ready at first API launch, initial gate subject mismatch, isolated loader and one new SQL expectation) are retained separately from successful reruns; the source-mismatch browser attempt remains blocked.

## Data, deployment and rollback

No schema migration, DB reset, volume deletion, PostgreSQL/Keycloak stop, dependency replacement, public QR activation, merge or deployment. API tests add synthetic records and leave them intact. Restricted-role testing added the reserved synthetic Gate tenant/accounts; only these new test identities were aligned to actual REST-created Keycloak subjects. Existing demo accounts and real data were not changed.

Application rollback: restore only this task's edits in `backend/src/contracts.ts` and `backend/src/crm.service.ts` from the ignored source baseline after comparing for newer local changes, rebuild/restart the owned backend, regenerate `frontend/lib/source-revision.json` with the prior file list if reverting the fingerprint expansion, and restart frontend. Review/revert the accompanying verification/CI/docs edits individually; no data rollback is needed. Source backups and per-file diffs/hashes are retained because Git metadata is absent. Do not overwrite later user patches or delete retained synthetic data without explicit authorization.
