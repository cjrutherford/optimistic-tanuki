# OT and Towne Square release completion sequence

**Current OT/TS position:** A01–A07 backend export slices are locally qualified; D00 is next. Use the [scoped remaining register](../release-readiness/REMAINING-SLICES.md). The historical 75-delivery table below is not the current two-product release denominator.

**Current OT/TS position:** A01–A07 backend export slices are locally qualified; D00 is next. Use the [scoped remaining register](../release-readiness/REMAINING-SLICES.md). The historical 75-delivery table below is not the current two-product release denominator.

**Current OT/TS position:** A01–A07 backend export slices are locally qualified; D00 is next. Use the [scoped remaining register](../release-readiness/REMAINING-SLICES.md). The historical 75-delivery table below is not the current two-product release denominator.

**Scope clarification (2026-10-23):** The authoritative audit scope is `client-interface` (Optimistic Tanuki), `local-hub` (Towne Square), their required shared services and shared HAI navigation. Historical platform records retain their IDs and accepted evidence as reference. Another product does not become release work through queue position or shared infrastructure alone.

Updated: 2026-10-23. Sequence starting accepted baseline: `661853166a332596ffe1cbfd172a98a6f339bc28` (J28).

**Goal:** finish the already selected local release work in order: account rights, inactivity/log retention, integrated journeys, then launch materials. Real external flows and production release qualification remain separately owned.

**Active scope:** OT (`client-interface`) and TS (`local-hub`) only. N03 is locally verified; **N04 is next**. See the [N03 finding](../release-readiness/findings/DF-007-N03.md). N01, N02 and O09-P/C/I remain accepted. Do not use the historical platform inventory as a release denominator or start another product owner from its queue position.

The [technical register](../release-readiness/REMAINING-SLICES.md) and historical rows below preserve existing IDs and accepted receipts. They do not define an additional product scope or a remaining-release denominator.

The [master audit](../release-readiness/MASTER-AUDIT.md) remains the acceptance authority. The [completion map](../release-readiness/DF-007-COMPLETION-MAP.md) and technical register hold detailed evidence and dependencies. The application boundary above governs active execution; the technical rows below preserve existing IDs and evidence without making unrelated products release requirements.

## Execution and reporting rules

1. Finish the current delivery before starting the next. Independent mapping or verification can run alongside it, with flat Luna workers and disjoint owned paths. Work in the current checkout; preserve the 43 excluded Directory/Compose/tsconfig files.
2. For each O delivery, approve every field/store disposition, implement bounded owner capture, then integrate it with the existing leased snapshot/job pipeline. These are internal checks, not three new finish lines. Reuse shared Storage/contracts/session/UI infrastructure; new reusable UI belongs in a library.
3. Apply the common pre-E2E gate: inspect affected Nx/CI targets; run the narrow regression, changed-contract checks, owning production build/lint and affected E2E lint. Use Node 24, `NX_DAEMON=false`, `NX_ISOLATE_PLUGINS=false`. Run API drift or migration checks when that surface changes. Do not repeat unchanged accepted checks.
4. Acceptance needs the row's observable result: real owner/service/database evidence where required, allow/deny and counterpart cases, failure/retry/restart, independent readback and fixture cleanup. Source presence, mocks or policy approval alone cannot complete an owner delivery. Retain the existing generated-migration rules.
5. At closeout report **completed outcome; evidence and checks not run; exact existing IDs completed and remaining OT/TS outcomes; next existing ID; blockers**. Update the finding, receipt, master audit and both execution views together. An internal checkpoint is reported as progress within the current delivery.
6. Keep this list fixed. Map discoveries to an existing outcome and identify the impact there. If a discovery really changes scope, state the precise addition and reason before changing the baseline; do not silently create a replacement sequence. Unknown ownership cannot count as empty successful capture.
7. Keep jobs and UI truthful. Export becomes available only after its complete accepted coverage and artifact gates; deletion only after its accepted readbacks. Completion of local implementation does not authorize production release or external acceptance claims.

## Historical technical inventory — existing IDs preserved

O01, O02, O04 and O09 retain their accepted evidence. All other owner rows require an OT/TS workflow dependency before implementation. O03 remains unstarted. Historical numbering does not establish release scope.

### 1. Finish the remaining export owners

One owner is complete only when its field/store policy, real bounded capture, and leased job integration all pass. The capture must prove owned/shared/counterpart boundaries, exact counts/digests, failure/retry/restart and cleanup. Existing database-owner capture stays accepted at its recorded scope.

| Order | Existing ID     | Finished outcome                                                 | Acceptance                                                                                                                                                                                                        |
| ----- | --------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | O01 (P → C → I) | workspace: account export captured and integrated — **VERIFIED** | Approved ownership/field/store policy; real paged capture; authenticated leased job integration and independent cleanup. Global export stays incomplete until A01–A07.                                            |
| 2     | O02 (P → C → I) | app-configurator: account export captured and integrated         | **VERIFIED**: [O02 receipt](../release-readiness/evidence/df-007/checkpoint-o02.json); 757 receipts across three sources; nine-service job and independent cleanup. Global export stays incomplete until A01–A07. |
| 3     | O03 (P → C → I) | blogging: account export captured and integrated                 | Approved ownership/field/store policy; real paged capture; authenticated leased job integration and independent cleanup. Global export stays incomplete until A01–A07.                                            |
| 4     | O04 (P → C → I) | chat-collector: account export captured and integrated           | **VERIFIED**: [O04 receipt](../release-readiness/evidence/df-007/checkpoint-o04.json); 509 conversation/sent-message receipts, ten-service leased job and independent cleanup. Global export remains incomplete.  |
| 5     | O05 (P → C → I) | telos-docs-service: account export captured and integrated       | Approved ownership/field/store policy; real paged capture; authenticated leased job integration and independent cleanup. Global export stays incomplete until A01–A07.                                            |
| 6     | O06 (P → C → I) | project-planning: account export captured and integrated         | Approved ownership/field/store policy; real paged capture; authenticated leased job integration and independent cleanup. Global export stays incomplete until A01–A07.                                            |
| 7     | O07 (P → C → I) | learning-service: account export captured and integrated         | Approved ownership/field/store policy; real paged capture; authenticated leased job integration and independent cleanup. Global export stays incomplete until A01–A07.                                            |
| 8     | O08 (P → C → I) | wellness: account export captured and integrated                 | Approved ownership/field/store policy; real paged capture; authenticated leased job integration and independent cleanup. Global export stays incomplete until A01–A07.                                            |
| 9     | O09 (P → C → I) | classifieds: account export captured and integrated              | **VERIFIED OT/TS ONLY**: [O09 receipt](../release-readiness/evidence/df-007/checkpoint-o09.json); 253 receipts, explicit scope filtering and leased-job cleanup.                                                  |
| 10    | O10 (P → C → I) | payments: account export captured and integrated                 | Approved ownership/field/store policy; real paged capture; authenticated leased job integration and independent cleanup. Global export stays incomplete until A01–A07.                                            |
| 11    | O11 (P → C → I) | store: account export captured and integrated                    | Approved ownership/field/store policy; real paged capture; authenticated leased job integration and independent cleanup. Global export stays incomplete until A01–A07.                                            |
| 12    | O12 (P → C → I) | billing: account export captured and integrated                  | Approved ownership/field/store policy; real paged capture; authenticated leased job integration and independent cleanup. Global export stays incomplete until A01–A07.                                            |
| 13    | O13 (P → C → I) | finance: account export captured and integrated                  | Approved ownership/field/store policy; real paged capture; authenticated leased job integration and independent cleanup. Global export stays incomplete until A01–A07.                                            |
| 14    | O14 (P → C → I) | system-configurator-api: account export captured and integrated  | Approved ownership/field/store policy; real paged capture; authenticated leased job integration and independent cleanup. Global export stays incomplete until A01–A07.                                            |
| 15    | O15 (P → C → I) | lead-tracker: account export captured and integrated             | Approved ownership/field/store policy; real paged capture; authenticated leased job integration and independent cleanup. Global export stays incomplete until A01–A07.                                            |
| 16    | O16 (P → C → I) | civic: account export captured and integrated                    | Approved ownership/field/store policy; real paged capture; authenticated leased job integration and independent cleanup. Global export stays incomplete until A01–A07.                                            |
| 17    | O17 (P → C → I) | compliance-audit: account export captured and integrated         | Approved ownership/field/store policy; real paged capture; authenticated leased job integration and independent cleanup. Global export stays incomplete until A01–A07.                                            |

### 2. Close non-database account stores

Complete each existing local store contract and its independent readback. External execution evidence remains X-owned; it cannot be silently represented as a local pass.

| Order | Existing ID            | Finished outcome                                                                                                   | Acceptance                                                                                                                           |
| ----- | ---------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 18    | N01 **VERIFIED OT/TS** | Enumerate and address per-account queues, processing jobs and outboxes, including media workers and delivery jobs. | Complete producer/consumer inventory, write/cancel fencing and restart/readback proof.                                               |
| 19    | N02 **VERIFIED OT/TS** | Address permission/session caches and transient OAuth state without persisting bearer credentials.                 | Account-scoped invalidation, stale replica denial, cookie/bearer compatibility.                                                      |
| 20    | N03 **VERIFIED OT/TS** | Address search indexes, materialized projections and secondary persistence found by reconciliation.                | Exact source-to-index attribution and independent account cleanup/readback; explicit evidence if a candidate store is absent.        |
| 21    | N04                    | Address account-identifiable application/activity logs and local sink deletion contracts.                          | Sink inventory and immediate account-deletion behavior, with no undisclosed retained copies. The rolling 90-day rule is R2-02 below. |
| 22    | N05                    | Address object-store versions, media derivatives, in-flight processing and encryption-key custody.                 | Complete version/derivative inventory, race fences, recoverable deletion ordering and independent reads.                             |
| 23    | N06                    | Address browser/local persisted account state using shared session/account infrastructure.                         | Signout/deletion/account-switch cleanup across products; no stale cross-account state.                                               |
| 24    | N07                    | Address application-held provider grants and provider adapter revocation/deletion contracts.                       | No external provider-account deletion; local ownership/redaction and failure/retry proved. Live external calls remain X01.           |

### 3. Deliver the export file and download

Finish complete coverage first, then artifact assembly, durable publication, authorized download and expiry. A07 is the full local export acceptance gate.

| Order | Existing ID | Finished outcome                                                                                 | Acceptance                                                                                                                                   |
| ----- | ----------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 25    | A01         | Close required-owner/store coverage manifest and fail-closed orchestration.                      | Every reconciled store has an accepted participant or evidenced disposition; missing/unavailable owner blocks completion.                    |
| 26    | A02         | Assemble portable manifest/JSON and verified media references, safe filenames and MIME.          | Exact counts/digests, full declared text, images/video/HLS and inline images; no arbitrary URL fetch or raw storage paths.                   |
| 27    | A03         | Persist encrypted artifacts atomically with bounded assembly and recoverable key custody.        | Interrupted write/restart, digest verification, quota/expiry and zero orphaned plaintext staging.                                            |
| 28    | A04         | Connect durable artifact assembly to resumable/background jobs without storing user credentials. | Two-worker fencing, idempotency, lost-lease denial, restart and cleanup before publication.                                                  |
| 29    | A05         | Authorize downloads with expiry/revocation and safe streaming headers.                           | Own account allowed; foreign account/app, expired/revoked session denied; bytes/filename/length/range behavior verified.                     |
| 30    | A06         | Expire artifacts and all retained versions/keys on schedule and account deletion.                | Boundary times, retries, crash recovery and independent version/key readback.                                                                |
| 31    | A07         | Run complete local export journey against the required-owner matrix.                             | Real multi-account records/media, failure/restart/retry, privacy, downloads and precise cleanup. No global complete flag before this passes. |

### 4. Deliver recoverable account deletion

D00 establishes the durable operation and write fence. D01–D24 implement owner adapters/readbacks under that fence. Each must preserve counterpart content and tolerate retry. D25 closes non-ORM cleanup; D26 removes final root identities/keys after dependent recovery is safe; D27 proves the full operation. Preserve original ordering/dependencies.

| Order | Existing ID | Finished outcome                                                                                   | Acceptance                                                                                                                          |
| ----- | ----------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 32    | D00         | Durable deletion job, account write fence, session revocation and counterpart-placeholder contract | Requires A07 and N01–N07; deletion remains recoverable after sessions are revoked.                                                  |
| 33    | D01         | Authentication                                                                                     | Accepted owner policy; authenticated deletion under D00; counterpart preservation; retry/restart and independent row/byte readback. |
| 34    | D02         | Profile/current and retained legacy stores                                                         | Accepted owner policy; authenticated deletion under D00; counterpart preservation; retry/restart and independent row/byte readback. |
| 35    | D03         | Assets                                                                                             | Accepted owner policy; authenticated deletion under D00; counterpart preservation; retry/restart and independent row/byte readback. |
| 36    | D04         | Videos                                                                                             | Accepted owner policy; authenticated deletion under D00; counterpart preservation; retry/restart and independent row/byte readback. |
| 37    | D05         | Permissions                                                                                        | Accepted owner policy; authenticated deletion under D00; counterpart preservation; retry/restart and independent row/byte readback. |
| 38    | D06         | Social                                                                                             | Accepted owner policy; authenticated deletion under D00; counterpart preservation; retry/restart and independent row/byte readback. |
| 39    | D07         | Forum                                                                                              | Accepted owner policy; authenticated deletion under D00; counterpart preservation; retry/restart and independent row/byte readback. |
| 40    | D08         | `workspace`                                                                                        | Accepted owner policy; authenticated deletion under D00; counterpart preservation; retry/restart and independent row/byte readback. |
| 41    | D09         | `app-configurator`                                                                                 | Accepted owner policy; authenticated deletion under D00; counterpart preservation; retry/restart and independent row/byte readback. |
| 42    | D10         | `blogging`                                                                                         | Accepted owner policy; authenticated deletion under D00; counterpart preservation; retry/restart and independent row/byte readback. |
| 43    | D11         | `chat-collector`                                                                                   | Accepted owner policy; authenticated deletion under D00; counterpart preservation; retry/restart and independent row/byte readback. |
| 44    | D12         | `telos-docs-service`                                                                               | Accepted owner policy; authenticated deletion under D00; counterpart preservation; retry/restart and independent row/byte readback. |
| 45    | D13         | `project-planning`                                                                                 | Accepted owner policy; authenticated deletion under D00; counterpart preservation; retry/restart and independent row/byte readback. |
| 46    | D14         | `learning-service`                                                                                 | Accepted owner policy; authenticated deletion under D00; counterpart preservation; retry/restart and independent row/byte readback. |
| 47    | D15         | `wellness`                                                                                         | Accepted owner policy; authenticated deletion under D00; counterpart preservation; retry/restart and independent row/byte readback. |
| 48    | D16         | `classifieds`                                                                                      | Accepted owner policy; authenticated deletion under D00; counterpart preservation; retry/restart and independent row/byte readback. |
| 49    | D17         | `payments`                                                                                         | Accepted owner policy; authenticated deletion under D00; counterpart preservation; retry/restart and independent row/byte readback. |
| 50    | D18         | `store`                                                                                            | Accepted owner policy; authenticated deletion under D00; counterpart preservation; retry/restart and independent row/byte readback. |
| 51    | D19         | `billing`                                                                                          | Accepted owner policy; authenticated deletion under D00; counterpart preservation; retry/restart and independent row/byte readback. |
| 52    | D20         | `finance`                                                                                          | Accepted owner policy; authenticated deletion under D00; counterpart preservation; retry/restart and independent row/byte readback. |
| 53    | D21         | `system-configurator-api`                                                                          | Accepted owner policy; authenticated deletion under D00; counterpart preservation; retry/restart and independent row/byte readback. |
| 54    | D22         | `lead-tracker`                                                                                     | Accepted owner policy; authenticated deletion under D00; counterpart preservation; retry/restart and independent row/byte readback. |
| 55    | D23         | `civic`                                                                                            | Accepted owner policy; authenticated deletion under D00; counterpart preservation; retry/restart and independent row/byte readback. |
| 56    | D24         | `compliance-audit`                                                                                 | Accepted owner policy; authenticated deletion under D00; counterpart preservation; retry/restart and independent row/byte readback. |
| 57    | D25         | Non-ORM store cleanup                                                                              | All N01–N07 stores cleared under the deletion fence, with independent readback.                                                     |
| 58    | D26         | Final root identities and key removal                                                              | Every dependent participant acknowledged; recoverable final identity/key removal and minimal permitted receipt.                     |
| 59    | D27         | End-to-end deletion recovery                                                                       | Injected failure/restart/retry across the full operation; no stranded bytes or stale sessions; counterpart preservation proved.     |

### 5. Connect and qualify shared account controls

Reuse existing account/settings controls. Exercise the accepted backend operation rather than a preview or fabricated completion status. U03 includes both products and affected primary clients.

| Order | Existing ID | Finished outcome                                                                        | Acceptance                                                                                                                     |
| ----- | ----------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 60    | U01         | Connect existing shared account/settings controls to real export status/retry/download. | Authenticated OT/Towne Square flows, errors, keyboard/focus and no false completion.                                           |
| 61    | U02         | Connect deletion confirmation/status/recovery to real deletion jobs.                    | Clear consequences, correct account, explicit confirmation, failure/retry and revoked-session behavior.                        |
| 62    | U03         | Validate both products and affected primary clients together.                           | Browser evidence at relevant viewports, accessibility and account isolation. New reusable elements belong in shared libraries. |

### 6. Finish inactivity and log retention

These are recommendation 2, after local account rights. Seven-day rolling inactivity has no absolute lifetime cap. The 90-day rule covers every inventoried account-activity sink; separately owned remote execution remains explicit.

| Order | Existing ID | Finished outcome                                                       | Acceptance                                                                                                                            |
| ----- | ----------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 63    | R2-01       | Seven-day rolling inactivity expiry, without an absolute lifetime cap. | Natural expiry, activity/refresh boundaries, revocation and cross-replica/session compatibility.                                      |
| 64    | R2-02       | Ninety-day removal for every inventoried account-activity log sink.    | Exact cutoff, scheduling, retry, independent readback and no retained-data exceptions.                                                |
| 65    | R2-03       | Integrate retention with deletion, jobs and shared status.             | Account deletion wins over retention windows; no stale replica/job can restore removed data. External execution/sinks are X evidence. |

### 7. Qualify integrated user journeys

These are recommendation 4. Cover both products and relevant clients, real account isolation, recovery, accessibility and responsive behavior. Local provider failure contracts remain distinct from external delivery.

| Order | Existing ID | Finished outcome                                 | Acceptance                                                                                                           |
| ----- | ----------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 66    | R4-01       | Account switching and session/account isolation. | Both products, owned secondary profiles, cookie restore and stale-state denial.                                      |
| 67    | R4-02       | Locality, membership and owner journeys.         | Authorized owner/member/nonmember boundaries and recoverable local errors.                                           |
| 68    | R4-03       | Buyer/seller journeys.                           | Counterpart isolation, purchase/sale local failure contracts and accurate status.                                    |
| 69    | R4-04       | Shared accessibility closeout.                   | Keyboard navigation, focus restoration, error/status announcements and responsive controls.                          |
| 70    | R4-05       | Upload/realtime/deep-link recovery.              | Upload retry, network interruption, route restoration and socket reconnect without duplicate writes or stale access. |

### 8. Make release claims match accepted behavior

These are recommendation 6. Use VERIFY/COMPLETE/REWORD/RETRACT/DEFER. Screenshots and launch material must show accepted behavior. The launch decision stays operator-owned.

| Order | Existing ID | Finished outcome                       | Acceptance                                                                                                                |
| ----- | ----------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 71    | R6-01       | Reconcile all remaining claims.        | Every advertised claim has VERIFY/COMPLETE/REWORD/RETRACT/DEFER disposition linked to evidence.                           |
| 72    | R6-02       | Complete first-session guidance.       | Both products describe and lead to accepted behavior; no invented counts or unavailable rights.                           |
| 73    | R6-03       | Align public policy/support text.      | Privacy, account rights, retention and support promises match accepted behavior and open external obligations.            |
| 74    | R6-04       | Capture verified screenshots/demos.    | Exact reviewed revision and real usable workflows, with no staged unsupported claims.                                     |
| 75    | R6-05       | Assemble launch checklist and handoff. | Local slice evidence, unresolved external checks and explicit release decision owner; no premature release qualification. |

## Separately owned release acceptance

These existing obligations are outside the 75 local deliveries and remain required for the corresponding release claims:

- **X01:** real OAuth, email, invitations and provider-held data/grant execution.
- **X02:** exact deployed revision/images, production load and environment qualification.
- **X03:** backups, operational object versions, remote log sinks and executed purge evidence.
- **X04:** operational support and the operator's final release decision.

## Historical O01 Workspace receipt

Owned implementation is `apps/workspace`, its existing contracts and the Authentication account-export job adapter. The policy receipt selects the recorded account **and** a currently owned captured profile, preserves scope as context, and treats source IDs as opaque. Shared registration labels are inert metadata; membership, other contributors and source-service contents are separate owners. Current bindings do not prove historical authorship or consent.

O01-P verifies one entity/12 columns, no relations, three local store dispositions, the two-table/15-column migrated catalog and scoped identity indexes. O01-C must enforce that receipt with bounded, repeatable-read owner capture through the existing Storage driver. O01-I must add Workspace to the authenticated leased job and qualify exact Profile-parent/lease/session binding, failure-prefix/retry, restart/revocation and cleanup. **All three O01 checks passed; see the [O01 finding](../release-readiness/findings/DF-007-O01.md).**

Workspace and App Configurator capture and integration are accepted at the local scope recorded in the O01 and O02 receipts. No artifact, download, deletion or production qualification is implied. O04 messaging is now accepted because both release applications use it. O03 remains unstarted; another owner requires a release-workflow/shared-account dependency trace. Retain this register and its existing IDs.

## Latest completed OT/TS delivery: O09 Classifieds

**O09-P, O09-C and O09-I locally verified.** The [finding](../release-readiness/findings/DF-007-O09.md) and [receipt](../release-readiness/evidence/df-007/checkpoint-o09.json) record 253 listing receipts, explicit two-app filtering, failure/retry and independent cleanup. No other product is qualified. Overall export, download and deletion remain incomplete.

N01 acceptance is limited to the two-app inventory and per-work-item fencing/recovery. Permanent account-wide producer fencing and deletion remain D00. See the [receipt](../release-readiness/evidence/df-007/checkpoint-n01.json).

N02 backend replica/session/OAuth acceptance is recorded in the [receipt](../release-readiness/evidence/df-007/checkpoint-n02.json). Permanent account-wide fencing and browser cleanup remain D00 and N06.

N03 store-level cleanup and catalog acceptance is recorded in the [receipt](../release-readiness/evidence/df-007/checkpoint-n03.json). D00 permanent fencing and N06 browser cleanup remain open.
