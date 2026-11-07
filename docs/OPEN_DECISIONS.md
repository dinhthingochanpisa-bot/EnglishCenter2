# Stage 02 open decisions (not silently hard-coded)

1. **Definition of QL**: v1 follows 'lead has valid contact phone', with `qualified_at` kept as historical first qualification. Whether a phone supplied through other channels counts as QL without Lead verification is a future configurable policy.
2. **Lead status and conversion**: v1 marks `CONVERTED` when a Check-in is completed, *not when an HĐ is signed*. Contract conversion remains a separate later event.
3. **Duplicate reconciliation**: phone/name matches produce suggestions, no automatic merge. A future explicit Merge Case workflow needs permissions, reversible audit and conflict review.
4. **Required intake fields**: v1 requires student name, date of birth, school, grade, guardian name/phone to finish Check-in. Make field requirements configurable per tenant/branch after a reviewed schema for required-fields policies.
5. **Source attribution**: first-touch and check-in source are preserved independently; multi-touch attribution rules and contract attribution still pending BI specification.
6. **CRM pipeline customization**: v1 ships a controlled fixed set of status transitions; configurable funnels are a reporting feature, not permission to arbitrarily rewrite operational states.
7. **Cross-branch Person access**: v1 uses explicit `crm_person_branches` membership; secure cross-branch identity linking needs a controlled action and review before release.
8. **School-level lead collection**: website/online events import from third-party forms remains Stage Integrations; v1 has manually registered catalog entries, not live Meta/Zalo ingestion.
9. **Public form consent/retention**: store consent timestamp, but privacy notice and child data legal compliance require tenant-specific approved notices, retention and consent handling before production enablement.
10. **Guardian de-duplication**: within the same student, matching guardian name and phone reuses an existing guardian. Across different students, never merge solely by phone.
