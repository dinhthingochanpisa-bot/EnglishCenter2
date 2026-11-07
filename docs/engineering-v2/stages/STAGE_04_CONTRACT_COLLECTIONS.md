# Stage 04 — Contract, Receivables, Collections, Basic Financial Ledger

**Spec:** LUM-ENG-04 · Draft v2.0 · **M07 completion + M08 baseline**. Depends on Stage 03 approved quote and existing Stage 02 Customer 360. **Not included:** fee refund/transfer (Stage 08), class usage (Stage 05), tax authority connector (Stage 09).

## 1. Goals and actor responsibilities
- Convert approved quote into versioned **New/Renew** contract, preserving all accepted price and policy snapshots; attach signed documents; create invoice/receivable and record actual confirmed cash separately.
- Actors: TVV creates contract request, Branch Manager validates exceptions, Accountant confirms receipts and reconciles, Tenant Finance Admin sets payment methods/cash accounts; customer views quote and payment notice after permissions/consent.
- Contract value, receivable, cash collected, recognized revenue and lesson entitlement are five different measures; they MUST NOT be conflated.
- Contextual entry points: Customer 360 → Báo giá đã duyệt → Tạo HĐ / Lịch sử học phí; Finance → receivables/inbox; Sales → own contracts.

## 2. Screen flows
| UI | User path / expected |
|---|---|
| Contract creation | Approved quote → create contract → check person/branch/package/terms/signers → generate preview PDF → submit → approve where needed → sign evidence → activate |
| New/Renew chooser | Explicit New/Renew reason; system suggests type from prior completed pathways but never silently overrides |
| Contract detail | Permanent contract number, fee composition, policy snapshot, payment schedule, paid vs outstanding, attachments and audit timeline |
| Collection | Customer search → choose contract receivable → record intent/method/deposit/partial amount → require supporting evidence → accountant posts confirmed collection |
| Outstanding debt | By branch/assignee/due date, reminder timeline, outstanding aging and part-paid status |
| Payment allocation | One receipt can allocate to one or multiple receivables within **same tenant**; sum allocations <= posted receipt |

## 3. Data model (proposed)
Each tenant-owned row includes tenant_id, branch scope, immutable origin references, timestamps, row_version and actor IDs.
| Entity | Required data and constraint |
|---|---|
| contracts | person_id, quote_version_id, branch_id, contract_no unique per tenant/year/branch by configured sequence, type NEW/RENEW, status, signed_at, effective window |
| contract_versions | immutable terms, accepted total, product/package refs, change_reason, attachment hash, quote checksum |
| contract_lines | package_version_id, quantity, lesson entitlement **intent** (actual grant in Stage 05), list/discount/final amounts |
| signature_requests/signature_evidence | signers, signing flow, provider/source, signed file/hash, signed timestamp, IP/metadata with retention policy |
| receivables | contract_id, amount, currency, due_on, status OPEN/PARTIAL/SETTLED/VOID, balance cache derived from ledger |
| receivable_schedule_lines | milestone, amount, due date, optional deposit, late rule (ADR) |
| payment_intents | cashier input, method CASH/BANK_TRANSFER/POS/POS_INSTALLMENTS, reference, request hash, expiry, pending verification |
| payment_transactions | gateway/bank ref, external dedupe key unique (tenant,provider,external_id), received_at, posted_at, amount, state |
| payment_allocations | payment_id, receivable_id, amount; forbid negative/overallocation and cross-tenant/link mismatch |
| finance_ledger_entries | posted event group, debit_account, credit_account, amounts, currency, source, reversal link; immutable |
| invoice_requests/documents | number, external provider ids, status, tax mode, image/pdf/receipt evidence, retries with idempotency |
| credit_notes/adjustments | explicit reference and approval, not silent editing of posted payment |

### Data safety
- Monetary numeric(20,2) or exact VND integer subunits with documented currency units; no floats.
- Atomic posting group: payment state changes + allocations + ledger + audit + event outbox under one transaction.
- Unique idempotency per tenant and payment provider, including retry with identical body; conflicting retry => 409.
- Do not create lesson grants until configured contract acceptance/payment eligibility stage; contractual intent != delivery entitlement.

## 4. Contract state machine
\`DRAFT → PENDING_REVIEW → APPROVED → AWAITING_SIGNATURE → SIGNED → ACTIVE → FULFILLED\`; optional \`CANCELLED\`/ \`TERMINATED\` with manager authority and adjustments. Reject review creates auditable revision, not overwrite signed docs. No move to ACTIVE without required signatures plus contract activation rule (e.g. full payment or deposit must be **explicit policy**). \`RENEW\` does not necessarily mean student was active before; evaluate renewal eligibility by published tenant policy.

Payment intent \`CREATED → PENDING_VERIFICATION → CONFIRMED/REJECTED/EXPIRED\`; confirmed payment \`POSTED → REVERSED\` through reversal only. Receivable \`OPEN → PARTIAL → SETTLED\` derived by postings; cannot mark "paid" by toggling UI state.

## 5. Business invariants
1. A signed contract/quote snapshot is immutable; changes through explicit amended version/addendum or termination with trace.
2. Sum receivables for contract equals contractual amount under approved milestone/tax policy; differences documented.
3. For every payment: \`amountPosted = sum(allocations) + unappliedCash\` (if unapplied cash is allowed); no double-count of installments.
4. \`outstanding = postedReceivable - postedAllocations + reversals/adjustments\`; blocked if negative unless refundable credit via separate credit model.
5. Deposit is a payment, not a new second contract or automatic invoice; refundable status requires policy.
6. Cash receipts require accountant confirmation; user submitting collection intent cannot unilaterally post if SoD configured.
7. Chargeback/reversal produces ledger reverse entries and receivable reopen as needed; NEVER delete posted transaction.
8. Financial data access more restrictive than ordinary CRM; sales may view masked totals but not bank account or full ledger by default.
9. Refund and transfer **requests** not posted here; Stage 08 implements atomic ledger debit/credit.

## 6. API design (all prefixed \`/v1/tenants/:tenantId\`)
| Method/path | Payload | Required permission/result |
|---|---|---|
| POST \`/contracts\` | quoteVersionId,personId,branchId,contractType,terms | contract.create → 201 DRAFT |
| POST \`/contracts/:id/submit\` | rowVersion,reason | contract.submit → PENDING_REVIEW |
| POST \`/contracts/:id/approve\` | decision,reason,rowVersion | contract.approve; SoD |
| POST \`/contracts/:id/signature-requests\` | signerRefs,deliveryMethod | contract.sign.manage → signer task |
| POST \`/contracts/:id/activate\` | rowVersion,activationReason | contract.activate, policy check |
| GET \`/persons/:id/contracts\` | cursor, branchId | contract.read scoped Customer 360 |
| GET \`/receivables\` | branchId,asOf,status,dueBefore | finance.receivable.read paginated |
| POST \`/payment-intents\` | receivableId,amount,method,reference,metadata | finance.payment.collect → pending |
| POST \`/payment-intents/:id/confirm\` | receivedAt,bankRef,allocations[],rowVersion | finance.payment.post → posted transaction |
| GET \`/payments/:id\` | — | finance.payment.read (PII redacted) |
| POST \`/payments/:id/reverse\` | reason,approvalRef,Idempotency-Key | finance.payment.reverse → reversal |
| GET \`/contracts/:id/financial-summary\` | — | contract.read or finance summary scope |

**Example** payment confirm:
\`\`\`json
{"receivedAt":"2027-03-12T11:00:00+07:00","bankRef":"TEST-REF-001",
 "allocations":[{"receivableId":"uuid","amount":"5500000"}],"rowVersion":1}
\`\`\`
All money amounts response decimal strings, e.g. \`{contractAmount:"20000000",paidAmount:"5500000",balance:"14500000"}\`. Use \`Idempotency-Key\` on write; no raw bank/card data saved by app.

## 7. Required APIs/authorization/error contract
- \`401\` missing/expired token; \`403\` no tenant/finance permission; \`404\` out-of-scope ID; \`409\` stale version/duplicate reference/overpayment; \`422\` invalid contract amounts/unsupported payment method; \`423\` account restricted/tenant suspended where defined.
- E-invoice preview may be produced internally; connecting external provider is a separately gated integration with provider contracts and legal verification.
- POST confirmation requires uploaded/documented evidence from bank statement/approved manual verification; the system must not claim bank deposit arrived just from form entry.

## 8. Event contracts
\`contract.signed\`, \`contract.activated\`, \`receivable.created\`, \`payment.intent.created\`, \`payment.posted\`, \`payment.reversed\`, \`receivable.settled\`. Outbox events include tenantId, aggregateId, version, occurredAt and traceId; consume idempotently.

## 9. Acceptance / required tests
- Cross-tenant/branch contract and payment access denied (both API and database).
- Quote version snapshot remains unchanged after policy edits; contract value reconciles to signed quote.
- Partial payment of 5.5M against 20M => debt 14.5M, does not grant all sessions unless explicit entitlement rule.
- Repeating payment webhook/confirm with same idempotency key does not double-post; different body same key => 409.
- Negative/overflow/overallocation blocked; one receipt split across two receivables posts atomically.
- Payment reversal reopens balance; immutable ledger/audit retrievable and verified.
- Approval cannot be performed by requester in prohibited route; signing cannot be forged via frontend change.
- PDF/print matches signed contract, has stable hash; masked accountant vs sales UI enforced in backend.
- Both backend/API integration and browser UAT from Customer 360, export redaction, accessibility and pagination pass.

## 10. Open ADRs
Local e-invoice legal provider and tax schema, legal signature validation, refundability of deposit, activation gate (deposit vs full), debt interest/late reminders, contract number scheme, multi-currency, accounting posting method, exact NEW/RENEW policy. Keep configurable and document decisions; do not hard-code.
