# S5 item 4: durable source binding and revalidation for reviewed fields

Status: design only, 2026-11-15. Nothing here is implemented. Publication and
auto-approval stay paused (`scripts/local-directory-address-review-publish.cjs:59-62`)
until the slices in section 5 are done and the owner has answered section 6.

Addresses `HANDOFF-2026-11-15-HARDSTOP.md:39` (item 4).

## 0. What the code does today

Two databases are involved:

- **Live** (`ot_directory`): review candidates, decisions, and the served
  `directory_overture_private_row` whose `listing.reviewed` object is what the
  public read path projects.
- **Contact stage** (`ot_directory_census_stage`,
  `HANDOFF-2026-11-11-address-review.md:122,175`): a separate database holding the
  capture that retains addresses, websites, phones and `sources`.

Publish flow:

1. The script reads the stage once, outside any transaction
   (`local-directory-address-review-publish.cjs:138-147`), with
   `CONTACT_LISTING_SQL` (`local-directory-contact-listings.cjs:1-20`). That query
   returns `regionId`, `sourceFileRowNumber`, `listing` and three revocation
   booleans. It does **not** return the stage `scanId` or `policyId`, so the
   identity of the stage row is discarded immediately after the read.
2. Ambiguous keys and revoked records are dropped
   (`local-directory-contact-listings.cjs:37-51`); the survivor must match the
   candidate (`:27-34`, call at publish script `:231`).
3. `sourceFromContact` (publish script `:149-176`) builds the source object from
   the _candidate's_ name, category, point, address, website and phone, plus the
   stage row's `sources`.
4. `publishAddressReviewCandidate` resolves the live row
   (`address-review-publish.ts:96-136`, `:239-250`) and, in one live transaction
   (`:263-300`), checks the account fence (`:264`), locks the candidate, rechecks
   containment, and calls `attachLocalReviewedFields`
   (`overture-private-sink.ts:54-76`), which locks live policy, scan and row and
   writes `listing.reviewed = {website?, phone?, address?, attribution, notices,
termsUrls, evidenceUrl}` (`:71-72`).
5. The decision row records only `publication`, containment basis, assignment
   token and the display policy `releaseId` (`address-review-publish.ts:286-299`).

What is and is not covered afterwards:

- **Live** scan, row and policy withdrawal are rechecked on every read
  (`register-pending-runtime.ts:180-182`) and withdrawal deletes the rows
  (`overture-private-sink.ts:132-147`, `:149-187`, `:190-200`). This is sound.
- **Stage** withdrawal is seen only at step 1. Nothing durable says which stage
  scan, row or policy supplied `sources` and confirmed the contact fields, which
  display policy document was applied (only its `releaseId`), or what the copied
  values were. A stage withdrawal or correction after step 1 has no path to the
  live `reviewed` object. The window opens _before_ the live transaction, so a
  withdrawal between step 1 and step 4 is also missed.
- The read path treats `listing ? 'reviewed'` as sufficient
  (`register-pending-runtime.ts:188,200-206`).

Assumption to verify in slice 1: the stage database carries the same
`directory_overture_private_*` tables as the live one (the stage SQL relies on
it), and a stage row is immutable for a given `(scanId, sourceFileRowNumber)`,
so corrections arrive as a new scan. The 97,682 duplicate `(regionId, row)` keys
(`HANDOFF-2026-11-15-S5-PROGRESS.md:36`) are consistent with that.

## 1. Durable provenance model

### 1.1 Entity: `DirectoryReviewedBinding` (`directory_reviewed_binding`)

One row per publication event, in the live database, written in the publish
transaction. Per publication, with per-field hashes inside it; a per-field table
would multiply rows without adding proof, because all fields of one publication
share one stage row, one policy and one decision.

| Column                                                     | Type                                       | Meaning                                                                                                                                                       |
| ---------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                                       | uuid PK                                    | binding identity; referenced by events and, later, item 2's projection                                                                                        |
| `candidateId`                                              | uuid                                       | reviewed candidate (`entity.ts:222-248`)                                                                                                                      |
| `decisionId`                                               | uuid null                                  | the publication decision row (`entity.ts:250-265`); null only for legacy                                                                                      |
| `communityId`, `scanId`, `sourceFileRowNumber`             | uuid, varchar(64), bigint                  | the **live** served row                                                                                                                                       |
| `livePolicyId`                                             | varchar(64) null                           | live membership policy at publish (`address-review-publish.ts:134`)                                                                                           |
| `provenance`                                               | varchar(24)                                | `contact_stage`, `source_file`, or `unknown_legacy`                                                                                                           |
| `stageInstallationId`                                      | varchar(64) null                           | which stage database (see decision 2)                                                                                                                         |
| `stageScanId`, `stageSourceFileRowNumber`, `stagePolicyId` | varchar(64), bigint, varchar(64), all null | exact stage row and its membership policy                                                                                                                     |
| `displayPolicyReleaseId`                                   | varchar(64) null                           | `policy.releaseId` as supplied                                                                                                                                |
| `displayPolicyHash`                                        | varchar(64) null                           | sha256 of the canonical JSON of the runtime `OvertureRightsPolicy` document actually applied                                                                  |
| `stageContentHash`                                         | varchar(64) null                           | keyed hash of the canonical stage `listing` subset that fed publication: name, category, location, addresses, websites, phones, sources                       |
| `reviewedHash`                                             | varchar(64) null                           | keyed hash of the canonical `reviewed` object as written                                                                                                      |
| `fieldHashes`                                              | jsonb null                                 | `{field: {hash, origin}}` for name, category, point, address, website, phone, attribution, notices, termsUrls; `origin` is `live_row`, `candidate` or `stage` |
| `assignmentChangeToken`                                    | uuid null                                  | containment token written with the row                                                                                                                        |
| `state`                                                    | varchar(16)                                | `pending`, `active`, `suspended`, `retired`                                                                                                                   |
| `stateCause`                                               | varchar(40) null                           | last transition cause (section 2.2)                                                                                                                           |
| `verifiedAt`, `verifiedUntil`                              | timestamptz null                           | last successful stage revalidation and the lease expiry                                                                                                       |
| `suspendedAt`, `retiredAt`, `createdAt`                    | timestamptz                                |                                                                                                                                                               |

Constraints, all expressed on the entity so the migration is generated:

- `@Index` unique on `(scanId, sourceFileRowNumber)` with
  `where: "state" <> 'retired'`: one live binding per served row.
- `@Index` on `(stageScanId, stageSourceFileRowNumber)` and on `stagePolicyId`:
  the lookups used by revalidation and by the push accelerator.
- `@Index` on `(state, verifiedUntil)`: sweep scheduling.
- `@Check`: `provenance = 'unknown_legacy' OR ("stageScanId" IS NOT NULL AND
"stagePolicyId" IS NOT NULL AND "stageContentHash" IS NOT NULL AND
"reviewedHash" IS NOT NULL AND "decisionId" IS NOT NULL)` for `contact_stage`
  (the `source_file` variant requires the hashes and decision but not stage ids).
- `@Check`: `provenance <> 'unknown_legacy' OR state IN ('suspended','retired')`.
  The database itself refuses to make a legacy row visible.
- `@Check`: `state <> 'active' OR "verifiedUntil" IS NOT NULL`.

`@Check` is already used in this file (`entity.ts:89-90,103-104`).

### 1.2 Entity: `DirectoryReviewedBindingEvent` (`directory_reviewed_binding_event`)

Append-only: `id`, `bindingId`, `kind` (`published`, `confirmed`, `suspended`,
`reconfirmed`, `retired`), `cause`, `observedStageHash` null, `runId` null,
`decisionId` null, `createdAt`. Unique `(bindingId, kind, cause)` gives
idempotent transitions (a binding enters each terminal cause once; a
re-publication is a new binding). Routine successful verifications only advance
`verifiedAt`/`verifiedUntil` on the binding and are not logged, to keep the
table bounded.

Neither table has an actor column. Human actions are referenced through
`decisionId`, so no new identity column enters the Directory (section 4.1).

### 1.3 Hashing

Canonical JSON (sorted keys, trimmed strings, no insignificant whitespace),
HMAC-SHA-256 with a Directory-held key. A keyed hash is recommended over a bare
sha256 because a phone number or short address is guessable, and an unkeyed
digest retained after withdrawal would be a recoverable derivative of withdrawn
data. `displayPolicyHash` can be a plain sha256: the policy document is not
withdrawn content.

### 1.4 Why this is sufficient

- **From where**: `(stageInstallationId, stageScanId, stageSourceFileRowNumber)`
  is the stage's own primary key (`entity.ts:164-170`), not the ambiguous
  `(regionId, row)` key; `stagePolicyId` is the immutable membership
  (`entity.ts:204-210`).
- **Under what authority**: `displayPolicyHash` pins the exact policy document,
  not just a release label; `livePolicyId` pins the live cohort.
- **What**: `stageContentHash` proves what the stage held at publish;
  `reviewedHash` and `fieldHashes` prove what was written and which fields came
  from the candidate versus the stage. A later comparison of current stage
  content or current `listing.reviewed` against these detects drift on either
  side, including a hand edit of the live JSON.
- **By which decision**: `decisionId`, plus the containment token.
- It stores no copy of stage content, so retiring a binding leaves no
  withdrawn text behind.

It does not prove anything about publications made before it existed (section 3).

## 2. Revalidation and invalidation

### 2.1 Pull is the authority; push is an accelerator

The stage is a plain database written by scripts through `OverturePrivateSink`.
It has no service process, so "stage emits" would mean an outbox table in the
stage plus a relay, and correctness would then depend on every withdrawal path
writing the outbox and on the relay running. With no cross-database
transaction, a lost or reordered push is undetectable from the Directory side.

Chosen: **pull with a lease, plus best-effort push.**

- The Directory owns a sweeper that reads the stage read-only and transitions
  bindings in live transactions.
- Reviewed fields are served only under a current lease (`verifiedUntil >
now()`). Missing revalidation therefore hides data by itself; no message has
  to arrive for the system to fail closed.
- Stage withdrawal operators additionally call the same invalidation function
  directly after the stage commit. That shortens the window from one lease to
  seconds, but nothing depends on it.

Stage revocation is monotone: revocation rows are durable denials and
`policy.revoked` is never cleared (`entity.ts:172-202`,
`overture-private-sink.ts:132-200`). A withdrawal observed once is final, which
is what makes retiring on a single observation safe.

### 2.2 States

| State       | Entered when                                                               | Public read shows                                                                                        | Live `listing.reviewed`         |
| ----------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `pending`   | publish transaction commits                                                | row as an unreviewed listing: no address, phone, website, no reviewed coordinates, not in bounds results | present                         |
| `active`    | post-commit confirmation or sweep re-read of the stage succeeds; lease set | reviewed fields, while `verifiedUntil > now()`; otherwise as `pending`                                   | present                         |
| `suspended` | uncertain signal (below), or legacy                                        | as unreviewed                                                                                            | present, retained for re-review |
| `retired`   | definite withdrawal, human revoke, suspension timeout, or replaced         | as unreviewed                                                                                            | removed in the same transaction |

Signals from one stage read of the bound `(stageScanId, stageRow)`:

| Observation                                                                                                               | Transition                                  | Cause                   |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------- |
| stage scan revocation row exists                                                                                          | → `retired`                                 | `stage_scan_revoked`    |
| stage row revocation row exists                                                                                           | → `retired`                                 | `stage_row_revoked`     |
| stage policy `revoked = true`                                                                                             | → `retired`                                 | `stage_policy_revoked`  |
| row absent, no completion, and no revocation record                                                                       | → `suspended`                               | `stage_row_missing`     |
| row present, hash differs from `stageContentHash`                                                                         | → `suspended`                               | `stage_content_changed` |
| a different completed, unrevoked stage scan under the same policy holds the same `(regionId, row)` with different content | → `suspended`                               | `stage_superseded`      |
| same, identical content                                                                                                   | stay `active`                               | none (decision 6)       |
| current `listing.reviewed` hash differs from `reviewedHash`                                                               | → `suspended`                               | `live_reviewed_drift`   |
| live row gone (live withdrawal)                                                                                           | → `retired`                                 | `live_row_withdrawn`    |
| all checks pass                                                                                                           | `pending`/`active` → `active`, extend lease | `confirmed`             |
| stage unreachable or query error                                                                                          | no transition; lease not extended           | none                    |

Rights withdrawal retires and strips because retaining withdrawn content in a
hidden column is itself non-compliance. Corrections and missing rows suspend
because a human has to decide. Corrected values are **never** copied
automatically: they were not reviewed. A suspended binding is resolved by
re-review. Reconfirmation is a fresh run of the full publish path, which
retires the old binding (`replaced`) and creates a new one from current stage
content. A human revoke retires it. A binding suspended longer than the
timeout (decision 5) is retired with `suspension_expired`.

Retiring removes `reviewed` with the same guarded update the human revoke
already uses (`address-review-store.ts:486-495`) and sets the candidate back to
a non-published status with an automated decision row, so the candidate and the
served row never disagree.

### 2.3 Read path

`register-pending-runtime.ts` currently uses `r.listing ? 'reviewed'` as the
reviewed test (`:188,190,200`). Replace it with an SQL-side
`EXISTS (binding WHERE scanId/row match AND state = 'active' AND
"verifiedUntil" > now())`, used for the reviewed-first ordering, the bounds
filter and the projection. A row with `reviewed` JSON but no qualifying binding
is projected exactly as a row without it. Because the test is in SQL, it runs
before pagination and `hasMore`, as the contract requires
(`S5-public-contract.md`, bounds paragraph). The listing identity and detail
routes use the same predicate. Responses stay `no-store`.

### 2.4 Ordering and races

**Withdrawal during publish.** The stage read happens before the live
transaction and cannot be made atomic with it. The design bounds the exposure:

1. Publish reads the stage, now including `scanId`, `policyId` and content.
2. The live transaction inserts the binding as `pending`. Nothing is visible.
3. After commit, a confirmation step re-reads the stage for that binding and
   only then sets `active` with a lease.

Because stage revocation is monotone, any withdrawal committed before step 3's
read is seen by step 3, and the binding is retired without ever having been
visible. Any withdrawal after step 3 is seen by the next sweep, so the exposure
is at most one lease (or seconds with the push accelerator). There is no
interleaving in which reviewed fields are visible with no binding.

**Lock order.** Every writer takes: account fence advisory locks (only when a
human identity is involved) → candidate `FOR UPDATE` → binding `FOR UPDATE` →
live policy → live scan lock → live row. This extends the existing publish order
(`address-review-publish.ts:264-271`, `overture-private-sink.ts:35-52,65-67`).
The human revoke path currently updates the row without the scan lock
(`address-review-store.ts:484-495`); slice 3 brings it into this order.

**Idempotency.** Transitions are compare-and-set
(`UPDATE ... WHERE id = $1 AND state = $expected`); `retired` is absorbing; the
event unique key makes a repeated push or overlapping sweeps a no-op. A sweep
run takes `FOR UPDATE SKIP LOCKED` on its batch so two sweepers do not block.

**Stale read.** A sweep that read the stage at T and commits at T+δ could
extend a lease past a withdrawal committed in between. The lease is computed
from the stage read time, not the commit time, so the error is bounded by δ and
corrected by the next run.

### 2.5 Failure behaviour

Fail closed, with one tolerance: the lease. Stage unreachable, misconfigured, or
erroring means no extension; when `verifiedUntil` passes, reviewed fields
disappear from public reads without any write. Listings themselves remain
(unreviewed presentation); the endpoint does not return 503 for this. Readiness
reports the count of expired leases so the degradation is visible. Recovery is
automatic on the next successful sweep; no data was removed.

Consequence the owner must accept (decision 3): the stage database becomes a
runtime dependency of reviewed-field visibility for as long as bindings point
at it.

## 3. The 48 legacy publications

A match found today does not show what was read on the day of publication, and
writing stage identifiers into a binding for them would be fabricated
provenance (`HANDOFF-2026-11-15-HARDSTOP.md:39`;
`HANDOFF-2026-11-15-S5-PROGRESS.md:42` records the match only as a current
observation).

Treatment:

1. No backfill of stage columns. The read gate in section 2.3 hides all 48 the
   moment it ships, because they have no binding.
2. An operator script (dry-run by default, not a migration) inserts one binding
   per currently published candidate with `provenance = 'unknown_legacy'`,
   every stage, hash and decision column null, `state = 'suspended'`,
   `stateCause = 'legacy_no_provenance'`. The check constraint makes it
   impossible to activate such a row. This gives an exact, queryable account of
   the 48 instead of an implicit "rows with no binding".
3. Each is resolved by re-review through the new publish path once publication
   is unpaused: that creates a real binding dated at re-publication, and the
   legacy row is retired with `replaced`. Evidence age limits apply
   (`address-review-publish.ts:181-186`), so some will need evidence re-fetched.
4. Legacy rows not re-reviewed by the suspension timeout are retired and their
   `reviewed` JSON stripped.

Trade-off: local evaluation loses 48 reviewed addresses and map pins, and with
publication paused they stay hidden until the owner unpauses and someone
re-reviews them. The alternative, a grace period that keeps them visible, would
mean serving data whose source cannot be shown to be un-withdrawn; five rows of
this same cohort were already withdrawn as wrong-town
(`S5-public-contract.md`, 2026-11-15 section). Hiding is recommended.

## 4. Interaction with other items

### 4.1 Item 5: account deletion fence

- The two new tables hold no account, profile or reviewer identifier. Human
  actions are linked by `decisionId` into `directory_address_review_decision`,
  which the lifecycle participant already handles
  (`account-lifecycle.ts:220`, `account-lifecycle-dispositions.ts:223`).
- Publish and human revoke keep `assertDirectoryIdentitiesUnfenced` as the
  first statement in the transaction (`address-review-publish.ts:264`,
  `address-review-store.ts:470`); the binding insert or retirement is added
  after it, inside the same transaction. The sweeper acts as the system and
  names no identity, so it takes no fence lock and cannot be blocked by, or
  block, a deletion.
- Erasing a reviewer nulls the decision's actor; the binding stays valid
  because it depends on the decision row existing, not on its actor.
- Slice 6 adds both tables to the disposition inventory next to
  `directory_overture_private_row`
  (`account-lifecycle-dispositions.ts:285-288`) as "no identity, retained", and
  to the export source list as having nothing to export.

### 4.2 Item 2: spatial index and reviewed-only projection

Item 2 needs a reviewed-only projection with "reliable lifecycle updates" and
"historical reconciliation" (`HANDOFF-2026-11-15-HARDSTOP.md:37`). This design
supplies both without choosing the index:

- The set of `active` bindings **is** the reviewed-only set. Item 2 can key its
  projection by `bindingId` and add its geometry column and GiST index in its
  own entity change; nothing here adds geometry or exposes unreviewed points.
- All state changes go through one function (`transitionBinding`), which is
  the single place item 2 hooks projection insert and delete, in the same
  transaction.
- The lease cannot live in a partial index predicate (`now()` is not
  immutable). Item 2 should index on `state = 'active'` and keep
  `verifiedUntil > now()` as a filter column in the query.
- The legacy accounting in section 3 is the historical reconciliation: no
  assignment identity is guessed.

### 4.3 Item 3: source freshness

`verifiedAt` means "the stage still vouched for this row at that time". It is
not source freshness and must not be shown as such. The binding stores
`displayPolicyReleaseId` as a claim only. Item 3 adds upstream release and
acquisition evidence keyed by scan; the binding already carries `scanId` and
`stageScanId`, so freshness joins to it with no change here. Bindings whose
scans have no evidence stay "freshness unknown", independent of binding state.

## 5. Implementation plan

Every migration is produced by
`NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run directory:typeorm:migration:generate`
from the entity change named, reviewed, applied up/down/up to a fresh disposable
database, and checked with `pnpm run validate:typeorm-migrations`. Tests are
`apps/directory/test/*.postgres.test.js` against disposable databases; none
touch `ot_directory` or the stage. Publication stays paused throughout.

**Slice 1 — canonical hashing (no migration).**
New `apps/directory/src/reviewed-binding.ts`: canonical JSON, keyed hash,
`stageContentSubset`, `fieldHashes`. Test `reviewed-binding.test.js`: key order
and whitespace do not change the hash; any single field change does; absent
optional phone/website hash the same as each other and differently from empty
string. Also confirm the stage schema assumption in section 0 read-only and
record the result.

**Slice 2 — entities and generated migration.**
`apps/directory/src/entity.ts`: add `DirectoryReviewedBinding` and
`DirectoryReviewedBindingEvent` with the indexes and checks in 1.1/1.2; register
in `data-source.ts`. Test `reviewed-binding-schema.postgres.test.js`: second
non-retired binding for the same row is rejected; a retired one plus a new one
is accepted; `unknown_legacy` cannot be set `active`; `contact_stage` without
stage ids is rejected; `active` without `verifiedUntil` is rejected; duplicate
event key is rejected.

**Slice 3 — publish and revoke write the binding.**
`scripts/local-directory-contact-listings.cjs`: return stage `scanId` and
`policyId` alongside the listing. `address-review-publish.ts`: accept a
`sourceBinding` input, insert the `pending` binding and `published` event
inside the existing transaction, return `bindingId` and the decision id.
`address-review-store.ts`: human revoke of a published candidate retires the
binding in the same transaction and adopts the lock order in 2.4. Publish script
passes the binding and still exits on `--apply`. Extend
`address-review-publish.postgres.test.js`: binding row matches the stage keys
and hashes of the fixture; transaction rollback leaves no binding; a fenced
actor leaves no binding; revoke retires the binding and strips `reviewed`
atomically. Extend `local-directory-contact-listings.postgres.test.js` for the
new columns.

**Slice 4 — read gate.**
`register-pending-runtime.ts` (and the identity/detail lookups) use the binding
predicate from 2.3. New `reviewed-binding-read.postgres.test.js`: row with
`reviewed` JSON and no binding, `pending`, `suspended`, `retired`, or `active`
with an expired lease projects as unreviewed and is excluded from bounds
results; `active` with a current lease projects reviewed fields; `hasMore` is
computed after the gate. Extend `local-listing-cursor.concurrent.postgres.test.js`
so a binding suspended between pages disappears from the next page. Shipping
this slice hides the 48 (decision 1).

**Slice 5 — revalidation, confirmation and the race test.**
New `apps/directory/src/reviewed-binding-revalidate.ts`
(`readStageState`, `transitionBinding`, `confirmBinding`, `sweepBindings`,
`invalidateForStage({scanId|policyId|row})`); new
`scripts/local-directory-reviewed-binding-sweep.cjs` (dry-run default). New
`reviewed-binding-revalidate.postgres.test.js` using **two** disposable
databases (live and stage): each row of the signal table in 2.2; stage
unreachable leaves state untouched and lets the lease lapse; running a sweep
twice produces one event; retirement strips `reviewed` and resets the candidate.
New `reviewed-binding-race.postgres.test.js`:
(a) stage row withdrawn after the publisher's stage read and before the live
commit: binding ends `retired`, and a reader polling throughout never observes
reviewed fields;
(b) stage policy withdrawn after confirmation: hidden no later than lease
expiry with no sweep, and retired by the next sweep;
(c) sweep and human revoke on the same binding concurrently: both return, one
`retired` event, no deadlock;
(d) two sweepers on the same batch: no double transition.

**Slice 6 — legacy accounting, push accelerator, inventory.**
New `scripts/local-directory-reviewed-binding-legacy.cjs` (dry-run default)
inserting `unknown_legacy` suspended bindings for published candidates with no
binding; test `reviewed-binding-legacy.postgres.test.js`: idempotent, never
`active`, stage columns null, count equals published-without-binding. Stage
withdrawal operator scripts call `invalidateForStage` after their stage commit.
`account-lifecycle-dispositions.ts` and `account-export-sources.ts` gain the two
tables; extend `account-lifecycle.postgres.test.js` to show deletion leaves
bindings intact and unfenced sweeps proceed during a fence. Readiness reports
expired-lease and suspended counts. Update `S5-public-contract.md` and
`SLICE-STATUS.md`.

Unpausing publication is not a slice. It is an owner decision after slices 1-6
and the remaining items in the pause message.

## 6. Decisions needing owner confirmation

1. **Hide the 48 legacy publications when the read gate ships.**
   Recommended: yes; no grace period.
2. **Stage database identity.** Recommended: use the stage's
   `directory_installation.id` (`entity.ts:4-9`) if the stage has one; otherwise
   an operator-configured label recorded verbatim. Refuse to publish from a stage
   with neither.
3. **Stage as a runtime dependency.** The lease makes reviewed-field visibility
   depend on reaching the stage. Recommended: accept for local evaluation;
   before any public release, decide whether to keep the stage reachable or to
   consolidate the contact capture into the live database, which would make
   withdrawal transactional and remove the lease.
4. **Lease length and sweep interval.** Recommended: 24-hour lease, sweep
   hourly. Shorter is safer and costs stage reads.
5. **Suspension timeout before automatic retirement and stripping.**
   Recommended: 30 days, including legacy rows.
6. **A newer stage scan with identical content for the same `(regionId, row)`.**
   Recommended: stay active and record nothing; differing content suspends.
   The stricter alternative suspends on any newer scan.
7. **Keyed hash versus plain sha256 for content hashes.** Recommended: HMAC
   with a Directory-held key; key rotation makes old hashes unverifiable, so
   store a key id if rotation is expected.
8. **Retire and strip on stage rights withdrawal without human review.**
   Recommended: yes for scan, row and policy revocation; suspend for everything
   else.
9. **Corrections are never auto-applied.** Recommended: confirm; corrected
   values reach the public only through a new review and publication.
10. **Where the sweeper runs.** Recommended: operator script first (slice 5),
    with fail-closed leases covering missed runs; move to an in-process timer
    only when the stage dependency in decision 3 is settled.
11. **Owner Console surface for suspended bindings.** Out of scope here.
    Recommended: follow-up slice; until then the sweep script reports them.
12. **Non-stage (`source_file`) publications.** The file path at publish script
    `:33-34` has no revocation source to pull from. Recommended: record the
    binding with a file content hash, but do not allow `active` for
    `source_file` until a revalidation source is defined.
