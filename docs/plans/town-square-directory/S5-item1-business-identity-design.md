# S5 item 1 — cross-release canonical business identity (design)

Date: 2026-11-16. Design only; nothing here is built. Source of the requirement:
[HANDOFF-2026-11-15-HARDSTOP.md](HANDOFF-2026-11-15-HARDSTOP.md) line 36. Builds on items 2, 3, 4 and 5
([spatial](S5-item2-spatial-projection-design.md), [freshness](S5-item3-source-freshness-design.md),
[binding](S5-item4-source-binding-design.md), [lifecycle](S5-account-lifecycle-design.md)).

Paths below are relative to `apps/directory/src/` unless they start with `scripts/` or `docs/`.

## 0. Findings that shape the design

- **F1. The upstream Overture `id` (GERS) is not stored anywhere.** The extractor hands the whole source
  row to the projector (`SELECT * EXCLUDE (region_ids)`, `scripts/overture-private-extractor.mjs:148`,
  `:158`), but the projector's input type has no `id` (`overture-private-projection.ts:5`), its output is
  name/category/location/attribution only (`overture-private-projection.ts:21`), and the sink copies only
  approved fields into `listing` (`overture-private-sink.ts:9`, `:225-226`). `directory_overture_private_row`
  is `(scanId, sourceFileRowNumber, regionId, listing)` (`entity.ts:164-170`). No historical row can be
  matched by upstream id without re-reading its artifact.
- **F2. `id` is outside the rights map.** `overture-rights.ts:5-13` maps names, category, taxonomy,
  geometry, address, phone and website. Retaining an upstream identifier is a new retained field and needs
  an explicit policy position (decision 1).
- **F3. The existing "identity" is a row identity.** `directory_listing_identity` is unique on
  `(communityId, scanId, sourceFileRowNumber)` (`entity.ts:239-241`); its own comment says it binds exact
  source rows, not businesses (`listing-identity.ts:7`). The public contract says the `id` "is not
  automatically transferred to a different scan or a later source release"
  (`docs/plans/town-square-directory/S5-public-contract.md:15`).
- **F4. Everything durable hangs off that row key.** Owner links key on `listingId`
  (`entity.ts:295-312`, `listing-business-link.ts:30`, `:45`, `:69`); address-review candidates are unique on
  `(scanId, sourceFileRowNumber)` (`entity.ts:249-250`); a live reviewed binding is unique per row
  (`entity.ts:333-334`); the spatial projection deletes by `(scanId, row)` (`overture-private-sink.ts:182`);
  cursors and sealed references carry `{scanId,row}` (`local-listing-reference.ts:4`,
  `register-pending-runtime.ts:275`, `:285`).
- **F5. A release is a cohort of scans under one policy, and cutover revokes the old policy.** `scanId` is a
  digest of inventory, item and artifact etag (`scripts/overture-private-extractor.mjs:98`); the October
  cutover expects 16 completed scans and revokes the previous policy in the same transaction
  (`scripts/local-directory-overture-cutover.cjs:41-56`). Revocation purges rows and projection entries in
  batches (`overture-private-sink.ts:166-190`). The read path serves every completed scan under any
  non-revoked policy (`register-pending-runtime.ts:267-271`), so two live cohorts would list a business twice.
- **F6. Row numbers prove nothing across scans.** 97,682 `(regionId, sourceFileRowNumber)` keys repeat across
  completed stage scans (HARDSTOP handoff, "Code and verification" bullet 3). A unique content match at one
  time was already refused as proof of provenance (HARDSTOP item 4).
- **F7. Live counts were not taken.** The local database refused the credentials available to this session,
  and no attempt was made to find others. Slice 0 takes the counts.

## 1. Identity model

### 1.1 Tables (all new, all Directory-owned)

**`directory_business`** (`DirectoryBusiness`): the canonical entity. It holds no listing content.

| column | notes |
| --- | --- |
| `id` uuid PK | the stable public identifier |
| `communityId` uuid | identity is town-scoped, like `directory_listing_identity` |
| `state` | `active`, `retired`, `merged`, `split` (check constraint) |
| `successorId` uuid null | set only for `merged`, or for `split` when a reviewer names a primary successor |
| `stateCause` varchar(40) null, `createdAt`, `retiredAt` | |

**`directory_business_assertion`** (`DirectoryBusinessAssertion`): "this row of this scan is this business".
The name avoids `membership`, which already means scan-to-policy (`entity.ts:232-236`).

| column | notes |
| --- | --- |
| `id` uuid PK, `businessId`, `communityId` | |
| `scanId` varchar(64), `sourceFileRowNumber` bigint | unique together: a row asserts at most one business |
| `policyId` varchar(64) | the cohort; unique `(businessId, policyId)` where `state='current'` |
| `evidence` | `origin`, `upstream_id`, `owner_confirmed`, `reviewer_confirmed`, `artifact_reread` |
| `confidence` | `origin`, `carried`, `corroborated`, `confirmed` |
| `upstreamKeyHash` varchar(64) null | keyed hash of the upstream id (see 1.2) |
| `nameHash` varchar(64) null | keyed hash of the normalised name, for the drift guard only |
| `state` | `current`, `superseded`, `withdrawn` |
| `predecessorAssertionId` uuid null, `createdAt` | |

**`directory_overture_source_key`** (`DirectoryOvertureSourceKey`): `(scanId, sourceFileRowNumber)` PK,
`upstreamKeyHash`, `keyVersion`. Written by the sink in the batch-commit transaction; kept out of the
`listing` JSON so no read path can serve it. Not deleted by single-row withdrawal (needed for stable
duplicate counting, 2.2); deleted with the scan purge.

**`directory_business_event`** (`DirectoryBusinessEvent`): append-only. `businessId`, `kind` (`created`,
`carried`, `corroborated`, `confirmed`, `unresolved`, `retired`, `merged`, `split`), `cause`, `scanId`,
`sourceFileRowNumber`, `otherBusinessId`, `decisionId` null. Unique `(businessId, kind, scanId,
sourceFileRowNumber)` makes each transition idempotent, as in `entity.ts:379-380`. No actor column.

**`directory_business_identity_decision`** (slice 6): `id`, `communityId`, `action`, `actorId` uuid null,
`actorDomain` varchar(16) null, `reason`, `createdAt`. The only identity table that names a person.

### 1.2 The upstream key

The sink receives the upstream `id` beside the projected listing (not inside it) and stores
`HMAC(key, 'business-identity-v1\0' + id)` using a dedicated `DIRECTORY_BUSINESS_IDENTITY_HMAC_KEY`, following
`reviewed-binding.ts:61-67`. The raw id is never persisted. Losing or rotating the key stops automatic
carry (`keyVersion` mismatch reads as "no key") and nothing else: fail closed. A row with a missing, empty,
non-string or over-long upstream id gets no source-key row and can never be carried automatically.

### 1.3 Evidence and confidence

| confidence | created by | what it unlocks |
| --- | --- | --- |
| `origin` | first sighting of a row that needed durable identity | a stable id for exactly that row |
| `carried` | automatic: upstream key equality passing every rule in 2.2 | the stable public id resolves to the new row; reviewer queue priority |
| `corroborated` | automatic derivation: `carried` **and** equal `nameHash` **and** the new row has since earned its own active binding through item 4 whose address field hash equals the predecessor's last active binding's (`fieldHashes`, `entity.ts:333-378`) | owner link restore (decision 4) |
| `confirmed` | a human: the owner re-confirming their own link, or a reviewer decision | everything, including merge and split |

"Reviewed-address match" is therefore never a way to *find* a successor. It only corroborates a pair that
upstream-key equality already proposed, and only after the new row has been independently reviewed.

### 1.4 Never automatic

- Matching by `sourceFileRowNumber`, `(regionId, row)`, name, category, coordinates, address text, or any
  "only one candidate fits" reasoning (F6).
- Merge, split, un-retire, or carry across towns.
- Copying reviewed fields, a binding, a candidate or a decision onto a new row (2.4).
- Making an owner link visible on a new row at `carried` confidence.
- Resolving a duplicate by picking the newest, lowest or first row.

### 1.5 Ambiguity fails closed

For a town and a target cohort, group source-key rows by `upstreamKeyHash`:

- **Duplicate:** more than one cohort row in the town has the hash (including withdrawn rows and rows in
  different scans of the cohort). None is carried. Each is `unresolved`.
- **Conflict:** the hash appears on assertions of more than one non-retired business in the town. None is
  carried.
- **Inactive predecessor:** the one matching business is `retired`, `merged` or `split`. Not carried; the
  row is `unresolved` for a reviewer. A merged predecessor is not followed automatically.
- **Split upstream:** one old key, and in the new cohort the same key plus unrelated new keys. The key
  carries; the new keys are new businesses. Whether the business "really" split is a reviewer question.
- **Merge upstream:** two old businesses, one key survives. The survivor carries; the other is simply absent
  (2.5). Nothing merges without a reviewer.

`unresolved` is an event plus the absence of an assertion. An unresolved row is still listed like any other
row; it just has a row-scoped id (3.1) and inherits nothing.

## 2. Carry-forward on a new scan or cutover

### 2.1 When it runs

A new operator command, `scripts/local-directory-business-identity-carry.cjs` (`--check`; `--apply
--confirm-database <db>`), in the style of the reconcile script from item 2. It must run **after** every scan
of the target cohort has a completion row and source evidence, and **before** the old policy is revoked,
because the purge removes the predecessor rows (F5). The cutover script gains a precondition: refuse to
revoke the old policy unless the carry state for `(town, oldPolicy → newPolicy)` is `complete`. Because the
needed hashes live on the assertion, a late or repeated run after the purge still works; the precondition
exists to keep owner links and public ids continuous.

A singleton-per-pair row in `directory_business_carry_state` (`communityId`, `fromPolicyId`, `toPolicyId`,
`planDigest`, `state` `planned|running|complete`, `cursorScanId`, `cursorRow`) records progress.

### 2.2 Algorithm

1. **Preconditions.** Target policy exists and is not revoked; all its scans for the town are complete; each
   has `directory_overture_source_evidence` (`entity.ts:202-222`) with a `releaseId` strictly newer than the
   source cohort's. A cohort without evidence is never carried into or out of automatically.
2. **Plan (`--check`, read-only).** For each cohort row with a source key, classify by 1.5 into `carry`,
   `new`, or `unresolved:<cause>`. `planDigest` is SHA-256 over the sorted `(hash, scanId, row, verdict)`
   tuples.
3. **Apply.** Batches of 500 in `(scanId, row)` order, one transaction each: re-evaluate the classification
   in SQL for the batch; abort the whole run if any verdict differs from the plan; insert the new assertion
   `current`; set the predecessor `superseded`; write the event; advance the cursor.
4. **Drift guard.** A `carry` whose `nameHash` differs from the predecessor's stays `carried` but is flagged
   `name_changed` in the event and can never reach `corroborated`.
5. **Finish.** Mark the pair `complete`. Businesses with no assertion in the new cohort are *absent*, not
   retired (2.5).

**Determinism.** Verdicts depend only on two sets: hashes in the cohort and hashes on businesses in the
town. The cohort is complete and immutable; row withdrawal does not delete source-key rows, so a withdrawal
between plan and apply cannot turn a duplicate into a unique match. Businesses change only under the town
lock (2.3).

**Idempotency.** Unique `(scanId, row)` and unique current `(businessId, policyId)` with `ON CONFLICT DO
NOTHING` followed by an equality check; the event unique key; the persisted cursor. A re-run after
`complete` is a no-op that re-verifies the digest.

### 2.3 Concurrency

Identity transactions take, in order: account fence advisory locks (only when a human is involved,
`account-lifecycle-fence.ts:43`) → `pg_advisory_xact_lock('directory-business-identity:' + communityId)` →
target policy `FOR SHARE` → business rows `FOR UPDATE` in id order → assertion writes.

- Identity code **never** locks a candidate, a binding, a scan lock or a listing row, and never writes
  `directory_overture_private_row` or `directory_reviewed_spatial`.
- The item-4 sweep locks candidate → binding → policy → scan lock → row
  (`reviewed-binding-revalidate.ts:257-258`, `:363-366`; design 2.4) and never locks a business. The only
  shared resource is the policy row, where identity holds `FOR SHARE` briefly. There is no lock cycle.
- The item-2 projection is maintained only by binding writers and reads only bindings and rows. It does not
  store `businessId`, so carry-forward cannot make it drift.
- A row withdrawn or a policy revoked mid-run leaves a harmless assertion: every read still rechecks row,
  scan and policy (`register-pending-runtime.ts:267-271`).
- `corroborated` is derived by a read of bindings *outside* any identity lock, then written under the town
  lock with compare-and-set; the read path re-checks the binding predicate at use (3.2), so a binding
  suspended in between simply removes the benefit.

### 2.4 What migrates and what is re-confirmed

| object | on carry |
| --- | --- |
| Reviewed binding | **Never carried.** The new row shows no reviewed fields until it gets its own candidate, decision, `pending` binding and `confirmBinding` (`reviewed-binding-revalidate.ts:388`) against the new stage scan. Carry only raises its priority in the review queue. |
| Address-review candidate and decisions | Stay on their own `(scanId, row)`. History is reachable through business → assertions. No copying, so item 5 dispositions are unchanged. |
| Spatial projection | Nothing. The new row is projected when its own binding goes active. |
| Owner link | `carried`: link enters `awaiting_confirmation`, hidden. `corroborated` or `confirmed`: restored atomically (decision 4). A new `directory_business_link_carry` row (`requestId`, `businessId`, `fromListingId`, `toListingId`, `state`) records it; restore moves the `directory_business_link_active` row to the new listing identity and appends a link event in one transaction. `directory_business_link_request` gains nullable `businessId`; revoke (`listing-business-link.ts:52-61`) must accept the active listing as well as the original. |
| Listing identity rows | Kept as aliases (3.1). |

A reviewer may see "stage content unchanged since the last approved review" (equal `stageContentHash`,
`reviewed-binding.ts:91`) as a hint. It never approves by itself (decision 5).

### 2.5 Absence, retirement, merge, split

- **Absent:** no current assertion in the newest complete cohort. State stays `active`; the id does not
  resolve (3.2). If the key reappears in a later cohort it carries again only when exactly one cohort was
  skipped (decision 7); otherwise `unresolved`.
- **Retire:** reviewer decision, or automatic after N consecutive absent cohorts (decision 7). Absorbing.
- **Merge / split:** reviewer decisions only (slice 6). Merge sets `state='merged'`, `successorId`. Split
  creates new businesses for the named rows and sets the original to `split`, optionally with a primary
  successor.

## 3. Public references and cursors

### 3.1 The stable id

In cursor and identity mode the listing `id` (`register-pending-runtime.ts:303-306`) becomes:

- the **business id** when the row has a `current` assertion to an `active` business;
- otherwise the existing row-scoped listing identity, exactly as today.

Both are random UUIDs and indistinguishable to a client. No confidence level, evidence kind, carry flag or
"this was matched" hint is exposed. Ids are issued lazily for the page being served, as now.

### 3.2 Resolving an id (`register-pending-runtime.ts:320`)

1. Look up a business in the town. If `merged`, follow `successorId` (at most 5 hops, cycle check); if
   `split`, follow only a reviewer-named primary successor. Take its `current` assertion in a live cohort.
2. Else look up a listing identity. If its row is still served, use it. If not, and that row has an assertion
   whose business resolves by step 1, use that row (alias).
3. Run every existing check on the resolved row: town eligibility, policy, scan and row withdrawal,
   assignment token, adult choice, binding predicate for reviewed fields.
4. Return the canonical `id` in the body so clients can update.

Unknown, retired, absent, unresolved, split-without-successor, wrong-town and withdrawn all return the same
404. There is no redirect status and no existence oracle. Reviewed fields are served only through the
resolved row's own active binding, so an id can never surface fields reviewed for a previous release.

This changes the sentence at `S5-public-contract.md:15`; slice 4 updates the contract.

### 3.3 Sealed references and cursors

They stay row-keyed, short-lived and non-canonical (`local-listing-reference.ts:11`). One change: the cursor
query binding (`local-listing-cursor.ts:3-7`) and the reference context gain a **serving generation**: a
keyed hash of the sorted live policy ids for the town. A cutover changes it, so a cursor or reference from
before the cutover is rejected like a change-token mismatch and the client restarts. No cursor ever crosses a
release; ordering stays `(scanId, row)`; the non-snapshot semantics are unchanged.

### 3.4 Overlapping cohorts

If two cohorts are live for a town at once, a business would appear twice (F5). The read query adds: when a
row's business has a `current` assertion in a different cohort, serve only the `current` one. Rows without
assertions are unaffected. The cutover remains the supported path; this is a guard, not a feature.

## 4. Historical data

- Existing scans have no source key (F1). **No historical row is matched to any other row.**
- Slice 7 mints `origin` businesses only for rows that anchor something durable: a listing identity that has
  a link request, a row with a non-retired binding, or a row with a published candidate. Each gets one
  assertion with `upstreamKeyHash` null. These cannot carry automatically.
- **Verified re-read (optional, decision 6).** `scanId` commits to the artifact etag
  (`scripts/overture-private-extractor.mjs:98`). Re-reading the *same* object (etag or SHA-256 equal to the
  scan's evidence, `entity.ts:212-213`) at the *same* `file_row_number` yields that row's upstream id as a
  fact, not a match. The backfill additionally requires the re-read name, category and point to equal the
  stored listing, records `evidence='artifact_reread'`, and skips any row where the object is gone or
  differs. It needs network access and so needs owner approval. Scans without item-3 evidence are excluded.
- Everything else stays unresolved indefinitely. Duplicate `(regionId, row)` keys are never consulted.

### Account deletion (item 5)

Every new table and column must be classified or the catalogue drift check fails
(`account-lifecycle-dispositions.ts:8`, `:538-544`, `:576`, `:625`).

| table | disposition |
| --- | --- |
| `directory_business`, `_assertion`, `_event`, `directory_overture_source_key`, `directory_business_carry_state`, `directory_business_link_carry` | `none(..., 'source-data')`, like `directory_listing_identity` (`account-lifecycle-dispositions.ts:277-282`): keyed hashes and identifiers, no account or profile id |
| `directory_business_identity_decision` | same treatment as `directory_business_link_event` (`:123`): `actorId` nulled, `actorDomain` kept; export source added in `account-export-sources.ts` |
| `directory_business_link_request.businessId` | added to the existing request entry (`:72`) |

Deleting an owner already removes their active link (`:108`). The same transaction must set that owner's
`directory_business_link_carry` rows to `closed`, so a deleted owner's link cannot be restored by a later
carry. Owner re-confirmation calls `assertDirectoryIdentitiesUnfenced` first. A business outlives its owner.

## 5. Slices

Each slice: entity change → migration generated by the Directory Nx migration target (never hand-written;
commit the generated timestamp) → `pnpm run validate:typeorm-migrations` → tests on a fresh disposable
database (`s5_identity_<slice>_<timestamp>`), never `ot_directory`. Nx runs with `NX_DAEMON=false
NX_ISOLATE_PLUGINS=false`. New test targets go in `apps/directory/project.json` beside
`test-reviewed-binding-race` and `test-listing-identity`.

**Slice 0 — read-only census.** `scripts/local-directory-business-identity-census.cjs` (`--check` only).
Reports rows, cohorts, listing identities with and without a surviving row, link requests/active, bindings by
state, candidates by status. No schema. Test: runs against a seeded disposable DB and writes nothing.

**Slice 1 — capture the upstream key.** Files: `overture-rights.ts` (decision 1), `overture-private-projection.ts`
(return the id beside the listing), `overture-private-sink.ts` (write `directory_overture_source_key` in the
commit transaction, `:284-298`; delete in the scan purge, `:182-184`), `entity.ts`, `data-source.ts`,
`account-lifecycle-dispositions.ts`. Tests (`test-overture-private-sink`, extended):
1. a committed batch writes one key row per eligible row and none for a quarantined row;
2. `listing` JSON never contains the id or the hash;
3. missing, empty, non-string and 300-character ids write no key row and do not fail the batch;
4. row withdrawal keeps the key row; scan purge removes it;
5. a replayed batch at a stale checkpoint writes nothing.

**Slice 2 — entities and the pure classifier.** Files: `entity.ts`, new `business-identity.ts` (pure
`classifyCohort`), dispositions. Tests (`test-business-identity`, unit): unique → carry; two cohort rows one
hash → both unresolved; one hash on two businesses → unresolved; retired/merged/split predecessor →
unresolved; name change → carry with flag; no key → new; input order does not change the digest. Plus
`test-account-lifecycle` catalogue check passes with the new tables.

**Slice 3 — carry-forward engine and script.** Files: new `business-identity-carry.ts`,
`scripts/local-directory-business-identity-carry.cjs`, `scripts/local-directory-overture-cutover.cjs`
(precondition). Tests (`test-business-identity-carry`, PostgreSQL):
1. happy path: 3 businesses carried, predecessors superseded, events written;
2. **duplicate:** two rows share a hash in different scans of the cohort → neither carried, business absent;
3. **duplicate then withdrawal:** one of the two is withdrawn between `--check` and `--apply` → still
   unresolved, digest unchanged;
4. **upstream split:** old key plus a new key → one carry, one new, no link between them;
5. **upstream merge:** two businesses, one key survives → one carry, one absent, no `merged` state;
6. **conflict:** hash present on two active businesses → unresolved;
7. cohort without source evidence, or with an older `releaseId`, is refused;
8. idempotency: second `--apply` changes zero rows; a run killed after batch 1 resumes from the cursor;
9. two concurrent `--apply` runs: one waits on the town lock, final state equals a single run;
10. **race with the sweep:** run `sweepBindings` (`reviewed-binding-revalidate.ts:425`) in a loop on one
    connection while carry applies on another, with a third revoking the old policy halfway. Assert no
    deadlock error, no `lock_timeout`, every binding is in a legal state, `measureSpatialDrift`
    (`reviewed-spatial.ts:152`) reports zero, and no reviewed field is readable on any new-cohort row;
11. cutover refuses while the carry state is not `complete`.

**Slice 4 — read path, resolver, serving generation.** Files: `register-pending-runtime.ts`,
`listing-identity.ts`, `local-listing-cursor.ts`, `local-listing-reference.ts`, `S5-public-contract.md`.
Tests (`test-business-identity-read`, PostgreSQL, plus the cursor unit tests):
1. the same `id` resolves before and after a cutover, to the new row, with **no** reviewed fields until the
   new binding is active;
2. an old listing-identity id resolves through the alias and returns the canonical id;
3. retired, absent, unresolved, split-without-successor and unknown ids return byte-identical 404s;
4. merged follows the successor; a 6-hop chain and a cycle both 404;
5. a pre-cutover cursor and sealed reference are rejected after cutover;
6. two live cohorts list a carried business once.

**Slice 5 — owner links.** Files: `listing-business-link.ts`, `entity.ts`, dispositions,
`account-lifecycle.ts`. Tests (`test-listing-business-link-postgres`, extended): link hidden at `carried`;
restored at `corroborated`; owner re-confirm restores and writes an event; a fenced owner cannot
re-confirm; owner deletion closes the carry row and a later carry does not restore; revoke works on the
moved link; two concurrent restores yield one active row.

**Slice 6 — reviewer decisions.** Files: `business-identity-decision.ts`, entity, Gateway and Owner Console
endpoints. Confirm, merge, split, retire. Tests: each is compare-and-set and idempotent; merge of two
businesses with active links is refused until one link is revoked; split never leaves a row with two
assertions; actor disposition and export covered in `test-account-lifecycle-postgres`.

**Slice 7 — historical anchors and optional re-read.** Files:
`scripts/local-directory-business-identity-anchor.cjs`, optional `-reread.cjs`. Tests: anchors minted only
for the three anchor classes; a seeded pair of scans with identical `(regionId, row)` and identical content
produces two unrelated businesses; re-read with a different etag, or a differing name, writes nothing.

**Slice 8 — readiness and queue.** `readiness.ts` gains `businessIdentity {unresolved, absent,
awaitingOwner, carryIncomplete}` as a label that never blocks listing reads. A reviewer query lists carried
businesses whose predecessor had an active binding and whose current row has none.

Slices 1–4 are the minimum that makes the next release safe. Slice 1 should land before the next extraction,
because a cohort captured without keys can never be carried automatically.

## 6. Owner decisions (conservative defaults)

1. **Retain the upstream id?** Default: retain only a keyed hash, in a table no read path touches, and add an
   `id` entry to the rights map so a policy must approve `ingest` and `retain` for it. Without approval, no
   key is stored and that cohort is origin-only.
2. **Rights withdrawal versus cutover.** A policy has only `revoked` (`entity.ts:225-229`). Default: a
   separate operator command `identity-forget --policy` nulls the hashes for a withdrawn policy; ordinary
   cutover keeps them.
3. **Trust in upstream id stability.** Default: equality creates `carried` only, which unlocks the public id
   and nothing reviewed or owned.
4. **Owner link restore.** Default: automatic at `corroborated` (key + name + independently re-reviewed
   address all equal), owner one-step re-confirm at `carried`, reviewer otherwise. Stricter alternative:
   human confirmation always.
5. **Reuse of a prior review when stage content is unchanged.** Default: no reuse; a hint for the reviewer,
   who still records a new decision.
6. **Historical verified re-read.** Default: not run. Historical rows stay origin-only until the owner
   approves the network read.
7. **Absence.** Default: carry across at most one skipped cohort; auto-retire after 3 consecutive absent
   cohorts; retired ids never return.
8. **Public id change.** Default: accept that `id` may now be a business id and that old ids alias forward;
   amend the contract. Alternative: a separate `businessId` field, leaving `id` row-scoped.
9. **Status for dead ids.** Default: uniform 404, no 410 and no redirect.
10. **Town scope.** Default: identity never crosses towns; a business that moves town is a new business.
11. **Overlap guard (3.4).** Default: on. Cutover stays the only supported way to change cohorts.
12. **Schedule.** Default: carry is an operator command run as part of cutover, not a scheduled job.
