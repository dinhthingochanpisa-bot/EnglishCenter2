# Stage 06 — Student Operations: Transfers, Reservations, Dropout, Graduation & Approval Workflows

**Spec LUM-ENG-06 v2.0-draft · M12 + workflow subset M14.** Dependencies: effective-dated Class/Session/Enrollment (Stage 05), entitlement balance, approved/active contract (Stage 04), Student 360 (Stage 02). No refunds/fee transfers in this Stage; requests may link to Stage 08 later.

## 1. Goals
Student support performs contextual student actions on **class roster and Student 360**, not by duplicating disconnected records in a separate module. Transfer/reserve/stop requests follow auditable approvals and **effective dates**. Distinguish approving a request from executing it at the correct session cutoff.

### Key business language
- **Chuyển lớp:** destination class and effective start; last eligible session in current class determines close date. Student appears on destination roster as-of effective moment; history of all prior classes preserved.
- **Tạm dừng:** business synonym for **bảo lưu**; choice short/long threshold configurable, not universally 4 sessions. Date from/to, actual used/remaining lessons and monetary estimate shown.
- **Dừng học:** nghỉ ngang or tốt nghiệp with last study session/date, reason, manager approval for both; does not automatically refund/transfer payment.
- **Re-entry:** after reserve period, revalidate class, policy version, schedule and entitlement; may need placement review before reinstatement.

## 2. Actor flows and UI
| Actor | In-place action sequence | Proof of completion |
|---|---|---|
| CSKH | Class roster → student row ⋮ → Chuyển lớp → choose target class, effective date, reason, eligibility preview → submit | Pending request, no early roster mutation |
| Scheduler/Manager | Transfer request detail → class timetable conflict, target capacity, source last session, grant applicability → approve | Scheduled execution job and audit |
| CSKH/GVCN | Student row ⋮ → Tạm dừng → short/long based on rule → from/to, computed sessions/fee estimate → submit | Immutable baseline with policy version |
| GVCN | Reservation worklist → pedagogical review/notes → approve/reject | Step decision with timestamp |
| Accountant | Reservation finance review → preview financial impact → approve/reject | No negative grant, no hidden payout |
| Branch Manager | Final reservation approval → schedule pause/resume | Effective-date state transition only |
| CSKH | Student row ⋮ → Dừng học → Nghỉ ngang/Tốt nghiệp → choose final lesson, reason category → request | Manager decision required |
| Manager | Review Exit → confirm | Enrollment closes after last eligible session; reason history retained |
| CSKH/Manager | Student 360 → Event history | Timeline for requested/approved/effective/cancelled with who/when |

### Screen set
Roster actions; Change Request wizard with summary; approval inbox by role; Student operations timeline; scheduled-effective queue dashboard; exception/conflict screen; restore/resume action. Use permission-aware rendering but API decides. Detect stale view with 409 and offer refresh, never silently reset form.

## 3. Proposed data structures
Common fields: tenant_id, branch_id, id, student_id, requested_by, reason, effective_from/to, policy_version_id, status, row_version, created_at/by, audit correlation_id.
| Table | Fields + invariant |
|---|---|
| student_operation_requests | operation_type TRANSFER/RESERVE_SHORT/RESERVE_LONG/EXIT_DROPOUT/EXIT_GRADUATE/RESUME, snapshots, status, reasons, optimistic_version |
| class_transfer_requests | source_enrollment_id, destination_class_id, proposed_start, last_source_session_id, calculated_cutoff |
| student_reservations | reservation_type, from/to, computed_learning_sessions, remaining_grant_units, freeze_value, approval ref, reserved_balance snapshot |
| student_exits | exit_type, last_session_id, effective_end, reason_category/id, manager_decision |
| operation_execution_jobs | execute_at, operation_request_id, idempotency_key, attempts, last_error, next_attempt_at |
| operation_execution_events | request_id, old/new enrollment status, class, entitlement effect, executed_at, actor/service |
| workflow_definitions/versions | tenant scope, branch override, steps, approver permission, SoD, effective range |
| workflow_instances/step_decisions | entity ref, step order, required approver role, decision, reason, evidence, delegation |
| reason_taxonomies | per-tenant configurable dropout/reservation categories with version/effective date |

**No direct update of finalized attendance or past class enrollment**. Transfer executes new effective-dated enrollment event and closes previous one with legal cutoff. Simultaneous requests for same student and overlapping time range must conflict or queue according to configured policy; never silently double-activate.

## 4. State transition diagrams
- Operation: \`DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → SCHEDULED → EXECUTING → COMPLETED\` / \`REJECTED\`, \`CANCELLED\`, \`FAILED_RETRYABLE\`, \`MANUAL_REVIEW\`.
- Reservation: \`REQUESTED → GVCN_APPROVED → ACCOUNTANT_APPROVED → MANAGER_APPROVED → SCHEDULED → ACTIVE → RESUMPTION_DUE → RESUMED/CLOSED\`; tenant can configure routing but must respect SoD and minimum required signoffs.
- Exit: \`REQUESTED → MANAGER_APPROVED → SCHEDULED → EFFECTIVE\`; reject keeps enrollment Active. Graduation and dropout both require approval; reporting reason remains distinct.
- A decision **does not equal the effective transition**. Future-dated scheduled request only affects roster on execution date/session boundary.

## 5. Transfer algorithm and time semantics
1. Validate source enrollment Active at requested time; destination exists/active, suitable level, capacity and no teacher/schedule incompatibility. Validate student's entitlement covers target product/branch or request additional conversion workflow.
2. Resolve **last source session before target effective date** (must be finalized or explicitly policy-handled future class session).
3. Source effective_to at cutoff after old final lesson; target enrollment effective_from after cutoff and at/after requested date, never before.
4. Place operation as \`SCHEDULED\` with UTC timestamp, local branch timezone and explicit session cutoff. On due time, transactional compare-and-swap on version; revalidate capacity/entitlement; close source and open target, append events/audit/outbox.
5. If last session is cancelled/moved after approval, reschedule or flag \`MANUAL_REVIEW\` — do not silently transfer at incorrect date.
6. Repeat job after success is idempotent and returns existing execution, with no duplicate enrollment.

**Boundary tests**: same-day two sessions, cross midnight, holiday, class session cancelled, transferring into class at capacity, overlapping class membership allowed/denied per policy, old class ends before requested transfer.

## 6. Reservation and entitlement
- Tenant config determines short vs long by **number of missed class sessions** or calendar days; equal threshold boundary requires ADR.
- Show approved baseline: \`usedUnits\`, \`availableUnits\`, \`scheduledSessionsDuringWindow\`, \`reservedValueEstimate\` with exact policy version, currency and source contract. Financial freeze is not refund.
- On reservation ACTIVE: scheduled attendance charging is blocked unless an explicitly allowable session (makeup/exception) and approval exists. Other parallel courses/grants are not frozen unless scope configured.
- GVCN → Accountant → Manager (or configured workflow) decisions visible. Rejection does not change any entitlement balance. Reserve cannot exceed grant validity or branch-defined limits without separate exception.
- Resumption: notify owner; validate class and balance; if old class no longer runs, propose target class. Always preserve source grant ledger and absence history.

## 7. Dropout/graduation policy
- Require selected last class session **no later than effective stop date** and reason taxonomy; user can attach evidence/notes. Manager confirms both categories, with self-approval check.
- Close enrollment and future charge eligibility after last session, cancel/mark future attendance pending appropriately; any posted attendance correction handled by Stage 05 reversal path.
- \`DROPOUT\` vs \`GRADUATED\` are operational states, not legal termination of contract or settlement of balance; Stage 08 handles refund requests. Graduation may still have an active separate contract/class.
- For student with multiple active enrollments, choose scope \`THIS_ENROLLMENT\` vs \`ALL\`; do not infer single account-wide status from one class.

## 8. API contract (planned; \`/v1/tenants/:tenantId\`)
| Route | Request / permission | Result |
|---|---|---|
| GET \`/students/:id/operations\` | operations.read + branch scope | Timeline paginated |
| POST \`/students/:id/class-transfers\` | sourceEnrollmentId,targetClassId,effectiveFrom,reason; operations.transfer.request | 201 SUBMITTED |
| GET \`/class-transfers/:id/preview\` | operations.transfer.read | Source cutoff, target eligibility and conflict list |
| POST \`/students/:id/reservations\` | reservationType,from,to,scope,reason; operations.reserve.request | 201 SUBMITTED |
| GET \`/reservations/:id/valuation\` | —; finance.reserve.read | Used/remaining, predicted value and assumptions |
| POST \`/students/:id/exits\` | type,lastSessionId,reasonId,scope; operations.exit.request | 201 SUBMITTED |
| POST \`/students/:id/resume-requests\` | reservationId,returnAt,targetClassId? | 201 SUBMITTED |
| GET \`/approval-worklist\` | role/branch/status filter | Pending steps only user can decide |
| POST \`/operation-requests/:id/decisions\` | stepId,decision,reason,rowVersion | 200 new state |
| POST \`/operation-requests/:id/cancel\` | reason,rowVersion | 200 CANCELLED if permitted |
| GET \`/operation-requests/:id/executions\` | — | Audit history and job state |
| POST \`/operation-requests/:id/retry\` | manager authorization, reason | 202 retry scheduled |

All writes require \`Idempotency-Key\`. Stage 06 UI must not change class roster directly; only backend operation state machine does it.

## 9. Failure handling / security
- \`401/403\` auth/scope, \`404\` out-of-tenant ID, \`409\` overlap, stale rowVersion, no capacity, double approval, request blocked by finalized transfer, \`422\` invalid time/order/policy.
- Approver cannot be same requester if configured SoD; never use frontend role to decide identity.
- Ledger/roster mutation must be in same transaction with execution event + outbox. Failures retry with backoff; repeated job does not create new enrollments.
- Freeze effective date can be future; manager must see scheduled requests and controls to cancel/adjust.

## 10. Acceptance criteria & tests
- Approved future transfer leaves old roster until proper cutoff; after due time, source removed, destination added, historical lookup unchanged. Exact historical counts no double counting.
- Reservation workflow 3-step audit; students not charged during approved frozen sessions; resume restores correct schedule/entitlement.
- Short/long rules configurable by branch, threshold equality tested, date boundaries (timezone) and mid-month exceptions.
- Exit reason approved by manager for **both** dropout and graduation; last session cutoff; unrelated enrollment unaffected.
- 2 concurrent operation requests for same student cannot produce contradictory states; retry is idempotent.
- CSKH can initiate but not finalize approval without authority. Branch B cannot modify Branch A student even with valid Tenant A login.
- Browser UAT on roster contextual actions + Student 360, keyboard focus, print/snapshot; backend/API/RLS tests and audit verified.

## 11. Decisions pending
Threshold meaning (calendar vs scheduled lessons, exactly 4), short/long duration cap, approval workflow override by tenant, cancelled future sessions effect, cross-branch education ledger settlement, multi-enrollment stop scope default, reservation value tax semantics.
