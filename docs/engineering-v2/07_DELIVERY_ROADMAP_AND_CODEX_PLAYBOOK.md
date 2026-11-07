# 07 — Delivery Roadmap & Codex Playbook

**LUM-ENG-DELIVERY v2.0.** Stages below describe planned implementation, not code already delivered.

## 1. Baseline: what actually exists
- Stage 01 Core and Stage 02 CRM/Customer 360 source is on the user's local WSL workspace; it has not yet been verified as synchronized to this repository.
- On the user's machine, authenticated Stage 02 API E2E reported 46 PASS, OIDC demo A/B and Lead → QL → Care → Check-in → Customer 360; Next.js UI displayed in Chrome.
- Remaining Stage 02 issues: focus jumps to modal X when typing (patch handed off, installation unverified); hardcoded TypeScript checker path in packaged source; E2E runner startup/port conflicts; fresh Keycloak demo users needed manual email profile changes.
- **Do not report Stage 02 UAT or commercial production readiness complete** on the basis of API smoke alone.

## 2. Dependency ordering
Stage 01 SaaS Core → Stage 02 CRM/Person → Stage 03 Catalog/CSBH/Quote → Stage 04 Contract/Receivable/Payment → Stage 05 Class/Sessions/Entitlements → Stage 06 Student Operations → Stage 07 Test/Trial/Academic/CSKH → Stage 08 Refunds/Fee Transfer/BI → Stage 09 Marketing Integrations/Portal/Commercial SaaS.

This is logical dependency, not a ban on smaller vertical slices. Some Stage 07 test functions can be developed earlier after defining prerequisite contracts.

## 3. Increment roadmap
| Stage | Increment A | Increment B | Increment C | Signoff |
|---|---|---|---|---|
| Stage 02 stabilization | Modal focus + regression | runner + fresh Keycloak realm | Browser UAT | G3 |
| 03 | Product/package/version | Pricebook/CSBH evaluator | Quote + approvals + PDF | G3 |
| 04 | Contract snapshot/signature | Receivable and payment intent | posting + reconciliation | G3 |
| 05 | Class/teacher/schedule | Enrollment + entitlement | attendance + ledger | G3 |
| 06 | Transfer preview & approval | effective-date execution | reserve/exit/resume | G3 |
| 07 | Test forms/attempts/grading | Trial and academic activity | monthly report/CSKH/renewal | G3 |
| 08 | Refund quotation/payout | fee transfer | BI snapshots/alerts | G3 |
| 09 | Meta/Zalo/Ads connectors | guardian portal | SaaS subscription, hardening, pilot | G4 → G5 |

## 4. Codex step-by-step procedure
1. Read AGENTS.md, CODEX_START_HERE.md, docs/codex/HANDOFF_STATUS.md, the engineering-v2 README and target Stage specification.
2. Inspect the **actual local source**, git status/branch, migration history and tests. Do not assume documentation proves an endpoint exists.
3. Create impact map: UI, API/DTO, business service, Prisma/SQL migration + RLS, seeds/fixtures, security, audit/event, report, test and rollback.
4. Register all open ADR decisions before finalizing a policy; propose options to product owner. Reversible feature-flag defaults only if explicitly labeled.
5. Build small complete vertical slice on feature branch with state machine and audit.
6. Test deterministic Golden fixtures, service/API/DB/RLS, cross-domain integration, negative scenarios and actual browser UAT.
7. Report changed files, commit/PR, migration and rollout risks, exact test outputs, untested features, unresolved ADRs.
8. Seek UAT approval, update handoff status, then merge. Do not assert production readiness without security/recovery/legal evidence.

## 5. Git and CI policy
- Keep main stable; branches by slice: feat/stage03-catalog, feat/stage03-pricing, fix/stage02-modal-focus.
- Protect main after source sync. Prefer reviewed Pull Request, no force push or overwriting local uncommitted work.
- Prisma migrations sequential; prevent conflicts. CI should build/typecheck/test, validate OpenAPI, RLS and Golden cases.
- If a Codex GitHub App returns 403, use safely authenticated Git CLI by owner; do not paste access tokens into chat.

## 6. Environments and shipping gate
- Local: synthetic demo only, repeatable migrations/seed.
- Staging: isolated credentials, fresh Keycloak, tenant A/B, simulated integrations; run UAT.
- Pilot: only with approved consent/privacy/legal/security and trained operators.
- Production: require G5 signoff, encrypted backups with restore drill, incident monitoring, quota billing, least privilege, data export/retention, rollout and rollback plans.

No arbitrary calendar deadline is inferred. Measure work from current source quality and actual test evidence.

## 7. Immediate next task
Safely sync current Stage 01/02 source from local Windows/WSL into GitHub (exclude secret env files, node_modules, .next, dist, logs, test credentials, Keycloak generated secrets), then fix Stage 02 focus regression, test-runner ports and fresh Keycloak demo provisioning. After acceptance, start Stage 03 with reviewed pricing ADR and Golden cases.
