# Stage 02 – Acceptance / regression gates

| ID | Scenario | Expected |
|---|---|---|
| CRM-01 | Tenant A calls Tenant B CRM API | 403/404 and no private data |
| CRM-02 | Branch-scoped sales opens another branch lead/person | 403/404 |
| CRM-03 | Create two siblings with same guardian phone | Two Person profiles; no silent merge |
| CRM-04 | Create Lead without phone | Lead = NEW, QL=false |
| CRM-05 | Add normalized contact phone | qualified_at set once, QL=true |
| CRM-06 | Change Lead status without allowed edge | 400, no stage event |
| CRM-07 | Staff updates stale Lead rowVersion | 409, no lost update |
| CRM-08 | Two staff complete same Check-in concurrently | Only one success; one conflict |
| CRM-09 | Completed Check-in uses mismatched Lead/Person/Branch | Rejected by backend and DB trigger |
| CRM-10 | Walk-in with missing required school/DOB/guardian | Cannot complete Check-in |
| CRM-11 | Create QR and submit twice | One successful provisional submission; second rejected |
| CRM-12 | QR sent from existing Lead | Staff review reuses same person_id |
| CRM-13 | QR submitted name differs from linked Lead | Rejected for manual identity review |
| CRM-14 | Viewer without pii.read_sensitive | Guardian/Lead phones masked; not exposed in API payload |
| CRM-15 | CRM changes in Tenant A | No data or audit log appears in Tenant B |
| CRM-16 | Referral/Page/School/Zalo sources | First source remains unchanged; touch history appended |
| CRM-17 | Staff without crm.lead.assign | Cannot change assignedMembershipId |
| CRM-18 | Assignee not authorized for branch | Backend rejects assignment |
| CRM-19 | Public intake when feature disabled | 503, even if token is valid |
| CRM-20 | Frontend network offline | Shows API error; does not simulate successful writes |

### Executability

`verification/verify_stage02.mjs` performs syntax, schema-vs-migration and pure domain-rules checks (no DB). `verification/run_stage02_integration.sh` requires Docker, npm packages, PostgreSQL, OIDC testing environment and should be run against a disposable DB. Real OIDC authorization and browser end-to-end flows still need manual/automated acceptance in a deployed test environment.
