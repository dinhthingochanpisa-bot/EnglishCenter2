# Stage 03 — Product & Curriculum, Pricing/CSBH, Quote & Approval

**Spec ID:** LUM-ENG-03 · **Version:** 2.0-draft · **Status:** Ready for design review, NOT authorized defaults · **Dependencies:** Stage 01 RBAC/RLS, Stage 02 Person/Lead/Check-in.  
**M05/M06 + phần M07 (báo giá)**. **Not included:** final signed contract, payment collection, e-invoice, class attendance.

## 1. Outcome, actors, scope
- Tenant Admin/Catalog Manager creates tenant product family (IELTS, KET/PET, TOEFL, other); Branch Manager enables product and configures branch catalog; Academic Manager publishes curriculum/pathway; Sales creates quote; Accountant approves price; Manager approves exceptions; Customer receives published quote.
- Products are configurable: khóa, chương trình, lộ trình; FT/Normal variations, session counts and skill sequences; duration/lesson/price unit must be explicit, not inferred from product name.
- Publish versions; a quote references **immutable product/package, pricebook, promotion and calculation-engine version** even if organization later updates settings.
- Sales can find a customer in Customer 360 and create quote **at that customer's contextual screen**.

## 2. End-to-end user stories and UI flows
| ID | Actor/story | UI steps | Success |
|---|---|---|---|
| S03-01 | Catalog Manager manages products | Tenant → Sản phẩm → Tạo product → choose category, unit, level, description → Save Draft → Publish | Active version with branch scope and no overwritten historical versions |
| S03-02 | Academic configures pathway | Product → Pathways → Add ordered nodes, prerequisites, skills, planned lessons → Preview → Publish | Valid DAG/order, archived versions remain readable |
| S03-03 | Branch Manager enables package | Branch → Catalog → Select published package → pricebook item, sale windows → Activate | Only authorized branch can sell it in effective window |
| S03-04 | Tenant Manager creates CSBH | CSBH → Create policy → eligible branches/products/customer types, rule ordering, %/voucher, stacking, cap → simulate → approve → activate | Traceable version; no ambiguity about bases/rounding |
| S03-05 | TVV generates quote | Student/Customer 360 → Báo giá → choose New/Renew → product/package/pathway → promotion → quote preview (calculation trace) → request approval | Draft quote references actual person and branch |
| S03-06 | Accountant/manager approves | Worklist → Price exception/check → Approve/Reject with reason → immutable snapshot | Sales cannot approve own exception; denied approval leaves quote unchanged |
| S03-07 | Sales sends quote | Approved quote → Generate printable PDF → Send/share with controlled link → record delivery receipt | Published doc version and idempotent message event |

### Minimum UI screens
Product catalog list + filters + draft editor; pathway visual table/sequence editor; package editor; branch pricebook timeline; CSBH timeline/rule builder with preview; quote calculator; quote timeline and approvals; manager approval inbox. Keyboard-accessible modal, server-side validations, visible errors, loading/empty states, no fake success.

## 3. Domain model / persistent tables (proposed; align with logical ERD)
Each tenant-owned row: **tenant_id UUID** and scoped composite FK, id UUID, created_at/by, updated_at/by, row_version, status; archived_at where appropriate.

| Aggregate/table | Essential fields / constraints |
|---|---|
| products | code unique (tenant_id,code), family, category, product_type, description, owning_branch nullable |
| product_versions | product_id, version, name, classification, unit=LESSON, published_at, valid_from/to; immutable after publish |
| programs | product_id, version_id, academic_outcomes, skills JSON validated or normalized, expected_levels |
| pathways/pathway_versions/pathway_nodes | ordered module nodes, prerequisite ids, cumulative lesson count, branch override scope |
| packages/package_versions | program/pathway link, lesson_quantity positive, weekly frequency optional, min/max eligibility, valid windows |
| branch_product_availability | branch_id, package_version_id, valid_from/to, active; disallow ambiguous overlapping windows for same target |
| pricebooks/pricebook_items | currency VND, package_version, list_unit_price, list_total_price, effective date, tax_behavior, unique active interval |
| promotion_policies/policy_versions | name, code, branch/category segment, priority, evaluation_phase, status DRAFT/SCHEDULED/ACTIVE/RETIRED |
| promotion_rules | predicate AST or typed JSON schema, rule_type PERCENT/VOUCHER, calculation_base LIST_PRICE/CURRENT_NET, stacking group, order, cap, min/max |
| pricing_simulations | input hash, result trace, policy version, actor, elapsed_ms (non-contract ephemeral with retention) |
| quotes/quote_versions/quote_lines | person_id, branch_id, New/Renew, package version, list/net totals, tax, currency, checksum, status, expires_at, input snapshot |
| approval_requests/approval_steps | requested_by, approver role, status, order, decision_at/by, reason, policy_version, segregation_of_duties |

Use decimal/numeric for money and percentages; no IEEE floats. Explicit unit and rounding context. Publish cannot reuse a version number. Discount rules cannot produce a negative payable.

## 4. State machines and authorization
- Product/Package version: DRAFT → IN_REVIEW → PUBLISHED → RETIRED (no edit after PUBLISHED; clone to revise). Retired version usable for historical quote/contract lookup.
- CSBH version: DRAFT → IN_REVIEW → APPROVED → SCHEDULED → ACTIVE → EXPIRED/RETIRED. Multiple active versions require deterministic exclusion/precedence, otherwise reject publication.
- Quote: DRAFT → SUBMITTED → FINANCE_APPROVED → MANAGER_APPROVED (if exception) → APPROVED → SENT → ACCEPTED/DECLINED/EXPIRED; REJECTED returns to new draft **version**, not silent mutation. Cancellation has audit.
- Only catalog/policy manager publishes; pricing approval separated from requester; branch scope enforced at query and write. Platform Admin must not implicitly see tenant prices.

## 5. Calculation engine normative contract
Canonical order **must be persisted in policy**; never universally hard-code:
1. Validate quote context (branch, date/effective timezone, New/Renew, product eligibility, quota, explicit customer benefits).
2. Fetch immutable package version + pricebook item by as-of date.
3. Select eligible policy versions by deterministic priority/selection; reject ambiguous overlapping exclusive rules.
4. Evaluate rule sequence against **base selectors**: LIST_PRICE vs CURRENT_NET. For sequential CK: each rule applies after prior net; for additive CK groups: sum rates on defined base (not blindly total), then apply cap.
5. Voucher amount is deducted in defined stage (before/after percent) with threshold conditions; capture whether voucher is one-use and reserve use only when quote accepted (ADR).
6. Guard total discount ceiling, min payable and promotional combinability. Display both promotional discount and effective reduction; ceil/floor under explicit rule.
7. Round **at defined stages**, using decimal and documented rounding mode; return detailed trace.
8. Snapshot inputs + selected versions + engine version + trace + checksum. Repeat evaluation of same snapshot must yield exactly same numeric result; status update never recomputes old quote silently.

**Golden test example** (test-only, not tenant policy): price VND 30,000,000; 10% base then additional 5% additive on list = 25,500,000; sequential 5% on current net = 25,650,000. A VND 500,000 voucher AFTER sequential → 25,150,000; voucher BEFORE percent must use its defined base and produce a traceable different amount.

## 6. API contracts (planned, exact request/response patterns in API_CONTRACTS.md)
Prefix: \`/v1/tenants/:tenantId\`; auth bearer + tenant membership. Required \`Idempotency-Key\` on POST financial/approval actions; \`If-Match\` / rowVersion for PATCH.

| Method/path | Request core | Returns / permission |
|---|---|---|
| GET/POST \`/catalog/products\` | POST code,family,category | 201 product; catalog.read/manage |
| POST \`/catalog/products/:id/versions\` | name, skills, validFrom | 201 DRAFT version; catalog.manage |
| POST \`/catalog/product-versions/:id/publish\` | expectedVersion, reason | 200 PUBLISHED; academic.publish |
| GET/POST \`/catalog/packages\` | productVersionId,lessonQuantity,unit | 201; catalog.manage |
| GET/POST \`/catalog/pathways\` | nodes[], prerequisiteIds[] | 201; academic.manage |
| GET/POST \`/pricing/pricebooks\` | scope,validFrom,validTo | 201; pricing.manage |
| GET/POST \`/pricing/policies\` | scope,ruleGroups[],capConfig | 201; promotion.manage |
| POST \`/pricing/simulations\` | branchId, packageVersionId, policies[], customerType, asOf | 200 amountBreakdown, trace[], conflict[]; pricing.simulate |
| POST \`/quotes\` | personId, branchId, lines[], selectedPolicyVersionIds[], customerType | 201 DRAFT; quote.create |
| POST \`/quotes/:id/submit\` | rowVersion, reason | 200 SUBMITTED; quote.submit |
| POST \`/approvals/:id/decisions\` | decision,reason,rowVersion | 200 currentStep; approval.decide |
| POST \`/quotes/:id/publish\` | rowVersion, channel | 200 SENT + documentId; quote.publish |
| GET \`/quotes/:id/calculation-trace\` | — | 200 immutable breakdown; quote.read |

### Illustrative example
\`\`\`json
{
  "personId": "uuid", "branchId": "uuid", "customerType": "RENEW",
  "lines": [{"packageVersionId":"uuid","quantity":1}],
  "selectedPolicyVersionIds": ["uuid"], "asOf":"2027-01-05T09:00:00+07:00"
}
\`\`\`
\`201\` returns \`{id,status:"DRAFT",version:1,currency:"VND",listAmount:"30000000",discountAmount:"4350000",payableAmount:"25650000",trace:[...],etag:"..."}\`. Amounts transmitted as decimal **strings**. Tenant/branch context checked on server, not trusted from body.

## 7. Business exceptions and negative paths
- Multiple currencies/taxes: VND baseline only; cross-currency quote blocked until ADR. Invoice/tax integration Stage 04.
- Quote expiration after policy sunset uses frozen snapshot for viewing, but reissue must recalculate as **new** quote version.
- Sales cannot bypass quote approval, send unapproved price or choose branch not in role scope.
- Package cannot publish if missing units/skill/lesson count; product retired should not appear for new sale.
- Promotion total beyond cap: reject or clamp **per policy configuration**, never guess silently. Explicit conflict error.
- Duplicate POST requests use idempotency key + request hash; different body same key => 409.
- Customer can have multiple quotes/contracts; quote is not entitlement.

## 8. Event and integration expectations
\`catalog.version.published\`, \`promotion.version.activated\`, \`quote.submitted\`, \`approval.step.completed\`, \`quote.approved\`, \`quote.published\`. Event outbox in same DB transaction, consumed async without duplicate external send.

## 9. Definition of Done (minimum)
- Product/package/pathway revision never corrupts existing quote references.
- 20+ pricing golden cases: additive/sequential; voucher before/after; 0/100% caps; mixed product groups; early voucher expiry; date boundary/time zone; rounding; renew; invalid branch; missing policy; conflicting rules.
- Quote API requires exact role/branch; 401/403/404/409 tested; two-tenant reads and writes blocked at API + RLS.
- Approval SoD and step ordering verified, reject/cancel audit preserved.
- Browser UAT: create catalog, simulate, approve, publish PDF, trace readable, back/forward form retains state.
- Migration + Prisma validation + lint/typecheck/build/API integration/Playwright, privacy & accessibility review PASS; no passwords in git; only then approve Stage 03 gate.

## 10. Pending product decisions
See \`../OPEN_DECISIONS.md\`: pricing version cutoff quote vs deposit vs acceptance; simultaneous policies; discount caps; tax-inclusive/exclusive; voucher one-use reservation; approval thresholds. Codex must present options and an ADR instead of silently choosing a tenant-wide default.
