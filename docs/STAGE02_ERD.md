# Stage 02 CRM – Domain ERD

> 14 new CRM tables, coexisting with Stage 01 SaaS Core. Composite foreign keys in migration bind every operational relationship to `tenant_id`. `platform_users` and `branches` belong to Stage 01.

```mermaid
erDiagram
  CRM_PERSONS ||--o{ CRM_PERSON_BRANCHES : visible_at
  BRANCHES ||--o{ CRM_PERSON_BRANCHES : scopes
  CRM_PERSONS ||--o{ CRM_PERSON_CONTACTS : has
  CRM_PERSONS ||--o| CRM_STUDENTS : candidate_profile
  CRM_STUDENTS ||--o{ CRM_STUDENT_GUARDIANS : guardian_links
  CRM_PERSONS ||--o{ CRM_STUDENT_GUARDIANS : guardian_person
  CRM_PERSONS ||--o{ CRM_LEADS : lead_identity
  BRANCHES ||--o{ CRM_LEADS : origin_branch
  CRM_MARKETING_SOURCES ||--o{ CRM_LEADS : first_source
  CRM_MARKETING_SOURCES ||--o{ CRM_CAMPAIGNS : campaigns
  CRM_CAMPAIGNS ||--o{ CRM_LEADS : from_campaign
  CRM_LEADS ||--o{ CRM_LEAD_EVENTS : stage_history
  CRM_LEADS ||--o{ CRM_LEAD_ACTIVITIES : followup
  CRM_LEADS ||--o{ CRM_LEAD_TOUCHES : attribution
  CRM_MARKETING_SOURCES ||--o{ CRM_LEAD_TOUCHES : later_touch
  CRM_PERSONS ||--o{ CRM_CHECKINS : visited
  CRM_LEADS |o--o{ CRM_CHECKINS : converted_at
  BRANCHES ||--o{ CRM_INTAKE_INVITES : qr_created
  CRM_INTAKE_INVITES ||--o| CRM_INTAKE_SUBMISSIONS : one_use
  CRM_INTAKE_SUBMISSIONS |o--o| CRM_CHECKINS : staff_review
```

## Modeling notes

- `crm_persons` is an identity within a tenant; `crm_students` is a *student profile* established at check-in. This does **not** mean active paid enrollment.
- `crm_person_branches` defines visible branch associations; branch-level permissions are enforced by backend service before queries.
- `crm_leads.qualified_at` is first qualification timestamp; current QL is based on a valid contact phone.
- Contacts/phones are **not unique**: one guardian phone can relate to several students, and matching a phone is only a duplicate suggestion.
- `crm_lead_touches` keeps source history; `crm_leads.source_id` retains first acquisition source; check-in source can be independently set.
- `crm_intake_submissions` stores only provisional data. Staff review is required before Person Master changes.
- Status `crm_persons.status=CUSTOMER` means reached point of sale, not an enrolled/paid student.
- Use `person_id` as the durable key into future Assessment, Contracts, LMS and Renewal domains.
