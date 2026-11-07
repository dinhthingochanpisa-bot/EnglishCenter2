---
name: lumaos-browser-uat
description: Use Playwright MCP to reproduce, fix, and verify LumaOS login/tenant selection, Lead forms, detail views, Check-in, Customer 360 and other real browser journeys; capture UAT evidence tied to source revision.
---

# LumaOS Browser UAT with Playwright MCP

## Trigger
Use when a user reports a UI bug, requests visual/keyboard E2E, wants to accept Stage 02/03, or needs confirmation an interactive workflow works in the browser. Prefer **Playwright MCP**, which has been installed by the user for Codex; use existing Chrome/CDP runner as complementary CI regression, not as a substitute for an owner-visible check.

## Prerequisites
1. Read \`AGENTS.md\`, \`docs/codex/STAGE02_REPORT.md\`, \`docs/ACCEPTANCE_TESTS.md\`, \`docs/engineering-v2/03_UI_UX_USER_FLOWS.md\` and \`06_ACCEPTANCE_TEST_MATRIX_AND_DOD.md\`.
2. Inspect \`git status --short\` and determine current branch/commit **before any changes**.
3. Check app is running on \`http://localhost:3000\`, backend \`http://localhost:3001/health/live\`, demo Keycloak \`http://localhost:18080\`. Use the installed Playwright MCP server if it is available in this Codex session. If unavailable, report BLOCKED plus tool/config reason, not a fake MCP success.
4. Confirm running frontend revision: \`node verification/write_source_revision.mjs\` and \`GET /api/version\` fingerprint. Old process/cache can show old UI even when source is fixed. A matching frontend fingerprint does **not** attest backend code revision; separately check backend restart/logs when backend changed.
5. Use only existing **synthetic demo credentials from ignored local env**, never print passwords, cookies or tokens. Keep \`PUBLIC_INTAKE_ENABLED=false\`; do not enable QR to get a PASS.

## Primary Playwright MCP procedure
- Navigate the user's **actual running** LumaOS page with Playwright MCP tools. Inspect current page state and accessibility before clicking; don't assume a locator exists.
- Use human-visible controls (role/name/label) and keyboard actions. Prefer the MCP's browser interactions to direct DOM mutations or API shortcuts. Use direct API requests only to verify status/authorization, separate from UI evidence.
- If Codex runs in a cloud session that cannot reach the user's localhost, request an accessible local session or run the repository's CI browser runner and mark **LOCAL_BROWSER BLOCKED**. Never claim to have tested Windows UI from CI alone.
- For every defect: reproduce with screenshot/steps → isolate underlying focus/route/network/API issue → small fix → regression test → rerun on **new matching source revision**.
- Do not automatically run destructive reset or launch duplicate services; inspect ports and existing runner ownership first.

## Required Stage 02 browser scenarios
1. **Login/tenant routing**: logout; explicit login as demo-a; one authorized tenant → auto-enter without typing UUID; show human-readable tenant name/code; if multiple tenant memberships, show scoped chooser; disabled/inactive/no membership blocked appropriately. Re-authentication login prompts credentials despite prior SSO when explicitly requested.
2. **Tenant isolation**: demo-b auto-enters its own tenant; URL/API for Tenant A returns 403/404; no leaked PII in selector or detail. Confirm same results for branch-scoped roles when fixtures exist.
3. **Lead modal focus & keyboard**: click "Lead mới". Type 20+ characters in student name, contact name and phone with actual keyboard interactions; attempt Vietnamese accented text and IME composition when OS/input method supports it. Verify focused element/caret after each character, Tab/Shift+Tab wrap, Escape close, focus return to launcher, reopen without stale data.
4. **Lead lifecycle**: create Lead without phone → NEW; add valid phone → QL; do not falsely label QL as full customer; try invalid status and stale rowVersion to confirm visible error/input retained.
5. **Lead "Chi tiết"**: click first and last row; detail opens **in current viewport** as accessible dialog/drawer with correct Person/branch/source, care events, touch history and **isQualified** consistent with list; loading/error/close state usable. Phone masking by role intact.
6. **Care datetime**: open "Chăm sóc"; type/edit/delete local date and time with input keyboard; keep local value during controlled rerenders; save and verify server UTC conversion and display round-trip (e.g. Asia/Bangkok 14:30 → 07:30Z). No uncontrolled ISO normalization on every keystroke.
7. **Check-in + Customer 360**: create Check-in from Lead, complete with valid synthetic guardian/school info; 360 retains Person, guardian, lead attribution and care. No duplicate completion; trace and permission checks.
8. **Network/error states**: emulate offline/5xx or unauthorized via safe test controls; form retains data, shows API error and no fake success. Logout clears app session; re-login as different account asks to authenticate.
9. **Source and QR**: verify source selection/attribution; public QR action returns disabled 503 and status remains BLOCKED/OUT_OF_SCOPE for CRM-11..13. Do not test with real minors.

## Evidence & acceptance
- Store per-scenario \`PASS / FAIL / BLOCKED / NOT_RUN\`, timestamp, branch/commit SHA, UI fingerprint, browser/OS/viewport, actual click/type path, sanitized screenshot and relevant HTTP status. Do **not** save credentials, profile directories, session cookies, unsanitized HAR or real PII to Git.
- Add a persistent regression to \`verification/browser_e2e.mjs\` or another approved repo test if a bug was fixed; run existing unit/authorization/SQL tests when frontend change affects auth/tenant.
- Existing \`node verification/browser_e2e.mjs\` is a real Chrome/CDP script; check source and README. Its 25/25 PASS in \`STAGE02_REPORT.md\` is historic evidence, **not** proof current code passes without rerun.
- A status report must clearly distinguish **Playwright MCP run**, **Chrome/CDP CI run**, **API E2E**, and **manual product-owner UAT**. Never collapse them into one green status.
- Browser UI is accepted by the owner only after a brief manual checklist; Stage 02 G3 is not approved automatically.

## Deliverable
A concise result table for each scenario, screenshots or artifact paths (sanitized), source SHA/fingerprint, test commands/MCP interaction evidence, regressions fixed, outstanding failures and exact manual steps for product owner. If tool access is blocked, explain the environment and report BLOCKED.
