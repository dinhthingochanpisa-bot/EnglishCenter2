# Issue #2 — Stage 02 UAT follow-up

2026-11-07. Base PR revision: `e638a9f`. G3 remains **not accepted**.

## Scope and causes

- Login: homepage requested the Platform Admin tenant list and required manual UUID entry. Added guarded `GET /v1/me/tenants`, checking ACTIVE membership inside each candidate tenant's runtime/RLS transaction. Only ACTIVE tenants are returned. Single membership enters CRM automatically; multiple memberships display names/codes; none shows access guidance. Platform operators retain their existing platform page and do not gain implicit tenant membership.
- Tenant identity: existing `code` and `displayName` are now used in the chooser and shared shell. UUID routes, database keys, composite FKs and RLS are unchanged. No migration or grant expansion.
- Focus: stable Modal effect already exists in this source and PR, so it is preserved. Added accented Vietnamese continuous-input regression and a SHA-256 source diagnostic in the header and `/api/version`. Generate with `node verification/write_source_revision.mjs` (also predev/prebuild). This fingerprint covers the six changed application files; it is not a signed deployment attestation or backend process identity.
- Details: previously rendered after the entire table. Now opens a modal immediately, displays loading/API errors, person/contact, branch/source, status, dates and care/event/source history; Escape/close restores launcher focus using shared Modal. Phone masking remains server controlled.

## Local checks

- PASS: backend TypeScript build; frontend TypeScript check; source 15/15, logic 9/9, Stage 02 schema/rules static checks.
- PASS: 14 Node authorization/assignment/membership/lifecycle regressions, including inactive membership, no membership and multiple memberships.
- BLOCKED: standard backend `npm test` exits before assertions because Windows Node/tsx fails `uv_os_get_passwd` (ENOMEM).
- BLOCKED: frontend build: npm cannot find the Linux-installed `next` shim; direct CLI confirms missing Windows SWC. Existing node_modules were not replaced.
- BLOCKED: local SQL/RLS and Python API runner: WSL `E_ACCESSDENIED`, Docker pipe access denied and Windows Python alias unavailable. These require the Linux CI job or a working WSL terminal.

## Playwright MCP evidence

Playwright MCP successfully opened `http://localhost:3000` and captured the actual UI. `/api/version` returned **404**, so that service cannot be certified as the revised source. No PASS from an older frontend is attributed to this patch. Screenshot: `verification/artifacts/issue-2/localhost-before-restart.png`; sanitized results: `verification/artifacts/issue-2/mcp-summary.json`.

| Scenario | Revised-source MCP result |
|---|---|
| demo-a auto-entry A, logout, demo-b auto-entry B | BLOCKED: source not verified |
| B cannot access A by URL/API | BLOCKED: source not verified |
| 20+ characters in all three inputs, accented Vietnamese | BLOCKED: source not verified |
| Tab/Shift+Tab/Escape/reopen | BLOCKED: source not verified |
| NEW without phone, valid phone becomes QL | BLOCKED: source not verified |
| Immediate Lead detail and close/back | BLOCKED: source not verified |
| Care activity appears in detail history | BLOCKED: source not verified |
| Check-in completion and Customer 360 | BLOCKED: source not verified |
| Offline input retention and visible error | BLOCKED: source not verified |

The existing actual-Chrome CI runner has been extended with source-fingerprint checks, both automatic tenant entries, accented input and detail-dialog assertions. API regression checks discovery 401, own-tenant-only results and friendly identity. CI evidence must be recorded separately from direct MCP UAT. OS Vietnamese IME composition and a real multiple-membership UI fixture still require dedicated browser validation.

## Rerun and rollback

1. In the existing WSL repository, synchronize the PR branch without overwriting local patches. Restart only the known frontend/backend processes; preserve PostgreSQL and Keycloak.
2. Run `node verification/write_source_revision.mjs`, backend build and frontend dev/build. Verify the header fingerprint and `/api/version` match `frontend/lib/source-revision.json`. Verify backend OpenAPI contains `/v1/me/tenants`.
3. Rerun all MCP cases above with synthetic demo credentials read locally, and retain only sanitized screenshots/results under ignored artifacts.
4. CI runs unit tests, migration/FK/RLS, both builds, API/OIDC and actual Chrome. Record the new commit/run, then request owner acceptance; keep PR Draft and Issue #2 open until accepted.

Rollback: revert this follow-up commit and restart the two application processes. No schema migration, database reset, volume deletion, main merge, Stage 03 work or public QR activation is part of this change. Discovery currently scans the identity tenant directory and checks memberships serially; larger deployments should replace this with a separately reviewed, actor-scoped discovery query without granting broad membership reads.
