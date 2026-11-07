# Reference index and precedence

## Which information wins?
1. **Current local repository + passing tests + explicit product-owner decisions** are primary. If conflict, do not guess: report and record an ADR.
2. `AGENTS.md` — Codex safety and process rules.
3. `docs/codex/HANDOFF_STATUS.md` — 2026-11-07 observations (newer than archival runtime note).
4. `docs/codex/PRODUCT_AND_WORKFLOWS.md`, architecture and security docs — consolidated intent.
5. `docs/API_STAGE02.md`, `docs/STAGE02_ERD.md`, backend Prisma/schema/source — specific implemented contract.
6. `docs/codex/reference/*` — historical conceptual large-scope specs and future intent; not necessarily implemented.

## Files included
- `Master_PRD_LMS_CRM_SaaS_v1.md`: feature/roadmap, Domain DoD.
- `ERD_v1.md`, `ERD_diagrams.md`: 136-table target conceptual ERD, 11 domains.
- `Permission_Matrix_v1.md`: role design, approval SoD.
- `State_Machines_v1.md`: workflow transitions.
- `ADR_open_decisions.md`: older decision set.

The current developer may choose to migrate this collection into a `docs/specs/` hierarchy later, but never remove/overwrite reference docs without showing diff.
