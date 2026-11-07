# Stage 05 — Class/Schedule, Teacher Assignment, Attendance & Lesson Entitlement

**Spec LUM-ENG-05 v2.0 draft** · Covers M09 and M10 · Requires Stage 04 contract/entitlement grant policy, Stage 02 student identity, Stage 01 RBAC. Not yet implemented in Stage 02.

## 1. Goals and non-negotiable rules
- Manage classes and planned/actual sessions across multiple branches, GVCN and skill-specific teachers with history; enroll entitled students (paid, free or trial only when valid).
- **Attendance is event- and session-based.** Only an approved/finalized session attendance action may consume lessons according to entitlement and absence rules.
- Remaining lessons are derived from **entitlement ledger**, never from a manually editable field or plain decrement on attendance upsert.
- Every effective-dated class membership, teacher assignment and class/session change is reconstructible as of any past date.

## 2. Personas and UI journeys
| User | Contextual flow |
|---|---|
| Academic Manager | Classes → Add class → choose branch, product/level, capacity, start/end, calendar/timezone, modality, meeting room → publish |
| Academic Manager | Class → Teachers → assign GVCN and multiple skill teachers with valid_from/to; detect conflicting assignments |
| Scheduler | Class → Weekly timetable → recurrence (days/time/local TZ), holidays, exceptions; preview session occurrences; detect teacher/room conflicts |
| CSKH / TVV | Class roster → Add student → choose entitlement (paid/free/trial), effective start, authorization check → confirm |
| Teacher | Today → Session → Roster → statuses (present, late + minutes, absent excused/unexcused, unknown) → Save Draft → Submit |
| Academic Lead | Review attendance → Finalize or return, written reason; correction creates ledger reversal and new consumption |
| CSKH / Manager | Student 360 → Sessions & remaining lessons; free absence allowance use, projected exhaustion date; low capacity warning |
| Branch Manager | Class → pause/end/archive with reason and effective time, keep roster and session history accessible |

### UI details
- Class list: branch/product/teacher/status/number of enrolled, scheduled size, low-size threshold alert configurable; prohibit deletion of class with historical sessions; use Archive.
- Class detail tabs: Roster, Calendar, Attendance, Teachers, Assessments, Audit. Class roster contextual actions: transfer/request reserve/stop study (Stage 06), view student.
- Attendance matrix row per enrollment per session, explicit late minutes and absence reason, per-row editable draft, bulk submit with confirmation; show how each record affects lesson balances.
- Remaining balance timeline **grant/charge/waiver/adjust/reversal**, not bare mutable number. PDF/export with branch/PII rights.

## 3. Core models and constraints
All tables tenant scoped with composite tenant FK and audit.
| Table/aggregate | Essential fields |
|---|---|
| classes | branch_id, product/package/pathway version, code, capacity, status DRAFT/ACTIVE/PAUSED/ENDED/ARCHIVED, low_size_config_ref |
| class_teacher_assignments | class_id, teacher_membership_id, role GVCN/SKILL, skill_id, valid_from/to, no ambiguous overlap per role where configured |
| rooms/resources | branch_id, capacity, location, status and type online/offline |
| class_schedule_rules | class_id, TZ, by_day/time, valid_from/to, recurrence JSON schema, skip holidays |
| class_sessions | rule_id nullable, occurrence start/end (UTC), local date/TZ, skill, instructor, room, status SCHEDULED/OPEN/COMPLETED/CANCELLED, moved_from_session_id |
| class_enrollments | class_id, person/student_id, entitlement_id, effective_from/to, status, reason, replacement lineage |
| enrollment_events | enrollment_id, old/new class, event time, actor, approved reference, version |
| attendance_records | session_id, enrollment_id, status, late_minutes, absence_permission, reason, approval_state, row_version, unique session+enrollment |
| entitlement_grants | contract_line/approved_free_trial source, lesson_quantity, unit, valid window, branch/eligible product, spending order |
| entitlement_ledger | grant_id, student_id, session_id nullable, entry_type GRANT/CONSUME/WAIVER/REVERSE/ADJUST, units ±, reason, policy_version, reversal_of_entry_id, idempotency_key |
| absence_allowances | grant_id, policy_version, period start/end, eligible status, max_free_units, consumed_free_units derived |
| attendance_versions | record_id, old/new status, actor, changedAt, correctionReason |
| class_membership_history | derived/read-model or effective-dated enrollment, never overwrite |

**Critical indexes**: unique (tenant_id, session_id, enrollment_id); unique idempotency key per tenant/ledger posting; effective-dated indexes; no sessions overlapping same instructor/room where collision policy requires. Prevent cross-branch enrollment if no authorized transfer and no valid entitlement.

## 4. State machines
- Class \`DRAFT → ACTIVE → PAUSED → ACTIVE\` or \`ACTIVE/PAUSED → ENDED → ARCHIVED\`; ARCHIVED is read-only historical, not hard deleted.
- Session \`SCHEDULED → OPEN → COMPLETED\` or \`CANCELLED\`. Completed sessions require correction workflow for attendance changes.
- Enrollment \`PENDING → ACTIVE → ENDED/TRANSFERRED/RESERVED\`; Stage 06 orchestrates future effective changes; no immediate move on approval if effective date later.
- Attendance \`UNMARKED → DRAFT → SUBMITTED → FINALIZED\`; correction \`FINALIZED → CORRECTION_PENDING → REPLACED\`, with separate immutable previous version and reversal. Teacher may submit own sessions; manager may finalize or policy-configured auto-finalize with audit.

## 5. Attendance policy & quota algorithm
Policy version binds to entitlement at grant time, with explicit:
- Eligible absence statuses (excused/unexcused/late/makeup) and whether cost-free; allowed free count or fraction, fixed period \`PER_PACKAGE/PER_TERM/PER_CALENDAR_MONTH\`; threshold, valid window.
- **Example only:** 96 lessons and 4 free eligible absences => first 4 eligible absences consume 0 lesson but use free allowance; 5th consumes 1 lesson. Do not universally hard-code 96 or 4.
- Present typically consumes actual lesson unit; late minutes may consume full lesson or fraction **only by policy**; unexcused absence may consume, excused can be free until allowance exhausted.
- Multi-lesson session: consume configured units; one session can have per-skill fractional units if policy says, with integer/decimal units. Never silently assume 1.
- Projected exhaustion derived from scheduled sessions of eligible active enrollment, granted balance and planned future absences ignored/assumption explicit.

**Atomic finalization pseudocode**:
\`\`\`text
lock relevant (tenant, student, entitlementGrant, attendance record)
if same finalization idempotencyKey and same body: return prior result
validate session COMPL/attendance SUBMITTED, enrollment active at session time
validate selected grant covers this class/skill/time and has balance
policy = entitlement.absence_policy_version snapshot
compute allowance impact and unit consumption in deterministic order
insert immutable ledger group (grant usage, waiver, allowance changes)
mark attendance FINALIZED, append history, outbox, audit in one transaction
on correction: lock + reverse old ledger group before posting recalculated group
commit; retry serialization conflicts with bounded policy
\`\`\`
**Order for allowance allocation must be defined** when backdating attendance; earliest session date then stable session ID default is proposed pending ADR. If backdated edits alter allocation for later sessions, recompute affected ledger entries through auditable reversible job, never silently change balances.

## 6. Example outcomes / test matrix
| Input | Policy | Expected |
|---|---|---|
| Paid grant 96, 4 free eligible absences | 4 eligible excused absences first | 0 lesson units consumed from these 4; free allowance exhausted |
| Fifth eligible absence | Same frozen policy | 1 lesson unit consumed, ledger trace and remaining reduced |
| Presence 10 sessions | Consume 1/session | 10 units consumed, no duplicate on save twice |
| Teacher toggles finalized absent→present | Correction approved | Old consumption reversed and new consumption posted once |
| Absent without valid entitlement | Any | Enrollment/attendance finalize rejected if policy requires entitlement |
| Trial enrollment, no trial right | Any | Cannot enroll or mark as trial; no loophole via status string |
| Teacher assigned to overlapping class sessions | Collision policy forbids | 409 conflict incl resource/overlap |
| Session cancellation | Future event | No attendance charges; earlier finalized event correction workflow |
| Same student both old/new class before transfer effective date | Scoped transfer policy | Only correct roster as-of date; no double charge |

## 7. API contract proposal (prefix \`/v1/tenants/:tenantId\`)
| Route | Permission / payload |
|---|---|
| GET/POST \`/classes\` | \`class.read/create\`; branchId, productVersionId, capacity, timezone |
| GET/PATCH \`/classes/:id\` | \`class.read/manage\`; rowVersion, reason, status |
| POST \`/classes/:id/teachers\` | \`class.teacher.assign\`; membershipId,role,skillId,validFrom |
| POST \`/classes/:id/schedules\` | \`schedule.manage\`; timezone, rules, exceptions |
| POST \`/classes/:id/sessions:generate\` | \`schedule.manage\`; window, dryRun option |
| GET \`/classes/:id/sessions\` | \`schedule.read\`; date range, cursor |
| POST \`/classes/:id/enrollments\` | \`enrollment.manage\`; studentId,entitlementGrantId,effectiveFrom |
| GET \`/classes/:id/roster?asOf=\` | \`class.roster.read\`; historical roster |
| GET \`/sessions/:id/attendance\` | \`attendance.read\`; masked PII as needed |
| PUT \`/sessions/:id/attendance:batch\` | \`attendance.write\`; attendance array + If-Match |
| POST \`/sessions/:id/attendance:finalize\` | \`attendance.finalize\`; Idempotency-Key |
| POST \`/attendance/:id/corrections\` | \`attendance.correct\`; old rowVersion/newStatus/reason |
| GET \`/students/:studentId/entitlements\` | \`entitlement.read\`; grant/usage/remaining |
| GET \`/students/:studentId/lesson-ledger\` | \`entitlement.read\`; paginated immutable entries |
| GET \`/classes/low-occupancy\` | \`class.read\`; branchId, thresholdPolicy |

### Canonical attendance payload
\`\`\`json
{"rowVersion":3,"records":[
 {"enrollmentId":"uuid","status":"PRESENT"},
 {"enrollmentId":"uuid","status":"LATE","lateMinutes":12},
 {"enrollmentId":"uuid","status":"ABSENT","permission":"EXCUSED","reasonCode":"SICK"}]}
\`\`\`
200 per-row draft results, rejected rows with machine-readable errors; **finalization separate** from draft. Blind updates on locked records rejected with 409.

## 8. Authorization/negative cases
Teachers may mark only assigned session within effective assignment window, not entire branch; CSKH may read and initiate operations according to permission. Student/guardian portal cannot mark attendance. Branch Manager cannot edit other branch. Deny unsupported paid enrollment, duplicate enrollment, over-capacity without manager override record, wrong class product/skill entitlement. Cross-tenant IDs always return sanitized 404/403.

## 9. Events and integrations
\`class.created\`, \`session.scheduled\`, \`session.cancelled\`, \`enrollment.activated\`, \`attendance.submitted\`, \`attendance.finalized\`, \`attendance.corrected\`, \`entitlement.consumed\`, \`entitlement.balance.changed\`. Outbox once with versioned payload, consumers idempotent; BI reads from read models, never recomputes mutable counter manually.

## 10. Definition of Done
- 30 deterministic entitlement golden tests, including 96/4 example, first vs fifth absence, late and multi-lesson sessions, backdate corrections, schedule cancellation, duplicate submit.
- Concurrent attendance finalization and same student multiple classes cannot overconsume; transaction serializable or row locks tested.
- Timezone DST/boundary, instructor/room schedule collision, published and archived class history tests.
- UI calendar + roster + teacher attendance + student balance + low-size threshold complete; accessible with keyboard, mobile workable.
- Two tenants + branch scopes RLS/API tests; audit/traces; migration/Prisma build; playwright UAT with teacher and CSKH.
- No path for front-end to modify remaining lessons directly or create entitlement without approved source.

## 11. Pending ADRs
Exact attendance allowance policy, correction/backdate ordering, homework vs attendance charging, class maximum/capacity override, paid activation gate, cross-branch classes, time zone and scheduled generation horizon.
