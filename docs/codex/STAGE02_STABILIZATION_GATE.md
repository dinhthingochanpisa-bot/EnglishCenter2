# Stage 02 Stabilization Gate — evidence and remaining sign-off

Date: 2026-11-07. Source baseline: `9f48770`; latest main documentation reviewed at `40e138d1dde08d3f95befa73f22572407e96ae41`.

Status: **IN PROGRESS; not signed off. Stage 03 implementation has not started.**

All 17 Engineering v2.0 documents were read, including Stage 03, API contracts, business/golden rules, acceptance matrix and ADR-201–223. Missing v2 documents were added locally without replacing existing source. No database reset, migration reset, volume deletion or production-policy change was performed.

## Changes

- Modal: retain the existing stable-effect patch; add visible/enabled focusable controls, Tab/Shift+Tab wrap, focus containment, topmost-dialog handling, Escape and restoration to connected launcher. Empty dialogs can receive focus.
- Runner: preflight ports before generating credentials, starting Compose or migrating; reject occupied ports by default; explicit reuse verifies recognizable LumaOS health/OpenAPI/session/UI. Owned process groups only are stopped. Reused processes are never stopped. Exact revision of reused services is not certified by HTTP health.
- Keycloak: synthetic email, complete names, empty requiredActions, non-temporary passwords. Stable default realm subjects preserved; isolated test-realm subjects are deterministic and distinct, avoiding global Keycloak user-ID collisions.
- API suite: concurrent completion, single guardian/audit effects, mismatch rejection, append-only first attribution, invalid JWT, stale versions and tenant audit isolation.
- Browser suite: actual Chrome via CDP with isolated profile, real OIDC login, continuous typing, keyboard wrap/Escape/restore, offline error/input retention, Lead→QL→care→Check-in→360, logout and tenant-B denial. Uses installed browser and Node; adds no npm dependency. Profile/cookies are never uploaded.
- CI: npm ci, CRM seed and RLS tests, local regression suites, dependency audits, complete Docker/OIDC/browser job and sanitized selected evidence.

## Local observed evidence

| Check | Result | Command / evidence |
|---|---|---|
| Static | PASS 15/15 | `node verification/verify_static.mjs` |
| Isolated logic | PASS 9/9 | `node verification/verify_logic.mjs` |
| Stage 02 source/schema/rules | PASS | `node verification/verify_stage02.mjs` |
| Backend build | PASS | `node backend/node_modules/typescript/bin/tsc -p backend/tsconfig.build.json` |
| Frontend typecheck | PASS | `node frontend/node_modules/typescript/bin/tsc --noEmit -p frontend/tsconfig.json` |
| Authorization, assignment and runner regression | PASS 11/11 | `node --test verification/authorization.test.mjs verification/assignment.test.mjs verification/service_lifecycle.test.mjs` |
| Generator unit tests | PASS 5/5 | `python verification/test_realm_generator.py` |
| Live API | PASS 69/69 | `python verification/run_live_acceptance.py --fresh-realm`; `verification/artifacts/stage3-gate/api-e2e.log` |
| HTTP OIDC | PASS 13 | Same command, `oidc-http.log`; not browser evidence |
| Fresh realm direct login | PASS | Separate realm `lms-demo-gate-03850adae303`; both accounts authenticate without manual email changes; `fresh-realm.log` |
| Existing port handling | PASS | Default preflight correctly returns BLOCKED without stopping 3000/3001; explicit reuse recognizes current stack |
| Actual browser on this machine | BLOCKED | Automatic approval review rejected launching Chrome: sandbox approval required but disabled in this session. Added suite is syntax-checked; execution requires CI or an enabled browser environment |
| npm audit backend + frontend | BLOCKED | Both actual audit requests failed reaching npm advisory endpoint. No current vulnerability count or safe upgrade is asserted |
| Native Windows Prisma/build/SQL | BLOCKED | Missing Windows native binaries / restricted download and Docker/WSL access as previously recorded; CI must provide current integration evidence |

The first separate-realm test failed HTTP 409 because default subjects already existed in the running Keycloak database. Isolated test-realm subjects were namespaced; the fresh realm test was then rerun and passed. Existing `lms-demo` identities were not changed. The aggregate log from the earlier failed attempt must not be mistaken for the latest fresh-realm result; inspect the individual rerun log.

## Acceptance traceability (implemented Stage 02 contract)

| IDs from docs/ACCEPTANCE_TESTS.md | Evidence / status |
|---|---|
| CRM-01 | PASS live API cross-tenant reads/writes, guessed person ID and audit denial |
| CRM-02 | PASS service-unit branch scope; dedicated restricted-user browser/API fixture still required for full integration sign-off |
| CRM-03–07 | PASS live API siblings, NEW/QL, first qualification, invalid transition and stale version |
| CRM-08 | PASS live concurrent completion: one success, one 409, one guardian link and completion audit |
| CRM-09 | PASS live lead/person mismatch; independent direct SQL constraint evidence remains separately required |
| CRM-10 | PASS missing required completion fields rejected |
| CRM-11–13 | BLOCKED for enabled QR acceptance; feature intentionally stays disabled. No public QR activation was performed |
| CRM-14–16 | PASS live phone masking, audit isolation and preserved first attribution with appended touches |
| CRM-17–18 | Permission/assignee service-unit regression added; dedicated restricted-user API/browser cases remain to certify integration |
| CRM-19 | PASS disabled QR returns 503 |
| CRM-20 | Browser offline-error/input-retention case added; actual execution pending |

## Gate and Stage 03

Do not open Stage 03 on the strength of API counts alone. Remaining: actual browser results, clean-environment SQL/RLS/build evidence, successful current dependency audit/triage, restricted-role integration coverage, decisions for QR-disabled scope and product-owner UAT sign-off (G3).

Only after the gate is met, produce the Stage 03 Implementation Plan from Engineering v2.0: Catalog→Pricing→Quote/Approval slices, additive migrations/RLS, OpenAPI 3.1, typed clients, decimal golden fixtures, immutable snapshots, rollout and rollback.

Pricing decisions to present before code: ADR-201 (precedence/stacking/cap), ADR-202 (voucher phase/reservation/expiry), ADR-203 (rounding/tax/freeze point), and ADR-223 (approval separation/thresholds/delegation). No choice is approved by this report; no percentages, rounding mode or commercial defaults were introduced.

## Re-run and rollback

```text
node --test verification/service_lifecycle.test.mjs verification/authorization.test.mjs verification/assignment.test.mjs
python verification/test_realm_generator.py
python verification/run_live_acceptance.py --fresh-realm
node verification/browser_e2e.mjs
```

For a fresh isolated CI machine: `RUN_BROWSER_E2E=true bash verification/run_local_full_e2e.sh`.
For already-running demo services: `bash verification/run_local_full_e2e.sh --reuse-services` (no infra/bootstrap/reset; API suite creates synthetic records).

Rollback uses a revert commit for these source/test changes. No schema migration was added; do not roll back/reset data or delete volumes. Newly created test realms are retained, not deleted. Private env and artifacts remain ignored.
