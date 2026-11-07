# Stage 07 — Online Test, Trial, Academic LMS, Periodic Learning Reports, Customer Success & Renewal

**Spec LUM-ENG-07 v2.0-draft** · Covers M04 (test/trial), M11, M13 and notification pieces of M14. Depends on Student 360 Stage 02, entitlements/Class/Attendance Stage 05, contract history Stage 04. Order of realization: Placement/Test → Trial eligibility/report → Assessments/Assignments → Monthly Report → Happy Call → Renewal Review. This is **not one giant release**: use vertical slices and signoff each.

## 1. Personas
- Academic Manager creates reviewed placement banks and scoring criteria; instructors grade subjective skills and upload evidence.
- TVV/CSKH registers candidate for Test/Trial, monitors scores and parent communications.
- Teachers manage homework, monthly feedback, grading and attendance-linked progress.
- Branch/HQ managers review sensitive reports, happy call escalation, 3- and 6-month renewal pipeline.
- Parents (internal preview now; Stage 09 portal) receive only **published** report with explicit student/guardian access and consent.

## 2. Online Test module
### User journey
Check-in/Customer 360 → Placement Test → Select one of at least **3–5 configurable test forms** by type/level → generate signed attempt link/time limit → candidate takes test (no test answer leakage) → auto-grade objective items → human-grade Writing/Speaking via rubric → Academic Manager review → Publish/invalidate result → store printable PDF in Student 360. Re-test creates separate attempt, never rewrites prior published score.

### Domain model
| Table | Important fields |
|---|---|
| assessment_banks | tenant_id, purpose PLACEMENT/MID/FINAL, product_version_id, owner, version |
| assessment_forms/form_versions | title, skill, level, form_number, published_at, time_limit, randomization config |
| question_items/item_versions | type MCQ/FILL/ESSAY/SPEAKING, choices, answer key, marking rubric, points, item bank version |
| test_invites | person_id, branch_id, form_version_id, secure token hash, expires_at, attempt_limit |
| test_attempts | person_id, invite_id, started/submitted_at, state, attempt_no, ip/consent retention |
| test_responses | attempt_id, item_version_id, normalized answer, encrypted blob/file id for audio |
| assessment_scores | attempt_id, skill, auto_score/human_score, scorer, rubric_version, moderation_status |
| assessment_result_versions | final scores, band mapping, evaluator comments, published file/hash, published_at, supersedes |

All answers/scores access-scoped; item keys inaccessible to candidates. Multi-choice auto-grades deterministically by published key; essay/audio graded by authorized teacher. Avoid AI auto-grading hard assumptions: optional assisted feedback, human signoff.

**States:** Form DRAFT → REVIEWED → PUBLISHED → RETIRED; Attempt ISSUED → IN_PROGRESS → SUBMITTED → AUTO_GRADED → HUMAN_REVIEW → APPROVED → PUBLISHED; EXPIRED/CANCELLED, grade corrections via new immutable result version.

## 3. Trial module
**Hard gate:** Can enroll in Trial class only if \`trial_entitlement\` valid for specified student/class/session and tenant policy; or **paid entitlement** if trial conversion configured, not just \`trialStatus=YES\`. Stage 05 enrollment checks rights transactionally.

| Entity | Important fields |
|---|---|
| trial_entitlements | student_id, branch_id, class/product constraint, start/end, max_sessions, status, source authorization |
| trial_sessions | trial_entitlement_id, class_session_id, attendance refs |
| trial_reports/report_versions | teacher_id, attendance, skills, teacher comments, strengths, improvement, recommendation, published file hash, optional review |

**Flow:** CSKH opens Check-in/Student 360 → Trial → issue short-lived right → choose class with capacity → schedule 1..N trial sessions → teacher attendance and trial report template → manager/academic review if configured → publish PDF/print and send to parent → CSKH next step. No right => API 403/422 and no class roster insertion.

**Report must contain:** identity + class, session date, teacher, observed skill rubric, homework/interactions, strengths/areas to improve, recommended pathway, report author/time, review/issued version, attachment; template tenant-configurable.

## 4. Academic LMS
| User story | Data/behavior |
|---|---|
| Create material | File storage with signed URL, course/skill/version; no sharing across tenant |
| Assign homework | Teacher selects class/student, deadline, skills, max points, late policy; scheduled session may reference assignment |
| Submit | Student/teacher upload answer; version and submitted_at; virus scan/file type policy |
| Grade | Teacher grades with rubric; corrections versioned; teacher reassignment preserves history |
| Mid/end term test | Use assessment engine with academic test type; results linked to Student 360 and class |
| Student quality | Academic classification e.g. Xuất sắc/Tốt/Khá/TB/Yếu **tenant configured bands** and explicit grading period |

Models: \`learning_materials\`, \`assignments\`, \`assignment_recipients\`, \`submissions\`, \`submission_versions\`, \`grades\`, \`rubric_versions\`, \`student_quality_reviews\`. Store class ID + enrollment ID for historical role/ownership.

**States:** Assignment DRAFT→PUBLISHED→CLOSED/ARCHIVED; Submission PENDING→SUBMITTED→GRADED→RETURNED→RESUBMITTED; prior grade history never lost.

## 5. Monthly learning report
**One report per student × reporting period × scope** (or versioned revised report, according to tenant configuration). It must integrate:
- Contract/payment history (authorized view/masking, not raw accounting ledger)
- Sessions scheduled, attended, excused/unexcused/late, **lessons consumed vs lessons remaining** from entitlement ledger and allowance policy
- Input/mid/final test results and skill progress
- Homework completion/due/quality counts with defined denominator
- Specific teacher remarks (skills, strengths, improvement, next month plan) and academic quality
- Teacher/academic reviewer/CSKH release date, immutable release version, PDF/print and delivery proof
- Language/branding template per tenant; report corrections new version with superseded marker and notice

**Flow:** Reporting schedule → auto-prefill from authorized aggregates → Teacher writes remarks → academic review → CSKH checks guardian contact & sends → read acknowledgement/feedback → Happy Call. Do not show bank/PII fields unnecessarily to teacher. Missed reports alert owner.

**States:** DRAFT → TEACHER_SUBMITTED → ACADEMIC_APPROVED → CSKH_PUBLISHED → DELIVERED/DELIVERY_FAILED; revision creates v2 with replacement event.

## 6. Happy Calls & renewal management
- Happy call record belongs to **Student 360** with \`student_id, guardian_person_id, contract/enrollment/report reference, happened_at, channel, owner, summary, satisfaction, complaint category, next action and due date\`; notes private by permission; communication consent required for provider delivery.
- Escalation: sentiment/complaint → case → owner/SLA/manager oversight → action/resolution; do not claim automatic resolution.
- Renewal: manager opens monthly 3/6-month expiring-entitlement preview; source from balances + scheduled timetable + contract end policy. Forecast date and confidence both shown; manual override requires reason.
- Renewal review grid: student, contract/package, spent/remaining lessons, predicted exhaustion, parent feedback, likelihood (configured buckets), owner, next appointment, latest happy call, decision, outcome; meeting snapshot immutable with details written back to individual Student 360.
- A new renewal contract Stage 04 linked to prior entitlement/pathway; renewal eligibility and classification by **tenant policy**, not "any new payment" hard-coded.

Models: \`happy_calls\`, \`customer_cases\`, \`case_events\`, \`renewal_cases\`, \`renewal_forecasts\`, \`renewal_meetings\`, \`renewal_meeting_students\`, \`retention_tasks\`, \`outbound_notifications\`.

## 7. UI map
- Student 360 tabs: Test Results, Trial, Learning & Homework, Reports (period filter), Happy Calls, Renewal, Ledger & Fees, History.
- Teacher console: Today class roster, pending grading, report authoring, trial report.
- Academic console: question bank, grading review inbox, report approvals.
- CSKH console: monthly delivery queue, Happy Call form, 3/6-month expiry dashboard and meeting notes.
- Guardian preview: read-only published reports with secure access; full external portal Stage 09.
- PDF/print must reproduce checked numbers and document version; every download audited if sensitive.

## 8. API contracts (planned, \`/v1/tenants/:tenantId\`)
| Route | Action/permissions |
|---|---|
| GET/POST \`/assessments/forms\` | assessment.bank.read/manage |
| POST \`/assessments/forms/:id/publish\` | assessment.publish |
| POST \`/students/:id/test-invites\` | test.invite.create |
| POST \`/test-attempts/:id/responses\` | candidate scoped invite, answer payload |
| POST \`/test-attempts/:id/submit\` | candidate scoped, idempotent |
| POST \`/test-attempts/:id/grades\` | assessment.grade human rubric |
| POST \`/test-attempts/:id/publish-result\` | academic.approve |
| GET \`/students/:id/assessments\` | assessment.read, branch scope |
| POST \`/students/:id/trial-entitlements\` | trial.create with class/limit |
| POST \`/trial-reports\` | trial.report.write, teacher assignment |
| POST \`/trial-reports/:id/publish\` | trial.report.publish |
| POST \`/assignments\` | assignment.manage |
| POST \`/assignments/:id/submissions\` | assignment.submit with student scope |
| POST \`/submissions/:id/grades\` | assignment.grade |
| GET/POST \`/students/:id/monthly-reports\` | report.read/create |
| POST \`/monthly-reports/:id/submit\` | report.teacher.submit |
| POST \`/monthly-reports/:id/approve\` | report.academic.approve |
| POST \`/monthly-reports/:id/publish\` | report.publish |
| POST \`/students/:id/happy-calls\` | cskh.happycall.write |
| GET \`/renewal/cases?windowMonths=3|6\` | renewal.read |
| POST \`/renewal/meetings\` | renewal.manage |
| POST \`/renewal/meetings/:id/reviews\` | renewal.manage, student case updates |

**Sample** monthly report \`POST /students/:id/monthly-reports\`:
\`\`\`json
{"branchId":"uuid","period":"2027-04","enrollmentIds":["uuid"],
 "teacherRemarks":[{"skill":"WRITING","text":"Progress observed; next month: paragraph structure"}],
 "requestTemplateVersionId":"uuid"}
\`\`\`
200/201 returns \`reportId,status:"DRAFT",sourceSnapshotAt,sourceHash,documentVersion\`. Server owns data aggregation.

## 9. Cross-cutting events and errors
\`test.attempt.submitted\`, \`test.result.published\`, \`trial.entitlement.issued\`, \`trial.report.published\`, \`assignment.graded\`, \`monthly_report.published\`, \`report.delivered\`, \`happy_call.logged\`, \`renewal.case.updated\`.
401/403/404 strict student/class/guardian scope; 409 edit published report / concurrent moderation; 422 missing grading/attendance/entitlement/guardian consent; 429 link rate limit for candidate tests. Secure files via signed short expiry URLs.

## 10. Definition of Done
- Auto-scored test question accuracy across 3–5 configured forms; Writing/Speaking cannot publish without authorized human rubric and review.
- Expired/used token cannot submit tests again; no answer key exposure before/after; repeated submit idempotent.
- Trial not enabled → class enrollment rejected; issued entitlement allows only specified sessions; teacher can write report only if assigned during session.
- Academic report numbers match finance/attendance ledgers as-of reporting cutoff, source hash and edition; status transitions audited.
- Monthly report PDF, publish, deliver and teacher comments work for 2 students with distinct guardian permissions; parent gets only own child's published report.
- Happy Call stays on Student 360 and next task appears in manager 3/6-month review; historical meeting snapshot stable.
- Cross-tenant and branch RLS/IDOR; consent, API, browser UAT, accessibility, file security, tests for expired/edited/suspended states pass.

## 11. Open ADR
Scoring rubrics/band conversion; supported audio/video formats/hosting; trial session quotas and entitlement expiry; academic report template/publishing chain; data/minors guardian consent; renewal forecast assumptions and eligibility; parent communications channels before Stage 09.
