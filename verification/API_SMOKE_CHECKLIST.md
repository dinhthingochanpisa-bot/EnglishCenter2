# API + UI smoke checklist after local stack is running

Preconditions: PostgreSQL 16, migrations/seed, NestJS API on 3001, Next.js UI on 3000, configured OIDC realm, two externally provisioned test users under different tenants, Platform Admin allowlist configured out of band.

| Test | Expected |
|---|---|
| GET /health/live | 200 for liveness (not auth) |
| GET /v1/tenants/<A>/branches with no JWT | 401 |
| GET /v1/tenants/<A>/branches with fake JWT | 401 |
| GET /v1/tenants/<A>/branches with valid A admin JWT | 200; only A branches |
| GET /v1/tenants/<B>/branches with valid A admin JWT | 403; never B data |
| GET /v1/tenants/<A>/me/permissions with A token | Permissions and branch scope derived from DB role assignments |
| GET /v1/tenants/<A>/roles with A admin | 200 with permissions (system role immutable) |
| POST /v1/tenants/<A>/roles with valid A admin | 2xx; role appears on reload |
| Grant unknown or non-held permission | 403/404; never privilege escalation |
| Assign custom role to staff member | Audit entry + effective role returned |
| Revoke role assignment | Role disappears from active roles; audit records revocation |
| PATCH branch with correct rowVersion | 2xx; updated rowVersion |
| PATCH same branch with stale rowVersion | 409 |
| Suspend A membership, retry A JWT | 403 |
| Suspend A tenant at platform, retry A JWT | 403 |
| GET audit logs for A | Only A's events, noneditable |
| POST frontend proxy without valid session | 401 |
| Frontend /platform with Tenant Admin login | 403 surface, no tenant list leaked |
| Frontend /t/<A>/members with A Admin | Rows from A; roles/scopes per backend |
| Frontend /t/<B>/members with A Admin | Access denied |

*Do not use test secrets in source control. Do not validate privileged APIs solely by hiding buttons.*
