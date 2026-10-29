# OT/TS local release handoff

Scope: Optimistic Tanuki (`client-interface`), Towne Square (`local-hub`) and
only their required shared services. Local readiness is distinct from permission
to deploy or announce a public release.

Release decision owner: the project owner/operator, C. J. Rutherford. The owner
must record the deployed revision, evidence for X01–X04 and the final decision.
This handoff does not make that decision or authorize publication.

## Verified local evidence

All five R6 slices are locally complete. No local slice remains in the scoped
OT/TS sequence. **Public release is not yet qualified:** X01–X04 below remain open.
The project owner/operator must make the explicit release decision after the
required external evidence is available.

The current snapshot passed four focused tests, both app builds, three owning
lint targets (before the final copy-only clarification), and one real-service
browser case. Sixteen scoped light/dark accessibility reports have zero
violations. Twenty [screenshots](./evidence/r6-local/README.md) are bound by the
[source/image manifest](./evidence/r6-local/manifest.json). Only expected
signed-out session 401 diagnostics remain. All 99 private application tables were
empty after teardown, resources removed and 43 protected files unchanged.

Receipts: [R6-01](./evidence/df-007/checkpoint-r6-01.json),
[R6-02](./evidence/df-007/checkpoint-r6-02.json),
[R6-03](./evidence/df-007/checkpoint-r6-03.json),
[R6-04](./evidence/df-007/checkpoint-r6-04.json),
[R6-05](./evidence/df-007/checkpoint-r6-05.json).

## Local closeout checklist

- [x] R6-01: all 58 inventoried claim statements have dispositions and evidence.
- [x] R6-02: both products lead from public guidance to their own account and starting workflow.
- [x] R6-03: shared privacy/support language matches accepted data and retention behavior.
- [x] R6-04: current rebuilt screenshot/demo provenance and browser diagnostics reviewed.
- [x] R6-05: receipts, links, source/artifact hashes and private teardown validated.

The [claim ledger](./evidence/df-007/r6-claim-ledger.json) preserves the 47
historical RR-01 IDs and adds 11 explicit account-data/guidance statements.
No fabricated adoption, free-forever, guaranteed delivery, end-to-end encryption,
Pro/donation promotion, permanent hosting or external payment-execution claim is
introduced. Existing early-access descriptions retain their qualifications.

## Operator demo

Use an isolated environment and test accounts. Do not capture real credentials,
private content, financial details or deletion recovery receipts in launch media.

1. Build both apps through Nx and run the private guide proof:
   `python3 tools/account-deletion-private-fixture.py --run --skip-build --release-guide`.
   This uses cached Docker dependencies, fresh migrated databases and the real
   production routes. It does not send provider mail or execute a payment.
2. On each public landing, open Getting started. Follow the product's own account
   link, sign in with an approved test account, then open Your account data.
3. Return to Getting started. OT leads to Feed; TS leads to Browse places. Do not
   replace empty locality data with invented adoption statistics.
4. Open Privacy and account data. Confirm retention, shared-account scope,
   blocked deletion/retry and external-copy limits. Follow Contact HAI support.
5. Review the captured light/dark help/privacy pages at 390/1280 and account
   controls. The screenshot manifest records exact source and image hashes.

The R6 proof is a guide/navigation/demo case. The existing
[R4 receipts](./findings/DF-007-R4-05.md) separately establish local native
buyer/seller and upload/chat recovery behavior. Existing
[U03](./findings/DF-007-U03.md), [D27](./findings/DF-007-D27.md) and
[R2](./findings/DF-007-R2-03.md) retain their own revision-specific evidence.
The R6 mode does not reaccept deletion, external signup, providers or payments.

## External release gates — still open

| ID  | Required evidence                                                                                                                                                 | Decision/evidence owner        | State |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----- |
| X01 | Actual OAuth, verification/recovery email, invitation delivery and app-held provider-grant operations; relevant payment-provider execution before advertising it. | Operator with provider access  | OPEN  |
| X02 | Exact deployed revision/images/configuration, secure network/session operation, current production AV definitions, reliability/load and replica inventory.        | Deployment operator            | OPEN  |
| X03 | Backup restore/purge policy and executed evidence; object-store versions/retention and any remote copies or future log collector cleanup/readback.                | Storage/observability operator | OPEN  |
| X04 | Operational support readiness, support intake/delivery and explicit final release decision after required evidence.                                               | Project owner/operator         | OPEN  |

On 2026-10-26 the operator confirmed no forwarded log destinations and no retained
legacy/manual OT/TS logs. That dated local premise does not qualify a future
collector or deployed environment. Future [OpenTelemetry/Grafana setup](../operators/ot-ts-observability.md)
must re-enter the copy inventory and account-safe handling proof; no collector
was installed by this work.

## Stop conditions and recovery

Do not publish a feature claim that exceeds its evidence. Keep release blocked
when a required external gate has no proof, when custody/cleanup is pending,
when builds differ from the captured source, or when real workflows fail.
A local cash record is not proof of payment or settlement. A test-signature
scanner is not production malware-definition qualification. A completed in-app
deletion status is not proof that downloads, offline devices or backups were wiped.

For a problem introduced by this batch, the owned production surface is the new
shared information page/export and OT/TS help/privacy routes and links. Preserve
pre-existing account-rights and deletion work. Use a reviewed forward fix or
revert only the batch's owned changes; do not reset the shared checkout. Rebuild
and requalify affected routes, update the claim ledger and capture new evidence.
