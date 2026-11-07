# LumaOS Engineering Specification v2.0

**Status:** Complete draft specification for Stage 03–09, published 2026-11-07. **Engineering specification completed ≠ software implemented or production-ready.** Business ADRs in 08 remain pending owner approval.

**Product:** LumaOS, commercial multi-tenant CRM+LMS SaaS for language centers. Data remains connected across lead → qualified lead → check-in → test/trial → quote/contract/payment → classes/attendance/learning → CSKH/renewal/exit. Independent tenants and multiple branches, tenant-customizable policies, contextual actions and server-authorized APIs.

## Reading order for Codex
1. Repository AGENTS.md and CODEX_START_HERE.md.
2. docs/codex/HANDOFF_STATUS.md and docs/codex/PRODUCT_AND_WORKFLOWS.md: actual Stage 01–02 handoff.
3. THIS file and docs/engineering-v2/00_CODEX_IMPLEMENTATION_PROMPT.md.
4. 01_DOMAIN_AND_DATA_CONTRACTS.md and 02_API_CONTRACTS.md.
5. 03_UI_UX_USER_FLOWS.md and 04_BUSINESS_RULES_AND_GOLDEN_CASES.md.
6. 05_SECURITY_TENANT_RLS_AND_PRIVACY.md; 06_ACCEPTANCE_TEST_MATRIX_AND_DOD.md.
7. 07_DELIVERY_ROADMAP_AND_CODEX_PLAYBOOK.md and 08_OPEN_DECISIONS_ADR.md.
8. Specific stage PRD and reference Master PRD/ERD/permission matrix.
9. Inspect live source/Prisma/migrations/API before editing; **design specs are proposals for future implementation**.

## Document inventory

| File | Scope |
|---|---|
| 00_CODEX_IMPLEMENTATION_PROMPT.md | Exact handoff prompt for Codex |
| 01_DOMAIN_AND_DATA_CONTRACTS.md | Domain ownership, tenant ID/FKs, RLS, migrations and data lineage |
| 02_API_CONTRACTS.md | Planned REST routes, payload/error contract, idempotency |
| 03_UI_UX_USER_FLOWS.md | Module screens, user journeys, accessibility and focus/validation |
| 04_BUSINESS_RULES_AND_GOLDEN_CASES.md | Pricing, lesson, finance and BI invariants + golden tests |
| 05_SECURITY_TENANT_RLS_AND_PRIVACY.md | OIDC/RBAC/RLS, consent/PII, testing and production gates |
| 06_ACCEPTANCE_TEST_MATRIX_AND_DOD.md | Stage UAT matrix, test pyramid, G0–G5 signoff and DoD |
| 07_DELIVERY_ROADMAP_AND_CODEX_PLAYBOOK.md | Slice-by-slice delivery and Git/CI workflow |
| 08_OPEN_DECISIONS_ADR.md | Confirmed rules and decisions awaiting owner approval |
| stages/STAGE_03_PRODUCT_PRICING_QUOTE.md | M05/M06 plus pricing, promotion and quotes |
| stages/STAGE_04_CONTRACT_COLLECTIONS.md | M07/M08 baseline contract, receivable, payment |
| stages/STAGE_05_CLASSES_ATTENDANCE_ENTITLEMENT.md | M09/M10 classes, attendance, entitlement ledger |
| stages/STAGE_06_STUDENT_OPERATIONS_WORKFLOWS.md | M12 transfer, reserve and stop study |
| stages/STAGE_07_ASSESSMENTS_TRIAL_ACADEMIC_CSKH.md | M04/M11/M13 test, trial, homework, reports, renewal |
| stages/STAGE_08_FINANCE_ADJUSTMENTS_BI.md | M08 advanced/M15 refunds, transfers and BI |
| stages/STAGE_09_INTEGRATIONS_PORTAL_SAAS_OPERATIONS.md | M16 and SaaS commercial integration, portal and ops |

## Completeness declaration
**Available in draft:** Each of 7 Stage PRDs includes outcome/actors, UI journeys, proposed entities/constraints, business workflows, backend API proposals, approval/security rules and acceptance tests. Cross-cutting documents supply shared data/API/UI conventions, calculation golden cases, security, DoD and roadmap.

**Not yet deliverables of this documentation task:** OpenAPI machine-readable specs for each endpoint, final signed ADR choices/price tables, UI high-fidelity Figma/wireframes, actual Prisma Stage 03+ migrations, implemented backend/frontend, CI, browser tests, production certificate or provider authorization. These are explicit engineering work items for Codex and product owner, not silently treated as done.

## Authority and change control
- Current Stage 01/02 Prisma/SQL/backend contracts prevail for actual implemented routes/schema.
- New endpoint paths/models in v2.0 are **proposed** until review; do not break current APIs without reviewed migration.
- Product-owner approved business ADR and signed UAT take precedence over illustrative fixtures. Conflict requires explanation/ADR.
- Make improvements through reviewed commits/PRs and update this version + affected tests together.
- No secrets/PII in repo. Stage 01/02 local code must still be synchronized separately. **Do not claim production-ready from documentation.**

## Next integration action
Synchronize existing code safely, close Stage 02 UAT/focus, stabilize runner/Keycloak, then implement Stage 03 in small gated vertical slices with tests and product-owner pricing ADR signoff.
