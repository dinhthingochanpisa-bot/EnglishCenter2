# NEXT TASKS — priority and acceptance criteria

## Milestone M0: Stabilize Stage 02 (do this before Stage 03)

### P0 / T-001 — Fix Modal focus bug and test end-to-end
**Symptom:** New Lead modal: typing any character in student name, contact name or phone moves focus to X, preventing continuous typing.
**Files:** `frontend/components/ui.tsx` and possibly `frontend/components/crm-console.tsx`.
**Suspected cause:** `Modal` effect depends on an inline unstable `onClose`, cleanup/re-run refocuses header X on each state update. A patch was delivered separately; inspect local file to see if user installed it.
**Accept:** Can type >=20 chars in each field without focus jump; Tab cycles logically, Esc closes, click outside behaves as designed; focus returns to launcher on close; no remount lost input; tested with real browser. Add automated regression where practical. Preserve accessibility.
**Do not:** replace entire UI or remove focus trap/close behaviors without design review.

### P0 / T-002 — Remove hard-coded TypeScript module path
**File:** `verification/verify_stage02.mjs` uses `/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js` in distributed ZIP. User fixed locally by `sed` to `../backend/node_modules/typescript` and static check passed.
**Accept:** Resolve `typescript` reliably from backend-local deps via `createRequire`/Node module resolution; works with Node 22, paths with Unicode/spaces, independent of global NVM path; `node verification/verify_stage02.mjs` passes from workspace root. Add clear error for missing deps.

### P0 / T-003 — Diagnose runner startup + duplicate port handling
**Files:** `verification/run_local_full_e2e.sh`, backend/frontend scripts.
**Evidence:** PostgreSQL/Prisma/RLS and frontend build passed, then runner reported `BLOCKED: Backend failed to start`, empty log; manual server later responded 200, second attempt failed EADDRINUSE on port 3001. Frontend port 3000 similarly already occupied while UI loaded.
**Accept:** Runner checks port ownership and clearly stops/reuses a compatible service; does not accidentally kill arbitrary processes; reports useful logs; no spurious blocked message after healthy app. Test fresh-run and running-services scenarios; no data reset.

### P1 / T-004 — Reproducible Keycloak demo users
**Files:** `verification/generate_dev_realm.py`, Keycloak imported realm.
**Evidence:** Demo A/B initially `invalid_grant Account is not fully set up`; manually adding `demo-a@example.test`, `demo-b@example.test` solved; E2E 46 PASS.
**Accept:** In a **fresh disposable** realm, test users provisioned with required minimal profile and non-temporary credentials, no manual GUI intervention; test-only direct grant retained strictly in test realm; no need to share passwords; do not reset existing user data without approval.

### P1 / T-005 — Browser UI E2E + manual UAT
**Scope:** Next OIDC callback, Tenant A selection, source list, create Lead without phone, QL after phone, care, Check-in, Customer 360; verify masked PII, invalid transitions, keyboard interactions, session timeout, errors.
**Accept:** Browser proof with clear PASS/FAIL, screenshots/logs sanitized; no real minors PII. Avoid marking complete based only on API smoke.

### P1 / T-006 — Dependencies, lockfiles and CI verification
**Scope:** Current backend npm audit reports 14 vulnerabilities (4 moderate /10 high) as observed on user's first install; separate frontend dependency scan; generate/commit lockfiles; implement safe compatible upgrades.
**Accept:** Vulnerability review with packages and severity, reasonable mitigations, both builds/typechecks/tests pass, CI reproducible; no force upgrades.

### P1 / T-007 — Error UX, validations, contextual flow improvements
**Scope:** Lead modal validation, no silent save, duplicate suggestions, care history, Check-in, CRM 360; loading state and error boundary.
**Accept:** API errors visible, form fields preserve input, no fake success, no direct DB from browser; tests for 401/403/409 and slow API.

## Milestone M1: Gate before feature development
- Run fresh PostgreSQL/Keycloak integration in synthetic-only environment and archive sanitized logs.
- Repeat 46-case API smoke, RLS read/write tests, browser UAT.
- Review actual `git diff` and `npm audit` before declaring Stage 02 pilot-ready. Clarify unresolved security blockers.

## Milestone M2: Stage 03 — Product & Curriculum + Pricing/Promotions (design then implement)
1. Create `docs/codex/stage03/PRD.md`, quote/calculation examples and approved ADR decisions; add workflow wireframe first.
2. Model Product, Program, Package, Pathway, Branch configuration, version/effective windows.
3. Pricing Engine: base CK, additive vs sequential %, vouchers before or after percentage, combinability, caps, rounding and trace. **Zero hard-coded policy rates.**
4. Quote snapshot, approval route accountant then publication to customer; payment/contract are later stages; do not shortcut.
5. Golden tests: e.g. 30M × base 10% + extra 5% additive = 25.5M vs sequential = 25.65M before voucher; voucher pre/post checks; policy version freeze; cap/overlap conflicts.
6. Cross-tenant and branch permission tests; API & frontend contextual actions; migrations with RLS.

## Task handover format
For every task: `Problem → assumptions/open ADR → impacted files → plan → tests first → code diff → command outputs → remaining risks → commit/checkpoint`. Do not start multiple high-risk domains at once.
