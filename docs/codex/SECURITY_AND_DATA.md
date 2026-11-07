# SECURITY & DATA CHECKLIST

## Trust boundaries
- Keycloak OIDC verifies JWT issuer, audience and signature on backend; browser uses auth code + PKCE and `HttpOnly` session cookie. Never assume frontend claims confer access.
- Every tenant-bound request checks tenant membership, role/permission, active assignment, branch scope and target object ownership. DB RLS is second line; backend enforces intent.
- Composite foreign keys enforce tenant consistency for child→parent relationships. No cross-tenant joins or direct IDs from other orgs.
- Audits append-only with actor, effective time, object, diff and action; no secrets or sensitive raw phone payload in log.
- PII masking on list/detail absent `pii.read_sensitive` while ensuring write/read decisions server-side.

## Test matrix (minimum)
1. Anonymous API request denied (401) except explicitly public route (currently disabled).
2. Tenant A token on Tenant B resource denied (403/404); reverse as well, including direct guessed IDs.
3. Branch-scoped users cannot view/assign/write outside scope.
4. No self-grant/elevation to admin through membership/permission APIs.
5. Cannot reassign lead to unauthorized branch/staff.
6. No ghost duplicate profile from shared phone, no raw phone exposure to unauthorized actor.
7. Same check-in completed twice: second rejected and no duplicate profile/entitlement.
8. Different tenant's branch ID rejected both application and DB FK.
9. Bad/stale `rowVersion` rejected with conflict, preserving history.
10. Direct grant client only test; production login hardening, security headers, session revocation, CSRF protection, MFA admin, CORS boundaries to be reviewed.
11. Public intake remains off until tenant-specific consent and privacy requirements plus rate limiting, abuse monitoring and retention/deletion are built/tested.

## Special case: minors and guardians
No real pupil/parent data in dev. Parent may share phone with siblings; no auto identity merge. Define retention, access logs, consent basis and operational export/deletion with legal review for each tenant before production rollout.

## Security release blockers
- Dependency audit (backend reported 14 vulnerabilities on first install); review and pin approved versions.
- Temporary Keycloak admin shown in local environment; do not use in any shared or deployed environment.
- Full real browser E2E/IDOR test for protected data.
- Backups, restore drill, monitoring, abuse prevention, TLS, support access grants, data deletion/export.
- Credential file handling: `.env.test`, `.env`, `.env.local` gitignored; never expose through stdout or PRs.
