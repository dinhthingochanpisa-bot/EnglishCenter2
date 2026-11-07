> **Báo cáo tổng hợp Stage 02:** [STAGE02_REPORT.md](STAGE02_REPORT.md). Nội dung bên dưới được giữ để truy vết lịch sử; xem báo cáo tổng hợp để biết kết quả mới nhất.

# Care datetime and explicit login — 2026-11-08

Both reported behaviors were reproduced with direct Playwright MCP before edits:

- Filling care follow-up with `2026-11-10T14:30` left the native input empty. The controlled `datetime-local` input received a UTC `toISOString()` value after every change. It now retains the native local value and converts once when submitting the activity API payload. Empty follow-up remains optional.
- After application logout, `/api/auth/login` silently reused the remaining Keycloak SSO session and entered demo-a. Explicit OIDC login now requests `prompt=login`, so the identity-provider credential screen is shown even with SSO. Existing authenticated application sessions remain valid; this does not globally sign out other Keycloak applications. No demo identity is hard-coded in the login route.

PKCE S256, state, nonce, encrypted HttpOnly cookies, backend authorization and tenant/branch scope remain in place. No database/schema change, realm reset, dependency installation or infrastructure restart.

Regression coverage:

- `verification/care_datetime.browser.js`: actual care modal input, retention after rerender, edit and clear; observed FAIL before the fix.
- `verification/login_reauth.browser.js`: existing-SSO browser reauthentication; observed FAIL before the fix.
- `verification/login_prompt.test.mjs`: real login route redirect/cookie behavior with only external discovery stubbed; PASS after the fix. Added to CI after frontend dependencies are installed.
- `verification/browser_e2e.mjs`: native care datetime retention, persisted follow-up instant and credential screen after logout without clearing Keycloak cookies.
- `verification/oidc_http_smoke.py`: explicit-login parameter alongside PKCE assertions.

Fresh verification: frontend typecheck and production build PASS; backend `npm test` PASS 6/6; `node --test verification/*.test.mjs` PASS 22/22; static 15/15, isolated logic 9/9 and Stage 02 schema/rules checks PASS. No CI run is claimed here.

Identity-provider characterization: forcing `prompt=login` on a diagnostic request displayed the password form even with a live SSO cookie. Keycloak remembered the username as read-only on that reauthentication screen; its native `Restart login` button then displayed an editable username field. Browser regressions cover both paths. This diagnostic modified the outgoing request only and is not claimed as a source-certified application run.

**Live post-fix verification PASS after the user restarted frontend.** `/api/version` matches the nine-file fingerprint `4dc53554b14ca76cd37edd1e1794c6aa65a72c6b4620c2cfea54f80e9a67416e`. Direct MCP care tests passed enter/retain/edit/clear and real save: local 2026-11-10 14:30 in Asia/Bangkok persisted as 2026-11-10T07:30:00.000Z in both activity and Lead follow-up (POST 201). Direct MCP login after logout displayed credentials with existing SSO, allowed switching demo-a to demo-b, and Tenant B received 403 for Tenant A CRM. Both sessions were tested through real Authorization Code + PKCE; the final app session was logged out. `node verification/browser_e2e.mjs` exited 0 with **25/25 PASS**, including full NEW→QL→care→Check-in→Customer 360 and keyboard/offline/isolation regressions. Previous stale-server attempts remain historical evidence only; browser scripts do not publish credentials or auth state. Owner G3 acceptance and enabled QR scope remain separate.

Evidence and source-only rollback copies are under ignored `verification/artifacts/care-login-fix-20261108/`. Rollback: compare for newer local edits, restore only this patch in CRM form/login route and associated verification/CI changes, regenerate the fingerprint with the prior file list and restart frontend. No data rollback required. Git metadata remains unavailable in this execution environment.
