# Stage 09 — Meta/Zalo/Ads Integrations, Parent Portal, SaaS Subscription & Production Hardening

**Spec LUM-ENG-09 v2.0-draft · M16 + platform M01/M14 production**. Requires stable Stage 01–08 domain contracts. Integrations are **provider-dependent**, not blanket feature guarantees. Deployment is gated on privacy/security legal and operational sign-off.

## 1. Scope/roadmap slices
9A. Lead/channel adapters and consent → 9B. Guardian/student portal → 9C. SaaS subscription/billing/entitlement → 9D. production readiness (security, DR, ops, migration and support). Each slice has independent release gate and feature flag; do not release them as one monolith.

## 2. Integrations with marketing channels
### Provider requirements
- **Facebook Page/Meta:** tenant-level OAuth and Page authorization, provider approved scopes, webhook verify token/signature check, subscriptions to available events; preserve provider lead IDs, Page IDs, form/campaign/ad parameters, first/latest touch, consent text/time, raw payload hash. Actual read permissions and app review depend on Meta approval.
- **Zalo Official Account:** provider-compliant OA connection, supported lead/message event/API availability, user consent & messaging limitations, webhook signature/token checks where supported; do not assume access to personal chat/phone unless granted.
- **Google Ads:** campaign/source attribution via signed import/API according to actual available account privileges, UTM and GCLID where consent permits; attribution not equal conversion eligibility.
- **School/Event/KHGT/CTV/Walk-in:** manual/CSV staged imports, dedup preview, referral links and associated customer conversion attribution; offline sources maintain provenance.

### Adapter flow
Tenant Admin → Integrations → Connect → provider OAuth → store encrypted refresh/access credentials in secret manager → select branch and source mapping → verify webhook challenge → test sample lead → enable → monitor errors/reconciliation. Incoming provider events:
\`\`\`text
webhook gateway
  → verify signature/timestamp/tenant routing
  → append raw immutable event + provider unique key + consent metadata
  → async outbox/queue, ack fast
  → adapter normalize and dedupe
  → source mapping + person match suggestion (NOT automatic guardian merge)
  → create/update crm_lead, crm_lead_touches
  → assign/notify permitted staff and audit
\`\`\`
Webhook ack never claims downstream CRM commit unless provider contract supports it. Replay idempotent, retries exponential with dead-letter queue; encrypted payload PII retention policy. Dedup ID by (tenant, provider, account/page, external_event_id), distinguish re-delivery vs new inquiry.

### Proposed schema
\`integration_connections\`, \`integration_account_links\`, \`integration_oauth_grants\` (secret refs only), \`webhook_subscriptions\`, \`integration_webhook_events\`, \`integration_delivery_attempts\`, \`integration_dead_letters\`, \`integration_source_mappings\`, \`import_batches\`, \`import_rows\`, \`external_identity_links\`, \`consent_records\`, \`integration_sync_checkpoints\`.

### Provider API proposal (\`/v1/tenants/:tenantId\`)
| Route | Scope |
|---|---|
| GET/POST \`/integrations/connections\` | integration.read/manage, branch-scope |
| POST \`/integrations/:provider/oauth:start\` | CSRF state + short-lived challenge |
| GET \`/integrations/:provider/callback\` | server-only state/nonce validation |
| POST \`/integrations/connections/:id/test\` | integration.manage, safe sample |
| POST \`/integrations/connections/:id/disable\` | revoke/disable secrets and intake |
| GET \`/integrations/connections/:id/events\` | masked event logs |
| POST \`/integrations/events/:id/replay\` | privileged audited reprocessing |
| POST \`/imports\` | staged CSV/Excel upload, mapping, validation; integration.import |
| POST \`/imports/:id/commit\` | review conflict report, approved staging commit |
Public signed webhook ingress route must use provider signature and event timestamp; cannot use only untrusted query \`tenantId\`.

## 3. Parent/student portal
- Parent identity created only through verified invitation plus Student-Guardian relationship and role-based scoped claim; guardian may have multiple children. Do not grant any other child's records merely because same phone number.
- Student/parent portal READ ONLY for published monthly reports, test results approved for release, class calendar/attendance policy, remaining sessions, invoices/payment notices authorized by policy; request changes (contact, meeting, consent) go to staff review queue, not direct mutation.
- Parent receives bounded notifications (report published, important absence, payment notice, renewal reminder) according to opt-in/communication preferences.
- Never expose other guardian’s phone, raw teacher private notes, marketing leads, accounting ledger, internal ratings/approval notes; documents signed URL TTL and watermark policy.

**UI paths:** Invite accept → verify identity/relationship → My Students → student tile → Learning, Attendance, Reports, Payment Notice, Contact Center, Privacy. Mobile-first + accessibility + localized Vietnamese baseline.

**Models:** \`portal_accounts\`, \`guardian_portal_access\`, \`portal_invitations\`, \`portal_sessions\`, \`portal_notification_preferences\`, \`portal_document_grants\`, \`subject_requests\`, \`guardian_consents\`. Each access event audited.

**API:** \`GET /portal/me/students\`, \`GET /portal/students/:id/reports\`, \`GET /portal/students/:id/attendance\`, \`GET /portal/students/:id/entitlements\`, \`GET /portal/students/:id/payment-notices\`, \`POST /portal/students/:id/contact-requests\`, \`POST /portal/consents\`. All portal endpoints derive tenant/guardian from authenticated session and verified link, not client-input tenant ID.

## 4. SaaS commercial controls
- Platform operator creates subscription plans with feature flags/quotas/seat counts/branch caps, trial/subscription lifecycle, tenant billing; tenant admin can view own plan/usage.
- **Subscription access does not mean business data access**: platform billing role may see aggregate usage and invoice but not students by default.
- Suspension must not irreversibly lose tenant data. Define read-only mode, grace period, data export and legal retention; resumed tenant retains historic records.
- Tenant provision/upgrade/downgrade/offboard actions require audit, approvals for mass changes, idempotent jobs and partial failure compensation; ensure no multi-tenant leakage during maintenance/restore.
- Usage metering signed event stream or meter aggregation with reconciliation and retry; seat/active student/branch definitions documented; calculate quotas atomically.

**Models:** \`subscription_plans\`, \`plan_versions\`, \`plan_features\`, \`tenant_subscriptions\`, \`tenant_usage_meters\`, \`tenant_billing_cycles\`, \`saas_invoices\`, \`quota_reservations\`, \`tenant_lifecycle_events\`, \`support_access_grants\`.

**API:** \`GET /platform/plans\`, \`POST /platform/plans\`, \`POST /platform/tenants/:id/subscriptions\`, \`GET /platform/tenants/:id/usage\`, \`POST /platform/tenants/:id/suspend\`, \`POST /platform/tenants/:id/reactivate\`, \`POST /platform/tenants/:id/support-grants\`. Platform actions require strongly authenticated admin and independent approval if configured.

## 5. Automated workflow, messaging and job infrastructure
- Event outbox transactional with DB mutation; worker queue (e.g., Redis-based queue after infrastructure ADR) for reminders, scheduled transfer/resume, expiring fee alerts, report delivery, invoices, webhooks, reconciliation.
- \`job_id\`, \`tenant_id\`, \`aggregate_id\`, \`business_dedupe_key\`, \`attempt\`, \`scheduled_for\`, \`status\` and correlation ID; max attempts + backoff + dead-letter.
- Tenant-configurable templates and send windows; separate delivery logs for sent/failed/delivered/read and provider webhook receipts; retry messages must not send duplicates after confirmed external acceptance.

## 6. Security, privacy, compliance, quality gates
- Harden OIDC admin MFA, separate dev/stage/prod tenant identities, short-lived access tokens, secure httpOnly cookies, CSRF/XSS controls, content security policy, rate limiting and tenant quotas.
- Consent for personal data, minor data, marketing communications, message delivery and export deletion requests; privacy review applicable to jurisdiction and provider terms (legal validation before go-live).
- Secrets in vault, never DB plaintext; rotation/revoke/reconnect flow; webhook signature mandatory where provider supports it; public QR enabled only after anti-abuse/privacy gates.
- Files object storage with signed URLs; malware scanning; retention categories; backup encrypted/restored with tenant boundary validation; audit integrity and breach response.
- Operational SLO/SLI: availability, p95 latency, event lag, data freshness, job retry exhaustion, failed integrations, payment ledger reconciliation; values approved by product owner/operator, **not invented**.
- CI: test, lint/build, Prisma migration check, RLS on app_runtime not superuser, SAST/dependency scan, container scan, E2E, fixture rollback, SBOM where applicable.
- Pilot: two materially different tenants, independent branches, distinct policies; full UAT across Sales/Teacher/Accountant/Manager, consent and privacy docs, data migration dry-run and reconciliation, support training/onboarding, disaster recovery exercise.

## 7. API errors, invariants and negative cases
- OAuth callback with invalid state/nonce denied; signed webhook invalid/replayed stale timestamp rejected; duplicate provider event processed once.
- Revoking connection blocks subsequent sync; token failure surfaces error and next retry. Tenant cannot view provider secrets of another tenant.
- Parent A cannot request report of Child B unless verified relationship; removal of guardian link immediately revokes portal access.
- Suspended tenant cannot mutate business data except explicitly granted exports/settlements; unsuspend restores roles without duplicating data.
- Subscription quota race of two simultaneous adds cannot exceed quota; idempotent failure/retry.
- Support access time-bound, explicit tenant approval, scope limited, every access logged and easy to revoke.
- Migration and import conflict never silently overwrite existing Person/Lead; staging review generates safe match suggestions.

## 8. Release acceptance
**Integration:** signed provider test webhook produces exactly one Lead/Touch in correct branch, has precise provenance and consent; invalid signature/no provider authorization fails. Repeat delivery no duplicate; DLQ visible; connector revoked closes channel.

**Portal:** two siblings same parent are visible, unrelated child denied; private notes and other guardian data excluded; consent and report publication gate work. Mobile browser and accessibilities tested.

**SaaS:** create 2 tenants different plans, enforce branch/user quotas under concurrency, cycle billing separate from tuition fees; suspension preserves data and can recover, support grants audited.

**Production:** backup/restore drill, tenant isolation RLS and app service permissions, migration rollback strategy, security review, auth/session test, data export/delete request drill, operational dashboards + alerts, load test, policy/legal sign-off. Stage 09 exit does **not** imply release until all gates signed off.

## 9. Pending ADR
Provider available API/scopes and contract terms, service/hosting region, tenant subscription pricing/usage definition, parent portal release features and consent, data residency/retention, messaging provider business restrictions, recovery RPO/RTO and SLA/SLO. No production secrets or personal data in test docs or repository.
