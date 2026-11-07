# Stage 02 — direct Playwright MCP UAT

Run: 2026-11-07–08, Asia/Bangkok. **19 PASS, 2 FAIL, 7 BLOCKED. G3 remains not accepted.**

Source SHA-256: `9cbc9a1819a9b39e8c26b6bed6d2859ffda615018913bfe3a3da5190ed1860d0`. Recomputed from six files, matching `/api/version` on port 3000 and header. Backend `/health/live`: HTTP 200 `{"ok":true}`. This fingerprint is not backend process attestation. Git metadata unavailable, so commit identity/local diff cannot be certified.

Browser: Playwright MCP, HeadlessChrome 157 on Linux; separate isolated contexts for demo-a and demo-b. These are direct browser results, separate from historical CI/API results.

| ID | Case | Result | Observation |
|---|---|---|---|
| UAT-01 | Source identity | PASS | Frontend /api/version and header equal recomputed six-file SHA-256; backend /health/live 200 |
| UAT-02 | OIDC A | PASS | Authorization Code + S256 PKCE login demo-a; automatic Tenant A overview |
| UAT-03 | Source | PASS | Created synthetic source via UI and observed persisted table row |
| UAT-04 | Initial focus | PASS | First editable Lead field focused |
| UAT-05 | Continuous input | PASS | 20+ characters in student/contact/phone; focused field checked after every inserted character; exact retained values |
| UAT-06 | Accented input | PASS | Vietnamese accented Unicode input retained; no claim of OS IME testing |
| UAT-07 | Keyboard wrap | PASS | Shift+Tab first-to-last and Tab last-to-first |
| UAT-08 | Escape/reopen | PASS | Escape closes, restores launcher; reopen focuses first field |
| UAT-09 | Offline | PASS | Real browser context offline; visible alert, modal and input retained; no fake commit |
| UAT-10 | NEW | PASS | Online resubmit creates NEW lead without phone |
| UAT-11 | Detail open/close | PASS | Detail modal visible immediately, loads person/branch/source/history; Escape restores detail launcher |
| UAT-12 | QL | PASS | Formatted synthetic phone yields status QUALIFIED and isQualified=true in list response |
| UAT-13 | Care/source history | PASS | UI care save; detail shows note, CREATED/STAGE_CHANGED/QUALIFIED events and FIRST_TOUCH source |
| UAT-14 | Check-in | PASS | UI draft creation and completion; table status COMPLETED |
| UAT-15 | Customer 360 | PASS | Same person ID; CUSTOMER, original Lead CONVERTED, one guardian link and COMPLETED check-in; privacy-safe contact rendering |
| UAT-16 | Logout A | PASS | Real UI logout at desktop viewport; authenticated=false |
| UAT-17 | OIDC B | PASS | Separate isolated context, demo-b login, automatic Tenant B overview; own-tenant discovery only |
| UAT-18 | Tenant isolation | PASS | B list/Lead detail/Person with branch query return 403; A URL displays permission error and no test row |
| UAT-19 | Logout B | PASS | B logout POST 200 and authenticated=false |
| UAT-F01 | QL detail indicator | FAIL | List reports QUALIFIED/isQualified=true; detail says Chưa có SĐT hợp lệ. getLead omits derived isQualified, UI treats undefined as false. |
| UAT-F02 | Person branch validation | FAIL | Authenticated GET Person without branchId reproducibly returns HTTP 500 with generic Internal server error, expected controlled client error/authorization denial. With UUID branch query B receives 403; no tested response exposed A person. |
| UAT-B01 | OS Vietnamese IME | BLOCKED | Unicode insertion tested; native OS composition not exercised |
| UAT-B02 | Multiple membership chooser | BLOCKED | No dedicated real multi-membership fixture exercised |
| UAT-B03 | Restricted roles | BLOCKED | Dedicated branch/assignment permissions not exercised in this session |
| UAT-B04 | QR CRM-11–13 | BLOCKED | Public intake intentionally disabled; enabled flows not run |
| UAT-B05 | Additional backend regressions | BLOCKED | No stale-version, duplicate/concurrent completion, SQL/RLS, API smoke suite, unit suite or build rerun in this browser continuation |
| UAT-B06 | Session expiry | BLOCKED | Explicit logout tested; natural expiry not simulated |
| UAT-B07 | Disabled/hidden focus controls | BLOCKED | Normal live modal controls tested; dedicated disabled/hidden-control scenario not exercised |

## Reproduced findings

1. **UAT-F01 — wrong QL indicator in Lead detail.** Create NEW without phone; change to QUALIFIED with a valid phone; open detail. List says QL; detail says “Chưa có SĐT hợp lệ”. `backend/src/crm.service.ts:getLead` returns the raw Lead plus masked contactPhone but no derived `isQualified`; `frontend/components/crm-console.tsx` expects that property. No fix applied during UAT. Evidence: `lead-detail.png`.
2. **UAT-F02 — missing branchId produces 500.** Authenticated GET `/api/backend/v1/tenants/{tenantA}/crm/persons/{syntheticPerson}` without branchId returns 500 “Internal server error”, reproduced twice. `getPerson` calls `uuid(branchId)` on an absent query argument. With a UUID branch query, Tenant B receives 403 and no A person data. This is an error-handling finding, not observed cross-tenant disclosure.

## Evidence and test limits

Sanitized artifacts are under ignored `verification/artifacts/issue-2/uat-20261107/`: `browser-results.json`, `offline-modal.png`, `lead-detail.png`, `customer-360.png`, `tenant-b-denied.png`. Earlier REPORT.md/results.json describe the previous blocked attempt; browser-results.json is the newer run. Screenshots are scoped to test modal/detail or denied page and contain synthetic names/masked contacts; no login screenshot, cookie, password, token or raw network capture is included.

Two exact-text waits were too strict (QL suffix and care paragraph metadata); actual UI and persisted API projections confirmed those operations. An initial logout click was outside viewport; real UI logout passed after desktop resize. One diagnostic Person fetch used a guessed branch and failed; fetching the real own branch then confirmed the same Person ID and one guardian. These harness errors are not hidden as application failures.

Existing test fixtures retained: source MCP_UAT_20261107_1700, Lead 885db692-57cc-4aba-894a-bbfe9d0efd67, Person 8bb5bc7e-30b2-4405-9ceb-e7bf10470d48. Source→Lead→care→Check-in writes were synthetic and additive. No automatic data cleanup.

## Changes, deployment and rollback

This continuation adds only this report and ignored evidence; no application code/schema change, migrations, resets, seeds, PostgreSQL/Keycloak stop or main merge. Frontend was restarted by the user; both browser app sessions were logged out and temporary credential helpers exited. No deployment change to roll back. Report rollback is removal of the newly added report; keep historical evidence and synthetic records unless explicitly authorized otherwise. No production-readiness or owner acceptance claim.
