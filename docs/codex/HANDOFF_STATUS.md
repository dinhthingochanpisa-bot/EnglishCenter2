# HANDOFF STATUS — LumaOS Stage 01/02

**Snapshot date:** 2026-11-07 (Asia/Bangkok). Evidence comes from the user's WSL2/Docker/Chrome run and code files in delivered Stage 02 ZIP. This snapshot is not a substitute for `git status`, current local code or fresh tests.

## Product/repository identity
- Product: **LumaOS – Education Cloud**, SaaS multi-tenant CRM + LMS + Finance + BI cho trung tâm NN.
- Dev stack: NestJS/TypeScript + Prisma 6 + PostgreSQL 16 + Next.js 16/React 19 + Keycloak OIDC 26.8.1 + Docker Compose.
- User works on Windows/Ubuntu WSL2, project extracted under a OneDrive/Desktop path with Vietnamese characters/spaces, and runs commands in Ubuntu. **Always quote paths**, use repo-relative commands, consider moving to Linux filesystem for npm/build performance if needed (with backup and user consent).
- Tenant A and B are **synthetic demo organizations**. Browser login tested with `demo-a`; separate `demo-b` used for cross-tenant tests.

## What was observed actually working (on user's computer)
1. Docker Desktop engine reachable from Ubuntu (`docker ps`), Node 22, npm 10, Python 3.
2. PostgreSQL service accepted connections; roles were created. Prisma/backend/frontend checks progressed to completion in integration script.
3. `verification/run_local_full_e2e.sh` after local script fix printed `PASS: Stage 02 PostgreSQL, Prisma, RBAC/RLS and frontend build checks`, but stopped at `BLOCKED: Backend failed to start`. Later `node dist/main.js` running in an active session and `curl http://localhost:3001/health/live` returned HTTP 200. The original runner's backend startup failure was **not yet conclusively root-caused**; port 3001 had EADDRINUSE on a subsequent launch, so duplicate processes likely played a role.
4. `verification/api_e2e_smoke.py` with `ALLOW_DEMO_E2E=true` printed **46 PASS checks** and a final `PASS: authenticated OIDC JWT, tenant isolation, Lead→QL→Care→Check-in→Customer 360, and negative cases`. Checks included OIDC both demo accounts, 401 unauthenticated, Tenant A/B cross-read denial, source create, Lead NEW→QL, activity log, Check-in completion, Customer 360, duplicate completion denied, and public QR disabled.
5. Chrome opened `http://localhost:3000` and successfully completed OIDC login as `demo-a`. Tenant A CRM Lead & QL screen loaded and displayed demo records, with `API LIVE` indicator.
6. A **browser UI bug was observed**: in New Lead form, typing one character into name/contact/phone moved focus to modal X button. A patched `frontend/components/ui.tsx` was provided, but **no screenshot/test confirms it was installed or fixed locally**.

## Current issues, not hidden
| ID | Issue | Priority | Evidence / proposed action |
|---|---|---|---|
| BUG-UI-001 | Modal focus jumps to X on each keystroke | P0 | Original `useEffect` in `frontend/components/ui.tsx` depends on unstable `onClose`; patch removes that dependency, focuses `.modal-body` input and retains handler in ref. Confirm local file and browser regression before closing. |
| QA-001 | `verify_stage02.mjs` loads TypeScript from hard-coded `/opt/nvm/versions/node/v22.16.0/...` | P0 | User locally patched with `sed` to `../backend/node_modules/typescript` and reran static tests PASS. Make script portable via `createRequire` and module resolution; test across Node 22/working directories. |
| QA-002 | Full-run backend startup sometimes `BLOCKED`; port 3001/3000 already in use | P0 | Backend manual curl 200; next start got EADDRINUSE. Inspect PID/log/process lifecycle and runner readiness; don't kill unrelated processes or erase data. |
| QA-003 | Keycloak demo user imported without email; OIDC direct grant returns `Account is not fully set up` | P1 | `demo-a`, `demo-b` fixed manually in Keycloak Admin via synthetic email; later 46 E2E PASS. Fix generator/import to make clean fresh installs pass without UI edits; never weaken production auth. |
| QA-004 | UI browser E2E not automated | P1 | Manual Chrome shows login/menu/leads; test New Lead form, QL, care, check-in, Customer 360 and keyboard focus. Can adopt Playwright after reviewing dependencies. |
| SEC-001 | `npm install` reported 14 vulnerabilities (4 moderate, 10 high) in backend dependencies during test | P1 before production | Triage via `npm audit --json` (redact where needed); upgrade cautiously and lock dependencies. Avoid `npm audit fix --force`. |
| SEC-002 | Temporary Keycloak admin warning | P1 before production | Fine for isolated disposable local test only; production admin/identity hardening required. |
| PROD-001 | Public QR form disabled by default pending consent, anti-abuse and privacy review | Blocker for QR release | Keep `PUBLIC_INTAKE_ENABLED=false`. |

## Status boundaries
- **Stage 01–02 automated API smoke:** PASS on user machine, 46 checks from one run.
- **Database/RLS:** integration runner reported PASS (review logs and exact SQL for final certification).
- **Browser:** OIDC login, Tenant UI, CRM list observed. **Full browser UAT not complete**.
- **Security:** demo-only; not production-ready, not approved for real minor/customer personal data.
- **Stage 03:** **NOT implemented** in delivered repository. Logical ERD describes future target, not existing migrations.

## Historical docs note
Older README/verification docs say `BLOCKED: runtime cannot run` because they were written before the user's 2026-11-07 machine tests. This file supersedes those **status statements**, not their commands or rules. Codex should update stale status notes only after obtaining current evidence.

## Next owner action
Work through `NEXT_TASKS.md` in order. The next engineering change is to inspect local modifications and repair/verify Modal focus, then make scripts and test realm reproducible. Do not start pricing engine until regression gates are green.
