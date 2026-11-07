# Stage 01–02 runtime verification — report

> Historical report. New Windows-session testing on 2026-11-07 passed 53 live API checks and 13 HTTP OIDC callback checks against the existing local services. See [current Stage 3 readiness](STAGE3_READINESS_2026-11-07.md) for evidence and remaining gates.

Date: 2026-11-06 (UTC); source: Stage 02 archive supplied in the prior conversation.

## Outcome

**BLOCKED — NOT RUNTIME-VERIFIED.** The environment in which this artifact was prepared has no PostgreSQL binaries, PostgreSQL server, `psql`, Docker or Docker Compose. The npm registry lookup returned `EAI_AGAIN` (DNS/network unavailable). Do not interpret static validation as proof migrations, isolation, JWT authentication or CRM APIs work on a live stack.

## Executed in this environment

| Check | Observed result |
|---|---|
| Presence of Stage 02 workspace/archive | PASS; extracted prior source |
| Stage 01/02 static validations (`node verification/verify_static.mjs`) | PASS: 15/15 checks |
| Isolated logic (`node verification/verify_logic.mjs`) | PASS: 9/9 checks |
| Stage 02 TS/TSX parse, model/table correspondence and domain rules (`node verification/verify_stage02.mjs`) | PASS: 36 files parsed; 14 models aligned to 14 migration CREATE TABLE declarations |
| Python smoke/Keycloak realm generator syntax and shell script syntax | PASS |
| Generated test Keycloak import JSON and verified structure | PASS: 2 synthetic users, 3 OIDC clients incl. PKCE and test-only CLI; temporary credentials discarded |
| `bash verification/run_local_full_e2e.sh` | **BLOCKED: docker unavailable** (exit 2) |
| npm dependency retrieval | **BLOCKED:** npm registry DNS `EAI_AGAIN` |
| Prisma validate/generate/migrate deploy | **NOT RUN** (dependencies/DB unavailable) |
| PostgreSQL RLS and composite FK live tests | **NOT RUN** (DB unavailable) |
| OIDC JWT exchange / issuer / audience / JWKS live verification | **NOT RUN** (Keycloak not started) |
| REST API Lead → QL → Care → Check-in → Customer 360 | **NOT RUN** (services not started) |
| Next/Nest build and interactive browser callback | **NOT RUN** (dependencies/services unavailable) |

Artifacts: `verification/artifacts/integration_attempt.log` contains the actual startup attempt. No fake API or database test results were fabricated.

## Changes vs Stage 02 archive

1. Added disposable Keycloak 26.8.1 test Compose file and ephemeral realm provisioning. `lms-web` uses Authorization Code + PKCE; `lms-smoke-cli` is **test-only** and allows scripted password grant. Credentials are generated locally and excluded from the delivered archive.
2. Aligned demo OIDC subjects with immutable synthetic user IDs in database seed so that the Nest AuthGuard can find the test users.
3. Allow local loopback HTTP OIDC discovery only when `NODE_ENV !== production`; HTTPS remains mandatory for production.
4. Added `verification/api_e2e_smoke.py` with negative and positive tests for tenant membership, sources, Lead/QL, care history, Check-in, Customer 360, PII masking, cross-tenant access and replay.
5. Added `verification/run_local_full_e2e.sh` plus syntax checks and test docs; retained Stage 01–02 migrations, PostgreSQL RLS scripts and source code.

## Next gate for acceptance

On a Docker-capable machine with npm access, run from extracted workspace root:

```bash
bash verification/run_local_full_e2e.sh
```

All real SQL/API/OIDC steps must pass and produce logs. Review the logs for failures; verify browser Authorization Code callback and pages manually. Do not use children's personal data during validation. If a migration fails, fix/re-run on disposable database first, rather than bypassing RLS or using a superuser in the app.

The full instructions are in `verification/README_LOCAL_E2E.md`.
