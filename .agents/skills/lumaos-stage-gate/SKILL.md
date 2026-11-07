---
name: lumaos-stage-gate
description: Review or close a LumaOS development stage, release gate, acceptance report, or Pull Request; verify current-commit CI evidence and product-owner UAT before approving the next stage.
---

# LumaOS Stage Gate

## Use this skill when
The task mentions Stage 02 sign-off, G0–G5, QA/readiness, CI, PR merge, "có thể sang Stage 03 chưa", UAT, a progress report, or stage acceptance. Do not treat writing a report as proof that a test passed.

## Read the authoritative evidence
1. Read repository \`AGENTS.md\`.
2. Read \`docs/codex/STAGE02_REPORT.md\` for consolidated 2026-11-08 Stage 02 evidence and \`docs/ACCEPTANCE_TESTS.md\` for CRM-01..20.
3. Read \`docs/engineering-v2/06_ACCEPTANCE_TEST_MATRIX_AND_DOD.md\`, \`07_DELIVERY_ROADMAP_AND_CODEX_PLAYBOOK.md\` and the target Stage PRD.
4. Inspect \`git status --short\`, current HEAD and branch. Never overwrite uncommitted user changes. Verify the **exact SHA** against GitHub Actions and deployed UI fingerprint before declaring anything PASS.
5. Reconcile historical reports with consolidated status; older "BLOCKED" may have been resolved in later runs, and an old PASS does not prove current HEAD.

## Verification workflow
- Prepare a matrix per requirement with ID, test type, executed SHA/environment, evidence URL/log, status **PASS / FAIL / BLOCKED / NOT_RUN**, and residual risk.
- Stage 02 safe checks from repository root (run only where dependencies are present):
  - \`node verification/verify_static.mjs\`
  - \`node verification/verify_logic.mjs\`
  - \`node verification/verify_stage02.mjs\`
  - \`node --test verification/*.test.mjs\`
  - \`python3 verification/test_realm_generator.py\`
  - \`node verification/write_source_revision.mjs\` and verify \`/api/version\` matches the running frontend
- Backend/frontend tests: run the exact \`npm test\`, \`npm run typecheck\`, \`npm run build\` scripts available under each package. Do not claim success without actual output.
- DB/API/OIDC/browser tests require a **known synthetic demo environment**. Inspect \`verification/README_LOCAL_E2E.md\`; use \`verification/run_live_acceptance.py\`, \`verification/browser_e2e.mjs\`, and existing SQL scripts only with appropriate opt-in/config. Never run schema reset/migrations against an unknown active DB.
- Verify CI jobs, not only the aggregate badge: backend and frontend audit, Postgres migrations/RLS/FK, Node build, full browser integration. Recheck if HEAD changed after a passing run.
- For manual UAT, explicitly ask product owner to verify user-visible behavior; a browser automation PASS does not constitute product-owner sign-off.
- QR: \`PUBLIC_INTAKE_ENABLED=false\`. CRM-11..13 for enabled public QR remain **BLOCKED/out of approved scope**, never PASS. A release excluding QR needs an explicit scope decision.
- Residual dependency findings: Stage 02 consolidated report lists **6 moderate** at its last local audit; query current audit if making a security decision. CI high/critical pass does not mean zero vulnerabilities.

## Gate decision
- G0 Specification reviewed; G1 implementation plus unit; G2 integrated API/DB/security tests; G3 product-owner UAT; G4 pilot legal/security/ops; G5 production approval.
- No Stage 03 implementation or PR merge based on G2 alone when owner required G3. Draft PR #1 may remain Draft until explicitly accepted.
- If a test is blocked (Playwright cannot reach localhost, Docker denied, provider unavailable), mark BLOCKED with precise environment and next action. Do not invent PASS, remove blocker, or silently narrow scope.
- Before a stage transitions: list open ADRs and irreversible business rules requiring approval. Stage 03 pricing ADR-201/202/203/223 are not yet commercial defaults.

## Output format
Provide a compact sign-off report: current source SHA, relevant CI links and job results, requirement IDs PASS/FAIL/BLOCKED/NOT_RUN, product-owner decisions required, residual security and QR risks, exact next commands, **gate decision: OPEN/CLOSED/AWAITING UAT**. Update \`docs/codex/STAGE02_REPORT.md\` only with dated evidence; never rewrite history to conceal earlier failures.
