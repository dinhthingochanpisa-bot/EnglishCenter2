# Stage 01B UI ↔ Stage 01A API contract

| UI | Method | API | Backend permission |
|---|---|---|---|
| Platform tenants | GET | `/v1/platform/tenants` | Platform admin only |
| Create tenant | POST | `/v1/platform/tenants` | Platform admin only |
| Edit tenant | PATCH | `/v1/platform/tenants/:tenantId` | Platform admin only |
| Provision global user | POST | `/v1/platform/users` | Platform admin only; auth subject must exist in IdP |
| Bootstrap tenant admin | POST | `/v1/platform/tenants/:tenantId/bootstrap-admin` | Platform admin only |
| Tenant overview | GET | `/v1/tenants/:tenantId` | `tenant.read` (TENANT) |
| Effective permissions | GET | `/v1/tenants/:tenantId/me/permissions` | Active tenant membership |
| Branch list/create/update | GET/POST/PATCH | `/v1/tenants/:tenantId/branches[/:id]` | `org.branch.read` / `org.branch.manage` |
| Members | GET | `/v1/tenants/:tenantId/memberships` | `org.membership.read` (TENANT) |
| Member + user profile | GET | `/v1/tenants/:tenantId/users` | `org.membership.read` (TENANT) |
| Add/update membership | POST/PATCH | `/v1/tenants/:tenantId/memberships[/:id]` | `org.membership.manage` |
| Assign/revoke role | POST/DELETE | `/v1/tenants/:tenantId/memberships/:id/roles[/:assignmentId]` | `iam.role.manage`, actor cannot self-grant |
| Assign/revoke branch scope | POST/DELETE | `/v1/tenants/:tenantId/memberships/:id/branches[/:assignmentId]` | `org.membership.manage` |
| Role list/create/update | GET/POST/PATCH | `/v1/tenants/:tenantId/roles[/:id]` | `iam.role.read` / `iam.role.manage` |
| Permissions list | GET | `/v1/tenants/:tenantId/permissions` | `iam.permission.read` |
| Grant/revoke permission | POST/DELETE | `/v1/tenants/:tenantId/roles/:id/permissions[/:code]` | `iam.permission.assign` + actor must hold permission |
| Audit | GET | `/v1/tenants/:tenantId/audit-logs?limit=50` | `audit.read` |

### Deliberately absent

- Password management or direct user registration; IdP is authoritative.
- Browser-to-database or frontend Prisma.
- Platform-wide cross-tenant reporting for tenant administrators.
- Invitation acceptance, email verification, billing, student data. These require later stages.
