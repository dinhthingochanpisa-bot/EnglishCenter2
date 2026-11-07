# Stage 01A API

All endpoints except `/health/live` require an OIDC JWT signed by the configured issuer and audience. No user-provided tenant header/body is trusted as authorization.

## Platform-only
- `POST /v1/platform/tenants` create tenant (provisioner connection)
- `GET /v1/platform/tenants` list tenants
- `PATCH /v1/platform/tenants/:tenantId` change legal/display name and status
- `POST /v1/platform/users` provision identity from trusted external auth subject

## Tenant context
- `GET /v1/tenants/:tenantId` get own tenant (active membership)
- `GET /v1/tenants/:tenantId/users` read user directory within tenant (membership.read)
- `GET /v1/tenants/:tenantId/branches` list authorized branches
- `POST /v1/tenants/:tenantId/branches` create branch (tenant-scope branch.manage)
- `PATCH /v1/tenants/:tenantId/branches/:id` update branch, optimistic rowVersion
- `GET /v1/tenants/:tenantId/memberships`
- `POST /v1/tenants/:tenantId/memberships`
- `PATCH /v1/tenants/:tenantId/memberships/:id`
- `POST /v1/tenants/:tenantId/memberships/:id/roles` assign role
- `POST /v1/tenants/:tenantId/memberships/:id/branches` assign branch
- `GET /v1/tenants/:tenantId/roles`
- `POST /v1/tenants/:tenantId/roles`
- `PATCH /v1/tenants/:tenantId/roles/:id`
- `GET /v1/tenants/:tenantId/permissions`
- `POST /v1/tenants/:tenantId/roles/:id/permissions`
- `DELETE /v1/tenants/:tenantId/roles/:id/permissions/:code`
- `GET /v1/tenants/:tenantId/audit-logs?limit=50&cursor=<id>`

Swagger UI is at `/docs`. GET responses currently use Prisma row fields (some include internal tenantId); implement response DTO minimization before production.

## Current boundaries
- Platform provisioning is operator-only; explicit `PLATFORM_ADMIN_SUBJECTS` vetted allowlist required.
- Role/system permission bootstrap is out-of-band, not available to tenant UI. Tenants cannot grant permissions they themselves lack.
- RowVersion is mandatory for updates on mutable tables supporting optimistic lock.
- Tenant-wide reads require `TENANT`-scope role; branch list can be filtered to assigned scopes.
- Global user info is looked up via restricted identity reader, never through tenant runtime credential.
