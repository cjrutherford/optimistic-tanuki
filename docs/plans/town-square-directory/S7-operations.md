# S7: Directory operations

Operator-side work for the Town Square business directory: who may act, how corrections and suppressions work, how stale public data is kept from reappearing, and the review, rights, taxonomy and run tooling that later slices add. This file is the S7 packet. S7a fills sections 1 to 4. The other sections are placeholders that S7b to S7d fill as each slice lands.

## 1. Scope and owner decisions

S7 turns the S5 and S6 review surfaces into a managed operation. It adds permission-based access, a run ledger with controls, rights handling, and taxonomy management.

Owner decisions:

- **Split permissions.** Three permissions in the owner-console app scope, not one blanket "operator" grant.
  - `directory.review`: identity, address, link and boundary review, listing reports, listing suppression and lifting it.
  - `directory.rights`: rights cases and policy or row withdrawal. Routes arrive in S7c.
  - `directory.operate`: runs, taxonomy and reclassification. Routes arrive in S7c and S7d.
  - The names live in `DIRECTORY_PERMISSIONS` in `libs/social/contracts/src/lib/directory.ts`. Later slices import that constant and do not retype the strings.
  - All three are seeded to `owner_console_owner`, `owner`, `global_admin` and `system_admin`, in `apps/permissions/src/assets/default-permissions.json`. The permissions seed is an idempotent upsert, so re-running it on the live stack adds them with no migration and no hand edit of the database.
- **Run ledger and controls.** Every import, census and reclassification run is recorded, and an operator can pause, resume or stop one. Detail in section 8.
- **Full taxonomy workflow.** Category mappings and reclassification are managed in the product, with review and an audit trail, not edited in code. Detail in section 7.
- **Accountable operator.** The repository owner is the accountable operator. The owner decided on 2026-11-17 that no backup operator is required, so this is not a release blocker.
- **Absence procedure.** If the accountable operator is unavailable and no backup exists, narrow or pause the public rollout (fewer towns, or publication paused). Do not leave a growing public surface with no one watching reports.

Not in scope: paid placement, paid correction priority, owner self-service editing of listing facts. Publication stays paused until the release blockers are closed.

## 2. Permissions matrix

Every operator route runs `AuthGuard`, then `DirectoryOwnerScopeGuard` (the `x-ot-appscope: owner-console` header), then `PermissionsGuard` with `@RequirePermissions('directory.review')`. The permission is resolved in the owner-console scope with the global fallback, the same as other gateway controllers. Future routes for `directory.rights` and `directory.operate` get a row here when they land, and must be added to `reviewRoutes` in `apps/gateway/src/controllers/directory/directory.scope-matrix.spec.ts`.

Columns show the expected result for each caller. "Operator" is an owner-console session that holds the permission and sends the scope header. "Owner without permission" holds an owner role and sends the header but lacks the permission.

| Route (under `/directory/towns/:townId`)                          | Permission         | Anonymous | Member | Owner without permission | Operator |
| ----------------------------------------------------------------- | ------------------ | --------- | ------ | ------------------------ | -------- |
| `GET local-evaluation-listings/:listingId/business-link/requests` | `directory.review` | 401       | 403    | 403                      | allowed  |
| `POST local-evaluation-listings/:listingId/business-link/reviews` | `directory.review` | 401       | 403    | 403                      | allowed  |
| `GET business-link-requests`                                      | `directory.review` | 401       | 403    | 403                      | allowed  |
| `GET address-review-candidates`                                   | `directory.review` | 401       | 403    | 403                      | allowed  |
| `POST address-review-candidates/:candidateId/decisions`           | `directory.review` | 401       | 403    | 403                      | allowed  |
| `GET business-identity-review`                                    | `directory.review` | 401       | 403    | 403                      | allowed  |
| `POST business-identity-review/decisions`                         | `directory.review` | 401       | 403    | 403                      | allowed  |
| `GET listing-suppressions`                                        | `directory.review` | 401       | 403    | 403                      | allowed  |
| `POST listing-suppressions`                                       | `directory.review` | 401       | 403    | 403                      | allowed  |
| `POST listing-suppressions/:suppressionId/lift`                   | `directory.review` | 401       | 403    | 403                      | allowed  |
| `GET listing-reports`                                             | `directory.review` | 401       | 403    | 403                      | allowed  |
| `POST listing-reports/:reportId/:action`                          | `directory.review` | 401       | 403    | 403                      | allowed  |
| `GET :id/boundary-candidate`                                      | `directory.review` | 401       | 403    | 403                      | allowed  |
| `POST :id/boundary-decisions`                                     | `directory.review` | 401       | 403    | 403                      | allowed  |

Without the scope header, any authenticated caller, owner included, gets 403 from the scope guard before the permission is checked. Public routes are not in this table: listing reads, listing detail, the business-link read, `POST listing-reports` (public intake) and `GET /directory/listing-reports/:receipt` (receipt status). They need no session and send `Cache-Control: no-store`.

The deny matrix in `directory.scope-matrix.spec.ts` asserts all four columns for every row.

## 3. Correction and suppression ownership contract

Anyone can tell the directory a listing is wrong. Only a reviewer with `directory.review` can change what the public sees.

**Report intake and dedupe.** Public reports go through `POST listing-reports` with rate limiting and a honeypot field. The reporter gets a receipt code and can check its status without an account. Reports about the same listing and reason are grouped for review so one problem is one piece of work. A group does not count as more evidence because more people filed it. Reporter contact details are never returned to the public or shown in the reviewer list beyond what review needs.

**Triage priority.**

1. Safety reports and reports flagged as rights requests go first. They are reviewed ahead of everything else and are the only reports that may trigger provisional suppression on their own.
2. Reports of incorrect details and closed businesses come next.
3. Duplicates and other reports are last.

**Provisional suppression versus evidence.** A reviewer may suppress a listing provisionally, which hides it from public results until review finishes, when:

- the report is a safety concern, or
- the report is a rights request (a person or business asking to be removed or corrected), or
- the reviewer already holds evidence the listing is wrong in a way that harms someone.

Everything else (incorrect details, a claimed closure, duplicates) goes to evidence or manual review with the listing still visible, unless the reviewer decides otherwise and records why. A correction is a suppression with the incorrect-details reason: the listing is hidden and sent back to review. Corrected values are never typed in or copied from a report.

**Appeal and restore.** A suppression is not permanent by default. A reviewer lifts it with a reason (`resolved`, `mistaken-suppression`, `other`). An owner or business that disagrees uses the same report channel, and the lift path is the restore. Both the suppression and the lift are audited with actor, reason and time.

**Propagation targets.** A suppression, withdrawal or lift must reach every place the listing appears: search results, listing detail, map markers and coordinates, nearby-town results, and any cache holding a copy (public page snapshots, section 4). The gateway sends `Cache-Control: no-store` on directory reads so no shared cache holds a copy. Detail returns 404 for a suppressed listing. A change is not done until each target is checked.

**A user report is not proof.** A report is a lead. It does not prove a business closed or that the reporter owns the business. Closure needs evidence a reviewer accepts. Ownership goes through the business-link review, not through a report. No amount of reports, and no payment, moves a listing faster or bypasses review. There is no paid bypass.

## 4. Stale-cache handling

The Local Hub directory keeps page snapshots so browser Back and returning from a detail page redraw the results without a refetch. Before S7a a snapshot lived for the whole session with no invalidation, so a listing suppressed or withdrawn after the page was fetched could reappear when the user went back.

What changed in `apps/local-hub/src/app/services/directory.service.ts`:

- **Short-lived snapshots.** A snapshot is served for at most 60 seconds (`SNAPSHOT_TTL_MS`). After that it is dropped and the page is fetched again. At most 20 snapshots are kept, as before.
- **Detail is always fresh.** Listing detail and the report lookup never read a snapshot. Each one asks the server.
- **404 evicts.** When a detail or report lookup returns 404 for a reference that appears in a snapshot, that listing is removed from every snapshot for the same town and adult setting, matching by reference and by listing id. Other towns and the other adult setting are left alone, because a reference only exists under the setting it was issued for. Other errors (such as 503) do not evict.

Back and forward inside the 60 second window still restore instantly. Past it, the page refetches, so the worst case for a suppressed listing to remain on a remembered page is 60 seconds, and it disappears sooner whenever someone opens it.

## 5. Review

S7b makes every review decision version-checked, idempotent, recorded in a history, and reversible where that is safe.

### POC to target mapping

| POC (`directory-api/review`)                     | Target (gateway, then internal)                                                                                                                          |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /review` (list)                             | `GET business-identity-review`, `GET address-review-candidates`; each row carries `versionToken`                                                         |
| `GET /review/:id` (detail)                       | `GET business-identity-review/:businessId`, `GET address-review-candidates/:candidateId`; detail plus `history`                                          |
| `POST /review/:id/decisions` (202, 409 on stale) | `POST .../decisions`; body carries `expectedVersionToken` and `decisionId`; 409 `stale_decision` or `decision_conflict`; replay returns `replayed: true` |
| `POST /review/:id/undo` (merge event only)       | `POST .../:id/undo` with `{ undoOf, expectedVersionToken, decisionId, reason }`; identity and address                                                    |
| POC `versionToken` on a task row                 | `versionToken`: sha256 hex of the item state, opaque to clients                                                                                          |
| POC `eventId` idempotency                        | client `decisionId` (primary key of the decision row)                                                                                                    |

All gateway routes use AuthGuard, DirectoryOwnerScopeGuard, PermissionsGuard and `RequirePermissions(DIRECTORY_PERMISSIONS.review)`, and are listed in `reviewRoutes` in `directory.scope-matrix.spec.ts`.

### Rules

- A decision or undo without a well-formed `expectedVersionToken` is a 400. A token that no longer matches is a 409 `stale_decision` with no write. The check runs under the locks (fence, then town advisory lock, then business rows), so it cannot race a concurrent write.
- `decisionId` is idempotent. The same id with the same payload replays the recorded result (`replayed: true`). The same id with a different payload is 409 `decision_conflict`.
- Only the latest non-undone decision is undoable; anything else is 409 `not_latest`. A decision whose resulting state no longer matches (for example a later publish) is also `not_latest`.
- An undo appends an inverse audit event and marks the original decision undone (`undoOf` with a partial unique index, so at most one undo per decision). Nothing is deleted.
- Of concurrent decisions on one token exactly one wins; the rest get `stale_decision`.
- Owner Console sends the token, shows "This item changed since you opened it" and reloads on a stale 409, and shows a per-item history panel (shared `otui-decision-history` in common-ui) with an Undo button and a required reason on the latest reversible decision.

### Reversibility

| Decision                   | Undo result                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------ |
| Identity merge             | merged business restored (public detail of both businesses returns to pre-merge)     |
| Identity retire            | business reactivated                                                                 |
| Identity confirm           | returns to review                                                                    |
| Address reject, needs_info | returns to `needs_human`                                                             |
| Address approve, publish   | equals revoke: pin and reviewed fields removed, binding retired (cause `human_undo`) |
| Address revoke             | returns to `needs_human`; never republishes                                          |

Not reversed by undo:

- Link carries closed by a merge or retire stay closed.
- Owner links restored by a confirm persist.
- Re-confirming after an undo can skip a second `confirmed` event (unique key, DO NOTHING); the decision row is still written.
- Publication is never restored automatically; a human must re-approve.

Migration `1794946949693-DirectoryFoundation` adds the `undoOf` columns, a snapshot column, two partial unique indexes and replacement CHECK constraints (generated, with the CHECK changes added by hand because generate does not diff CHECKs). It was applied to the local `ot_directory` on 2026-11-17.

### Tests

- `apps/directory/test/identity-review-undo.postgres.test.js`: stale token, replay and conflict, merge-then-undo public detail, retire/confirm undo, `not_latest`, concurrent single winner, queue token equals detail token.
- `apps/directory/test/address-review-publish.postgres.test.js`: stale token, replay and conflict, approve-publish-then-undo removes pin and fields, reject/needs_info/revoke undo with no republish, `not_latest`, concurrency.
- `apps/directory/test/reviewed-binding-race.postgres.test.js`, `register-pending-runtime.test.js`, `account-lifecycle.test.js`: updated for tokens.
- Gateway controller specs and scope matrix; Owner Console page specs; `decision-history.component.spec.ts`.

## 6. Rights

All rights work needs `directory.rights`, which is separate from `directory.review`: a review-only operator gets 403 on every route below. Routes are in `reviewRoutes` in `directory.scope-matrix.spec.ts` and answer `Cache-Control: no-store`.

### 6.1 POC to target mapping

| POC                                              | Target                                                                                                                                                                                                                                                                          |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rights queue derived from provenance in the scan | `directory_rights_case`, one row per lineage (scope, subject key, release, field, dataset, license, source pointer). `POST /api/directory/rights-cases/sync` fills it from provenance. It is operator-triggered and idempotent: a second run reports `existing`, not `created`. |
| Rights decisions as edits                        | Append-only `directory_rights_event`, with the client decision id as the primary key. Actions: `exclude_field`, `confirm_terms`, `defer`, `reopen`, `undo`, plus the system `withdraw`.                                                                                         |
| Takedown script                                  | `directory_withdrawal_request`, a durable row worked by a resumable worker started in the Directory runtime.                                                                                                                                                                    |

Case statuses are `review`, `excluded`, `resolved` and `withdrawn`. `defer` leaves a case in `review`.

### 6.2 Rules

- A decision never grants public display. `confirm_terms` records evidence (terms URL plus SHA-256, both or neither) and moves the case to `resolved`. Publication stays gated by the existing release and publication controls.
- Every write records actor profile id, reason, timestamp and the idempotency key (the decision id). The actor comes from the session, never the body.
- A decision carries the case version token. A stale token, a replay with different content, a non-latest undo or an invalid state transition returns 409 with `code` of `stale_decision`, `decision_conflict`, `not_latest` or `invalid_state`. A replay with identical content returns the original result.
- Undo reverts only the latest non-undo event, once. Ambiguous cases refuse `confirm_terms`.
- Withdrawal needs the typed word `WITHDRAW` and a reason. A duplicate request id is idempotent.

### 6.3 Propagation and how it was verified

Withdrawal is revoke-first: the revocation is written before rows are removed, so a restarted import cannot resurrect them. Targets are the Overture private sink rows and keys for the scan, policy (500-row batches under the scan lock) or single row. Verified in `apps/directory/test/rights-withdrawal.postgres.test.js` against a disposable Postgres: after a row withdrawal the listing disappears from search, list, bounds and detail while a control row is still served, and coverage changes after the second row. An unbound target ends `failed` rather than silently succeeding. A 1200-row policy withdrawal is interrupted after one batch (700 rows left) and the worker resumes it to completion. Provenance digests are unchanged by decisions.

### 6.4 Irreversible

Withdrawal is one-way. It deletes the rows and their keys and writes a revocation that fences re-import; there is no undo because the deleted source rows are not retained, and restoring them would bypass the rights decision that removed them. Case decisions other than withdrawal are reversible with undo or `reopen`.

### 6.5 Account erase

`directory_rights_event.actorId` and `directory_withdrawal_request.actorId` are nullable. Erase nulls the actor when it matches a profile id and clears the operator's `reason` text. An account or legacy-id match is ambiguous and blocks. The audit trail (what moved, when) is kept. `directory_rights_case` holds no person data.

### 6.6 Deploy

Apply migration `1794949427226-DirectoryFoundation` (three tables) to the live Directory database before deploying this build. It was generated, validated with `pnpm run validate:typeorm-migrations`. It was applied to the local `ot_directory` on 2026-11-17.

## 7. Taxonomy

All taxonomy work needs `directory.operate`. A review-only or rights-only operator gets 403 on every route below. Routes are in `taxonomyRoutes` in `directory.scope-matrix.spec.ts` and answer `Cache-Control: no-store`.

### 7.1 Model

The effective category of a stored listing is, in order: an operator override, the installed mapping's classification, the stored (legacy) category. An override beats an exclusion. Public list, detail, category filter, search and coverage all read the effective value through one SQL fragment (`taxonomy-served.ts`), so a listing is classified the same way everywhere.

| Table                                                                  | Purpose                                                                                                                                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `directory_taxonomy_mapping_version`, `directory_taxonomy_mapping_row` | A versioned mapping installed from a checked-in file (`taxonomy-mapping-data.ts`). One version is active at a time (unique partial index).                          |
| `directory_listing_classification`                                     | The projection a run writes, keyed by `(scanId, sourceFileRowNumber)`: category, optional place type, basis (`mapping`, `override`, `legacy`), excluded and reason. |
| `directory_listing_category_override`                                  | One override per `(communityId, listingKey)`. The key is the stable listing identity.                                                                               |
| `directory_taxonomy_case`, `directory_taxonomy_event`                  | Cases and an append-only event log. The client decision id is the event primary key.                                                                                |
| `directory_taxonomy_run`, `directory_taxonomy_run_before`              | The run ledger and the before-image of every row an apply changes.                                                                                                  |

Stable listing identity is the business id when the listing has a current business assertion, otherwise the row-scoped `directory_listing_identity` id. An override keyed by a business id survives a rescan, because the new scan row carries the same business. An override keyed by a row-scoped id does not survive a rescan.

Categories are `restaurants`, `activities`, `services`, `stores`, `places_and_landmarks`, `adult`, `education` and `places_of_worship`. Place types refine a category: `radio_station` (services) and `auto_dealer` (stores).

### 7.2 Mapping

`POST /api/directory/taxonomy/mappings/install {version, activate}` loads a version from the file the build carries. Install is idempotent by content hash: a second install returns `replayed: true`. Installing a version whose file has changed since it was installed returns 409 `decision_conflict`; ship a new version id instead. `activate: true` deactivates the others in the same transaction. Installing changes nothing that is served; only an apply run does.

The shipped version is `overture-v3-local-2026-11.1`, with unmapped policy `keep_legacy`: a category the mapping does not know keeps its stored value, so nothing disappears on deploy. Classification takes the most specific taxonomy node first, adult nodes always winning, then the stored basic category. The adult category is served only for a listing flagged `adult`; an adult node on any other listing is excluded with reason `adult_restricted`. Operators cannot assign `adult`.

### 7.3 Cases

| Action                      | Effect                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `POST .../cases`            | Raise a case for one listing (`operator_raised`). One open or deferred case per listing; a second returns it. |
| `assign`                    | Writes the override (category, optional place type). The previous override is captured for undo.              |
| `reject`, `defer`, `reopen` | Move the case status only. Reject and defer change nothing that is served.                                    |
| `undo`                      | Restores the override as it was before the undone assignment.                                                 |

Statuses are `open`, `assigned`, `rejected` and `deferred`. Every write records the session actor, a required reason, a timestamp and the decision id. A decision carries the case version token. A stale token, a replay with different content, a non-latest undo, an undo whose override has since been replaced, or an invalid transition returns 409 with `stale_decision`, `decision_conflict`, `not_latest` or `invalid_state`. A replay with identical content returns the original result.

### 7.4 Reclassification runs

A run is a durable row worked in batches of 500 by a worker started in the Directory runtime (`FOR UPDATE SKIP LOCKED`). Each batch commits its writes and its cursor in one transaction, so an interrupted run resumes from the last committed batch. Five consecutive failed batches fail the run.

1. `dry_run` computes every row's classification, writes nothing, and ends with a summary (transitions with samples, unchanged, unmapped, excluded) and a plan hash (a digest chain over every row's computed classification).
2. `apply` names the plan hash of a completed dry run with the same mapping version, scope and town, and needs the typed word `APPLY`. The mapping version must be active. The worker replays the plan pass first; if the hash differs the run fails with `plan hash mismatch` and writes nothing. Otherwise it writes the before-image and the projection, batch by batch.
3. `cancel` stops a pending run at once and a running run after its current batch.
4. `rollback` of a completed apply needs the typed word `ROLLBACK`. It restores the before-images, but only for rows the run still owns: a row a later run changed is left alone.

Only one run is active at a time. A run id is idempotent: a replay with the same content returns the run, with different content returns 409.

Run routes: `GET/POST /api/directory/taxonomy/runs`, `GET .../runs/:id`, `POST .../runs/:id/cancel`, `POST .../runs/:id/rollback`.

### 7.5 Owner Console

`/dashboard/directory-taxonomy` is the case queue and detail: assign select (adult excluded), reason, decision history with undo, and a raise form. `/dashboard/directory-taxonomy-runs` installs mappings, starts dry runs, shows the diff table, applies with a typed confirmation, follows progress while a run is in flight, cancels and rolls back. Both are listed in the operator workspaces. Stale 409s reload the case and say so.

### 7.6 Account erase

`directory_taxonomy_event.actorId` and `reason`, `directory_taxonomy_run.actorId`, `canceledById`, `rollbackById` and their reasons, and `directory_taxonomy_mapping_version.installedById` are nullable. Erase nulls a matching profile id and clears the reason text; an account or legacy-id match is ambiguous and blocks. The other five tables hold no person data. The lifecycle parity test covers all eight.

### 7.7 Known gaps

- Stored private rows keep only the basic category, so classification works on `basic_category`; `taxonomy_node` entries apply only to a listing that carries a taxonomy path. A listing with several categories collapses to the most specific match.
- Closed 2026-11-18: the plan pass raises `unmapped_taxonomy` and `ambiguous_taxonomy` cases itself, and operators can dismiss a case (and reopen it) from Owner Console. A live round trip is in [`s7-evidence/s7-dismiss-live-outcome.json`](s7-evidence/s7-dismiss-live-outcome.json).
- The shipped mapping has no excluded `basic_category`; exclusion today comes from the adult rule only.
- Drift between the plan pass and the apply pass is detected at the plan hash, before any write. Closed 2026-11-18: apply records the planned rows and reports rows that changed during the apply phase as `driftedRows`.
- The release on a run is recorded from source evidence, or declared by the owner on `POST /api/directory/runs/history/import` (`release`, which must have a rights policy). A declared release fills only runs with no recorded release; evidence always wins. There is no Owner Console control for it yet; it is API only.
- A rollback restores only rows still owned by the run, by design.

### 7.8 Deploy and live steps

Apply migration `1794950472386-DirectoryFoundation` (eight tables) to the live Directory database before deploying this build. It was generated, validated with `pnpm run validate:typeorm-migrations`. It was applied to the local `ot_directory` on 2026-11-17. Then, as an operator with `directory.operate`:

1. `POST /api/directory/taxonomy/mappings/install` with `{"version":"overture-v3-local-2026-11.1","activate":true}`. Activation is the owner's call: Owner Console has no deactivate control, and once a mapping is active a case undo re-derives the category from it. The owner approved activation, and the local directory activated it on 2026-11-18T01:58:59Z (see section 10).
2. `POST /api/directory/taxonomy/runs` with `{id, mappingVersion, scope:"town"|"all", townId?, mode:"dry_run", reason}`. Wait for `complete`. Review the transitions and note `planHash`.
3. `POST /api/directory/taxonomy/runs` with `{id, mappingVersion, scope, townId?, mode:"apply", reason, expectedPlanHash, confirm:"APPLY"}`. Follow `appliedRows` until `complete`.
4. To undo: `POST /api/directory/taxonomy/runs/:id/rollback` with `{reason, confirm:"ROLLBACK"}`.

## 8. Runs

S7e adds a run ledger and operator controls for acquisition. It adds no provider call, no worker and no new authority: real acquisition is still unauthorized (`ACQUISITION_AUTHORIZED = false` in `apps/directory/src/acquisition-run.ts`), publication stays paused, and the stage scripts remain operator-local.

### 8.1 POC to target mapping

| POC / existing                                                               | Target                                                                                                                             |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Per-town scan row (`directory_town_scan_target`) and its scan id             | `directory_acquisition_run_job` (`townId`, `scanId`, `unitKey`); one job per town or per source asset                              |
| Census progress row (`directory_census_progress`)                            | a `census-stage` job; its row counts become the job counts                                                                         |
| Stage script console heartbeat and sink checkpoint                           | `heartbeatAt`, `checkpoint` on the job, written between batches                                                                    |
| Provider spend reservation (`provider-budget.ts`, 2500 cent monthly ceiling) | read-only budget panel (reserved, used, remaining, hard stop); `budget_exhausted` blocks a run                                     |
| POC `eventId` idempotency, `versionToken`                                    | `directory_acquisition_run_event` primary key is the client `decisionId`; `versionToken` over status, blocked reason, events, jobs |
| Past scans with no run record                                                | `kind: historical` runs created by the idempotent import-history operation                                                         |

### 8.2 Model

- `directory_acquisition_run`: id, provider, release, kind (`overture-stage`, `poc-import`, `census-stage`, `historical`), `townIds`, status, `blockedReason`, `startedById` (null for a script or an import), reason, timestamps, `heartbeatAt`, observed/accepted/rejected counts, `budgetReservedCents`, `budgetUsedCents`, and a redacted `lastError` (urls, hosts, paths and long tokens removed).
- `directory_acquisition_run_job`: primary key (`runId`, `unitKey`); status, blocked reason, checkpoint, attempt, counts, redacted error. Run totals are recomputed from the jobs whenever a job finishes.
- `directory_acquisition_run_event`: append-only, one row per operator write, keyed by `decisionId`. Consumption of a resume or retry by the stage is a separate `consumed` event (unique per `ofEventId`), so a request is consumed once.
- Statuses: `queued`, `running`, `succeeded`, `succeeded_empty`, `partial`, `blocked`, `failed_retryable`, `failed_permanent`, `cancel_requested`, `cancelled`. A `running` run with no heartbeat for 10 minutes is reported `stale`.
- Blocked reasons: `policy_blocked`, `unconfigured_provider`, `budget_exhausted`, `quota_exhausted`, `invalid_geometry`, `acquisition_unauthorized`.

### 8.3 Operator-local and automatic

Operator-local: the stage scripts (`local-directory-overture-stage.cjs`, `local-directory-overture-census-stage.cjs`) write the ledger by default through `scripts/local-directory-run-ledger.cjs`. `--no-ledger` runs without recording (and so without cancel or resume). `--resume <runId>` consumes the pending request and runs only the queued units, from each job's checkpoint. The scripts check the cancel flag between batches; a batch that has been committed stays committed.

Automatic: nothing. The Directory runtime serves the read views and records requests. It does not start, resume or retry any acquisition. Resume and retry set the run to `queued` with a pending request and return a `resumeCommand` for the operator to run locally.

Gap: there is no automatic worker acquisition. That needs the owner to authorize acquisition and a worker that consumes the same requests; until then the ledger is observation plus operator-run resumption. `local-directory-poc-import.cjs` is not wired: it is a single `--apply-local` import with its own strict arguments, and its ledger entry can be created by import-history.

### 8.4 Rules

- Cancel: a live run goes to `cancel_requested` and the stage stops after its current batch. A run whose heartbeat is stale is cancelled directly.
- Resume: re-queues `partial`, `failed_retryable` and `cancelled` jobs. A `blocked` run is refused with 409 and the reason until the reason clears; only `budget_exhausted` can clear, once the budget panel shows room. `acquisition_unauthorized`, `policy_blocked` and `quota_exhausted` stay blocked: start a new run instead.
- Retry: one job by `unitKey`.
- Every write carries the actor profile id, a reason, a typed confirmation (`CANCEL`, `RESUME`, `RETRY`), the run's `expectedVersionToken` and a `decisionId`. A stale token is 409 `stale_decision`; a repeated `decisionId` replays. Historical runs cannot be resumed or retried.
- Responses are `no-store`, errors are redacted, and the gateway passes only a known blocked reason through a 409.

### 8.5 Routes

Gateway (`apps/gateway/src/controllers/directory/directory-runs.controller.ts`), all with `AuthGuard`, `DirectoryOwnerScopeGuard`, `PermissionsGuard` and `directory.operate`: `GET /api/directory/runs` (`status`, `townId`, `limit`, `offset`), `GET /runs/latest`, `GET /runs/budget`, `GET /runs/:id`, `POST /runs/:id/cancel`, `POST /runs/:id/resume`, `POST /runs/:id/retry`, `POST /runs/history/import`. Internal routes live under `/internal/acquisition/` in `apps/directory/src/acquisition-routes.ts`.

Owner Console: Acquisition Runs at `/dashboard/directory-runs` (status filter, blocked reasons, per-unit progress that refreshes while a run is in flight, budget panel, cancel, resume and retry with reason and typed confirmation, copyable resume command, import history).

### 8.6 Account erase

`directory_acquisition_run.startedById` and `directory_acquisition_run_event.actorId` are nullable; erase nulls a matching profile id and clears the reason text, and an account or legacy-id match is ambiguous and blocks. `directory_acquisition_run_job` holds no person data. The lifecycle parity test covers all fourteen tables.

### 8.7 Deploy and live steps

Apply migration `1794951718340-DirectoryFoundation` (three tables) to the live Directory database before deploying this build. It was generated, validated with `pnpm run validate:typeorm-migrations`. It was applied to the local `ot_directory` on 2026-11-17. Then, as an operator with `directory.operate`:

1. `POST /api/directory/runs/history/import` with `{decisionId, reason}` to create historical runs from past scans and census progress. It is safe to repeat.
2. Open Acquisition Runs to follow runs. A stage run made after the deploy records itself; do not run a stage until acquisition is authorized.
3. To resume: open the run, type `RESUME` with a reason, then run the shown command locally, for example `DIRECTORY_LOCAL_EVALUATION=true node scripts/local-directory-overture-stage.cjs --resume <runId>`. The census stage takes `--resume` together with its asset argument.

## 9. Evidence

### 9.1 Live browser run

`apps/local-hub-e2e/src/s7-operations-evidence.spec.ts` drives the deployed Owner Console (Tailnet origin, owner session) and Local Hub against the local `ot_directory`. It runs only with `S7_EVIDENCE=true`. Run from `apps/local-hub-e2e`:

```
S7_EVIDENCE=true E2E_DOCKER=true BASE_URL=http://127.0.0.1:8087 pnpm exec playwright test -c playwright.config.ts src/s7-operations-evidence.spec.ts --workers=1
```

The final run on 2026-11-17 passed 9 of 9 in 1.0 minutes. Every page gets an axe check that fails on serious or critical violations. Artifacts are in [`s7-evidence/`](s7-evidence/): 30 screenshots and six outcome files.

| Test                      | What it shows live                                                                                                                                                                                       | Outcome                                                                                                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Permission matrix      | 30 requests across 5 S7 routes: anonymous (console proxy and direct gateway), the Local Hub scope, an owner session with no scope or the wrong scope sent straight to the gateway, and the owner control | All 30 as expected. The 25 denials are 401/403; only the owner-console control is allowed. [`s7-permission-matrix.json`](s7-evidence/s7-permission-matrix.json) |
| 2. Runs                   | History import, the run list, run progress, the refused resume of a finished run, the budget panel, mobile list and detail                                                                               | Pass                                                                                                                                                            |
| 3. Correction propagation | Suppress PINEVIEW GROCERY. It is gone from public search, detail (an open detail page expires) and map, and does not come back from browser history. Then lift it, and it is restored                    | Pass. The suppression was lifted, and no suppressions are open                                                                                                  |
| 4. Identity review        | Queue health and the empty queue                                                                                                                                                                         | The live queue is empty (0 unresolved), so confirm/undo is shown by the Postgres suites in section 5                                                            |
| 5. Address review         | `needs_info`, undo, history grows by one each time, then a stale token is refused with `409 stale_decision`                                                                                              | Pass. The candidate is back at `needs_human`                                                                                                                    |
| 6. Rights                 | The queue and its empty state                                                                                                                                                                            | The live queue was empty on this run. Since section 10 it holds 6 cases, and sync, defer and undo pass live                                                     |
| 7. Withdrawals            | A one-row withdrawal through form, queue and worker, for a scan bound to no policy                                                                                                                       | The worker fails it permanently with "Scan not bound to policy" after 1 attempt, with no retry, and removes nothing. Shown on the card                          |
| 8a. Taxonomy runs         | Install the mapping, a town dry run (18 transitions, 1,846 rows, plan hash shown), then apply while the mapping is inactive                                                                              | The server refuses the apply with 409. No apply run is created and the public category does not change. Since section 10 the run applies and rolls back         |
| 8b. Taxonomy case         | Raise a case, assign `stores`, see the public list and detail change, then undo                                                                                                                          | Pass. The public category is restored                                                                                                                           |

### 9.2 Defects the live run found and fixed

- **Owner Console login always failed** with "App context is not authorized". The `/api` proxy rewrote Host to the gateway address, so origin binding never matched. Fixed in `fd5c22f90` by keeping the browser Host, as Local Hub does. `server-proxy.spec.ts` covers it.
- **The Owner Console Docker build failed** because it pulled Node builtins through the contracts barrel. Fixed in `ff80de7ab` with the browser-safe `@optimistic-tanuki/social-contracts/directory` entry.
- **Deep links to the S7 pages went to `/login`**: they were rendered on the server, where there is no session. They render on the client since `7052e043e`.
- **Every incorrect-details suppression answered "Listing suppression is unavailable"**. Directory returns `sentToReview` as a count, and the gateway checked for a boolean. This had been present since S5. Fixed in `ce6c048d0`.
- **Error text on the run, taxonomy-run and withdrawal cards measured 4.42:1**, under WCAG AA. A failed withdrawal also read "Working". Fixed in `7ec9cef86`.

### 9.3 What the live run does not show

- **Taxonomy apply and rollback.** Shown live since section 10, after the owner approved activation.
- **Rights sync, defer and undo** (now shown live, section 10) **and the invalid-hash check.** At the time of this run the served private rows were staged before source provenance was kept (`includeSourceProvenance`), so they have no `sources` lineage. No run records a release either. A sync would have nothing real to derive. Syncing against an invented release would leave a permanent case, so the run does not do it. Restaging with provenance needs acquisition, which is paused. The mechanics are covered by `rights-case` and `rights-withdrawal` Postgres suites (section 6).
- **A completing withdrawal.** Any target that completes writes a revocation that cannot be undone. Completion is shown in `rights-withdrawal.postgres.test.js`.
- **Identity decisions.** The live identity queue is empty.

### 9.4 Rows the evidence runs left

These are append-only audit records of test actions. None of them change what the public sees.

- Lifted suppressions and their history on PINEVIEW GROCERY.
- Address-review decisions on "Peach Mart Burton Brooks": `needs_info`, then its undo, for each run.
- One `operator_raised` taxonomy case on PINEVIEW GROCERY. It is open again after the undo, and later runs reuse it. There is no dismiss action.
- `failed` withdrawal requests for the inert target `000…001:4000000000`.
- Completed taxonomy dry runs. Since section 10, the town apply-and-rollback pairs of each evidence run, and the active mapping `overture-v3-local-2026-11.1`.

After the final run of 9.1: 0 open suppressions, 0 active category overrides, 0 classification rows, 0 apply runs, 0 row revocations, and 0 rights cases.

### 9.5 Suites

- Owner Console: 742 tests.
- Gateway: 145 suites, 2,257 tests (5 skipped).
- Directory runtime and Postgres suites ran green on scratch databases for each of S7a to S7e (sections 5 to 8).
- The personality audit is clean.

## 10. Follow-up 2026-11-17: mapping activated, rights provenance attached

The owner approved three changes: activate the taxonomy mapping, load the rights data, and drop the backup-operator requirement.

### 10.1 Taxonomy mapping

- **Backup.** `ot_directory` was dumped before activation (`pg_dump -Fc`, 32.7 MB).
- **Activation.** The install call (7.8 step 1) activated `overture-v3-local-2026-11.1`: 155 rows, unmapped policy `keep_legacy`.
- **Dry run, all towns.** Plan hash `40b99b0a…4476`. 187,127 rows changed, out of 187,127 scanned. The largest transitions:
  - `restaurant` → restaurants: 48,593
  - `fashion_and_apparel_store` → stores: 23,883
  - `hardware_home_and_garden_store` → stores: 17,472
  - `food_and_beverage_store` → stores: 13,002
  - `casual_eatery` → restaurants: 12,906
  - `auto_dealer` → stores: 9,220
- **Apply.** Run `a61be785…` was applied against that plan hash, writing 187,127 rows.
- **Classification projection afterwards.**
  - stores: 106,355
  - restaurants: 67,616
  - services: 13,155
  - `adult_entertainment_venue`: 1. Its legacy category is kept. The row is flagged `adult`, so public reads hide it unless the viewer opts in.
- **Rollback.** To undo the activation's effect, roll back run `a61be785…` (7.8 step 4). Owner Console still has no deactivate control.
- **Plan hash.** A town dry run after the apply plans 0 changes. It keeps the same plan hash as before, because the hash covers the target projection of every row in scope, not the diff.

### 10.2 Rights provenance

The census rows were staged without `sources`. The October contact capture (policy `7dd1e46f…`, stage database) re-read the same four pinned assets with the same `(regionId, sourceFileRowNumber)` numbering, and it kept `{dataset, license, property}`. So no new acquisition or network access was needed, and scan ids did not change.

`scripts/local-directory-overture-provenance-attach.cjs` adds `listing.sources` to served rows that match on region, row number and name, and that have no `sources` yet:

- `--check` writes nothing.
- `--apply --confirm-database ot_directory --record <file>` writes in one transaction.
- `--rollback <file>` removes the key again.

A unit test covers the planner. The live check matched 182,277 of 187,127 served rows, with 0 name mismatches and 0 ambiguous keys. The 4,850 unmatched rows are the September pilot scan, which has no contact capture. `ot_directory` was dumped first, and the touched keys were recorded for rollback.

The sync showed a defect. One aggregate over all served rows takes about 3 seconds, and the runtime pool's 3-second `query_timeout` refused it intermittently. The Gateway reported that as "Rights unavailable". `observedLineages` now aggregates one served scan at a time and merges the results. Sync takes about 330 ms, and 5 of 5 internal calls succeeded.

The live rights queue for release `2026-10-21.0` has 6 cases, all `review`:

- the release case;
- AllThePlaces (CC0-1.0, 4,645 rows);
- BrightQuery (38,468);
- DAC (2,448);
- meta (114,542);
- Microsoft (22,174).

The last four are under CDLA-Permissive-2.0.

These are real owner decisions, and the evidence run reverses its own defer. None of the cases offers "Confirm terms read" in its current state, so the invalid-hash check is still covered only by the suites.

### 10.3 Evidence rerun

All 9 of 9 pass with `S7_RIGHTS_RELEASE=2026-10-21.0`.

- **8a** now applies to one town, then rolls back. The town plans 0 changes, since everything is already applied.
- **6** syncs, defers and undoes.

Two test races were fixed:

- axe ran before a client-rendered page existed;
- the rights card was counted before the queue loaded.

The history assertion now counts relative to earlier runs.

State after the run:

- 187,127 classifications (the full apply is intact);
- 1 complete apply;
- 2 rolled-back town applies;
- 6 rights cases in `review`;
- 0 open suppressions.

### 10.4 Deploy

- **Image.** Directory was rebuilt and deployed. The rollback tag is `optimistic-tanuki-directory:pre-provenance`.
- **Shell environment.** Deploy from a shell that has not sourced `.env.directory.local`. With `set -a`, bash strips the quotes from the unquoted JSON in `DIRECTORY_REGISTER_RUNTIME_IDENTITY`. The exported value then overrides the env file in compose, and Directory fails to start with "Invalid runtime identity". That happened once here and was fixed by redeploying from a clean shell.
