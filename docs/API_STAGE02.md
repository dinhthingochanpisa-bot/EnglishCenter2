# Stage 02 CRM API – Contract v1.0

All tenant endpoints are prefixed with `v1/tenants/:tenantId/crm`. They require OIDC Bearer token. Backend checks Tenant membership, permission and Branch scope, then executes queries in tenant-scoped Prisma transaction.

| Method | Path | Permission | Function |
|---|---|---|---|
| GET/POST | `/persons` | `crm.person.read` / `crm.person.create` | Search and create Person Master; GET supports `branchId`, `search` |
| GET/PATCH | `/persons/:id` | `crm.person.read` / `crm.person.update` | Customer 360 and optimistic update, GET requires `branchId` |
| GET/POST | `/sources` | `crm.source.read` / `crm.source.manage` | Marketing source catalog |
| GET/POST | `/campaigns` | `crm.source.read` / `crm.source.manage` | Campaign catalog |
| GET | `/assignees?branchId=` | `crm.lead.assign` | Eligible TVV/CSKH for one branch |
| GET/POST | `/leads` | `crm.lead.read` / `crm.lead.create` | Lead and QL list/create |
| GET/PATCH | `/leads/:id` | `crm.lead.read` / `crm.lead.update` | Lead 360 and state transition; assignment requires `crm.lead.assign` |
| POST | `/leads/:id/activities` | `crm.activity.write` | Call, message, note, meeting, follow-up |
| POST | `/leads/:id/touches` | `crm.lead.update` | Attribution touch history |
| GET/POST | `/checkins` | `crm.checkin.read` / `crm.checkin.create` | Create draft Check-in / list |
| POST | `/checkins/:id/complete` | `crm.checkin.update` | Confirm sufficient student and guardian info; creates student profile |
| POST | `/intake-invites` | `crm.intake.manage` | One-use short expiry QR invitation |
| GET | `/intake-submissions?branchId=` | `crm.intake.read` | Pending form review, with phone masking |
| POST | `/intake-submissions/:id/review` | `crm.intake.manage` | Reject or approve, no auto-merging |
| POST | `/v1/public/intake/:tenantId/:token` | One-use secret | Public submitted provisional form, feature-gated |

`PATCH /leads/:id` requires `rowVersion`; status change validated by a finite state machine. `qualified_at` is first qualification time; `CONVERTED` can only follow completed Check-in. All writes create audit records. Sensitive phone data requires `pii.read_sensitive`, while normal check-in completion can reference an approved QR submission without exposing the raw number.

Lead list and detail responses expose `isQualified`, derived from the stored normalized contact phone independently of workflow status. Detail keeps `contactPhone` permission-masked and does not return `contactPhoneNormalized`. `GET /persons/:id` requires a UUID `branchId`; missing, malformed or non-string UUID inputs return HTTP 400 instead of a generic server error. Tenant membership, permission and object/branch authorization still apply to valid inputs.

## Key example: New Lead

```json
{
  "branchId":"<branch uuid>",
  "studentName":"Học sinh minh họa",
  "contactName":"Phụ huynh minh họa",
  "contactPhone":"0912345678",
  "sourceId":"<source uuid>"
}
```

Response includes `possiblePhoneMatches` **for human review**; no automatic identity merge.

## Key example: Walk-in

1. Create/find Person in selected branch.
2. Create Check-in `POST /checkins` without `leadId`, using active source category `WALK_IN`.
3. Confirm `POST /checkins/:id/complete` with `dateOfBirth`, `schoolName`, `schoolGrade`, `guardianName`, `guardianPhone`.
4. System marks `crm_persons.status=CUSTOMER`, creates student profile identity, keeps all earlier Lead journeys intact.

## Key example: QR form

1. Staff creates invite from tenant-scoped API, presents link/QR.
2. Visitor enters personal details through public form; send `consentAccepted=true`.
3. Staff reviews submitted form; confirmation creates **DRAFT** Check-in. For Lead-linked invites, the same Person Master is reused, with name mismatch requiring manual review.
4. Staff completes Check-in; server may read the protected submission by `intakeSubmissionId` without giving the browser full phone data.

**Not production ready:** public QR intake is disabled by default (`PUBLIC_INTAKE_ENABLED=false`). Before enabling, implement edge rate limiting, CAPTCHA/abuse monitoring as needed, tenant-specific privacy notices/consent policy and retention, plus penetration and privacy review.
