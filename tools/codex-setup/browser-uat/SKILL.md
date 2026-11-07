---
name: browser-uat
description: Run evidence-based browser UAT for LumaOS using Playwright MCP, including modal keyboard behavior, OIDC, CRM workflows and tenant isolation. Use for interactive acceptance testing and UAT reports, not API-only smoke tests or approval of product policy.
---

# LumaOS Browser UAT

Read repository `AGENTS.md`, `docs/codex/STAGE02_STABILIZATION_GATE.md`, the relevant Engineering v2.0 stage, and `docs/ACCEPTANCE_TESTS.md`. Use current source and tests to resolve stale documentation; preserve local patches.

## Browser connection and evidence

Use the configured `playwright` MCP server with an isolated browser context. Before interaction, confirm the tool connection and take a fresh accessibility snapshot. Use element references from that snapshot; refresh references after navigation, modal changes or significant rerenders. Prefer semantic browser tools over arbitrary evaluation.

For LumaOS, verify frontend `http://localhost:3000`, API health `http://localhost:3001/health/live` and test issuer `http://localhost:18080/realms/lms-demo`. Check existing services before starting any process. Do not kill an unknown process, reset the database, delete volumes or reinstall another platform's node_modules.

Use synthetic fixtures. Read demo credentials only from local ignored env files; do not echo them, include them in command strings/logs, or capture login/password screens. Keep cookies, browser profiles, authentication state and traces under ignored `verification/artifacts/`; publish only sanitized evidence. Installation of MCP does not expand filesystem, network or process permissions. If browser execution is denied, report BLOCKED and use verified CI browser evidence separately.

## Stage 02 acceptance

- Perform real Authorization Code + PKCE login as demo-a, then open Tenant A CRM. Do not substitute password-grant/API success for browser login evidence.
- In New Lead modal, type at least 20 characters into student/contact/phone fields while checking focus and input retention after each rerender. Use formatted synthetic phone input that still normalizes correctly.
- Test initial focus, Tab and Shift+Tab wrapping, Escape closing, launcher focus restoration, disabled/hidden controls, and repeated open/close. Test the actual shared Modal rather than a lookalike DOM fixture.
- Exercise Source → Lead without phone → QL → care → Check-in completion → Customer 360. Reconcile Person identity, preserved source history, masked phones and persisted server state.
- Verify visible API/offline errors preserve input; do not report success before server confirmation. Include stale version, unauthorized request, duplicate/concurrent completion and branch restrictions at their appropriate test layers.
- Use a separate isolated session for demo-b and confirm Tenant A resources are denied. Use dedicated restricted-role fixtures for branch/assignment tests; an admin-only test is insufficient.
- Keep public QR disabled. Map CRM-11–13 to an explicit scope decision or record BLOCKED; never silently enable it or mark enabled-flow tests passed.
- Check logout/session expiry and the unauthorized UI. Avoid exporting raw tokens when checking BFF requests.

The repository also has a real-Chrome regression runner: `node verification/browser_e2e.mjs`. Its results and CI run IDs are browser evidence; `api_e2e_smoke.py` and `oidc_http_smoke.py` are distinct API/HTTP evidence.

## Report and acceptance boundary

For each case record test ID, source revision, environment/browser, action, expected versus observed result, PASS/FAIL/BLOCKED, and sanitized artifact or CI run link. Separate source/unit/API/SQL/browser results. Report dependency residuals and untested cases.

Product-owner UAT sign-off is separate from automated results. Do not sign for the owner, merge, deploy, or approve pricing ADRs merely because tests pass. Once the owner accepts Stage 02 and its QR scope, prepare the Stage 03 plan and proposed ADR-201/202/203/223 choices before business implementation.
