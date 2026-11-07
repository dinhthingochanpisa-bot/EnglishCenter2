# Stage 01B — SaaS Core Frontend

Next.js 16 / React 19 / TypeScript. Tenant and Platform administration, linked exclusively to Stage 01A Backend API. All interface copy is Vietnamese.

## Navigation

- `/`: signed-in landing page; Platform Admin may view tenants, Tenant Admin can open an invitation link or enter tenant UUID.
- `/platform`: Platform Admin list/create/update tenant, provision user from verified external OIDC subject, bootstrap first Tenant Admin.
- `/t/:tenantId/overview`: tenant overview and current permission snapshot.
- `/t/:tenantId/branches`: branch create/list/edit/activate/deactivate.
- `/t/:tenantId/members`: membership list with role and branch scope; attach existing user by ID, update membership status, grant/revoke role and branch scope.
- `/t/:tenantId/roles`: create/edit custom roles; grant/revoke permissions, immutable system roles.
- `/t/:tenantId/audit`: last 50 audit records, with read-only detail.

## Security model

1. Browser goes to `/api/auth/login` and completes **OIDC Authorization Code with PKCE**.
2. Next.js server validates the ID token (`issuer`, `audience`, signature, `nonce`) and stores access token **only in encrypted HttpOnly SameSite=Lax cookie**. No access token in localStorage/React state.
3. React calls only same-origin `/api/backend/v1/*`; proxy adds Bearer token server-side, validates path, and checks Origin on mutations.
4. NestJS verifies access token, membership, permission and branch scope; PostgreSQL RLS enforces tenant context. Never use UI button visibility as authorization.
5. `me/permissions` is used only for visual affordances. Backend enforces actual permission for every request.

## Setup

```bash
cp .env.example .env.local
# edit OIDC client, APP_ORIGIN, BACKEND_URL, SESSION_SECRET_BASE64
npm install
npm run typecheck
npm run build
npm run dev
```

Configure OIDC IdP: redirect URI must equal `${APP_ORIGIN}/api/auth/callback`, grant type authorization_code, PKCE S256, scopes `openid profile email`; issue an audience-compliant access token for the NestJS backend. `APP_ORIGIN` must match actual browser Origin, HTTPS in production. Configure backend issuer/audience/JWKS separately.

`SESSION_SECRET_BASE64` must be a strong random 32-byte key, e.g. `openssl rand -base64 32`.

## Known limitations / not production-ready

- No identity invitation email flow yet. Tenant admin can attach an **existing** globally provisioned user ID; the OIDC subject must exist in the IdP. Membership `ACTIVE` is admin-controlled in Stage 01A, not a cryptographically verified invite acceptance; this needs improvement prior to public SaaS pilot.
- No refresh token mechanism; session ends at access-token expiry. Reauthentication uses IdP login.
- No pagination beyond Stage 01A backend limits (100 tenants, 200 memberships, 200 branches, 200 roles, 50 audit records).
- OIDC end-session at provider, CSRF defense-in-depth, CSP, rate limiting, MFA policy and operational monitoring need production review.
- Platform admin discovery is attempted via Platform endpoint; a Tenant Admin without platform access opens the tenant through URL/UUID.
- Backend must be deployed and connected to PostgreSQL to exercise real data. No dummy data or browser-local role model is used.
