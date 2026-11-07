# Stage 01–02 acceptance before Stage 3 — 2026-11-07

Decision: **Stage 3 gate remains CLOSED.** The existing localhost stack supports real authenticated CRM operations. Reproducible builds, direct database acceptance, and interactive browser QA still need completion.

## Executed and passed

- Static checks: 15/15. Source scan now excludes dependency/build directories; 34 application TS/TSX files parsed without syntax errors.
- Isolated logic: 9/9.
- Stage 02 checks: 36 TS/TSX files parsed; 14 CRM models correspond to migration tables; domain rules pass.
- Backend semantic typecheck and TypeScript build.
- Six existing backend unit tests, compiled with the installed TypeScript compiler and executed by Node's test runner. The usual tsx launcher fails in this restricted Windows session.
- Frontend semantic typecheck.
- Live backend, frontend, and Keycloak OIDC discovery: HTTP 200.
- Real API smoke: **53/53 passed**, using synthetic demo-a/demo-b identities: JWT issuer/audience, anonymous rejection, cross-tenant read/write denial, Lead → QL → care → completed Check-in → Customer 360, replay rejection, and public QR disabled. See `artifacts/stage3-gate/api-e2e.log` for the latest extended run, including stale rowVersion, immutable first qualification timestamp, sibling profiles sharing guardian phone, and required Check-in fields.
- HTTP Authorization Code + PKCE flow: Keycloak form submission, real callback/code exchange, authenticated HttpOnly session cookie, CRM BFF authorization, and CRM HTML route. 13 assertions passed. This is an HTTP client test, not a rendered browser/UI test.

## Remaining acceptance

| Gate | Observed limitation / remaining work |
|---|---|
| Reproducible native build | Installed dependencies include Linux Prisma/SWC binaries. Windows binaries are missing. Frontend build and Prisma validation fail; network requests to npm/Prisma endpoints are denied in this session. |
| PostgreSQL migration and direct RLS/FK tests | Docker CLI is installed, but Engine named pipes return permission denied. WSL also returns access denied. No native psql or Python PostgreSQL driver is available. Existing live API behavior does not prove a clean migration replay or independent RLS SQL acceptance. |
| Browser UI | No browser/computer interaction tool is available in this session. Need real browser rendering, interactions, error states, and cross-branch role cases. |
| Full acceptance matrix | `docs/ACCEPTANCE_TESTS.md` contains 20 scenarios. The current API suite covers a subset, not a complete sign-off; notably concurrent completion, role/branch changes, audit isolation, source attribution, and QR-enabled cases remain. Public QR remains disabled. |

The local demo credentials were read from ignored env files and were not copied into the report. Smoke tests created synthetic records only. No shared environment was reset and no migration was deployed by this session.

## Re-run

```text
node verification/run_stage3_gate.mjs
python verification/run_live_acceptance.py
```

The first command records independent compile/service probes and always leaves the acceptance gate closed: it cannot certify full acceptance. The second runs synthetic live tests against an already-running local test stack and writes a separate live summary. Use an accessible Python installation on Windows; the WindowsApps alias may be unavailable.

Logs: `verification/artifacts/stage3-gate/` (ignored by Git). General checks: `summary.json`; live-test wrapper: `live-summary.json` when executed. The general summary does not replace live API/OIDC evidence.

For a full disposable environment with working Docker/npm access, use `verification/run_local_full_e2e.sh`, then complete the remaining browser and acceptance-matrix cases. Do not classify infrastructure access errors as application test failures, and do not classify HTTP route availability as visual UI acceptance.
