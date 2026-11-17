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
- **Accountable operator.** The repository owner is the accountable operator. A backup operator is not named yet. **Open public-release blocker:** a named backup must exist before the directory is publicly released.
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

Migration `1794946949693-DirectoryFoundation` adds the `undoOf` columns, a snapshot column, two partial unique indexes and replacement CHECK constraints (generated, with the CHECK changes added by hand because generate does not diff CHECKs). It must be applied to live databases at deploy.

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

Apply migration `1794949427226-DirectoryFoundation` (three tables) to the live Directory database before deploying this build. It was generated, validated with `pnpm run validate:typeorm-migrations`, and not applied to any live database.

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
- Runs do not raise `unmapped_taxonomy` or `ambiguous_taxonomy` cases on their own. Only operators raise cases (`operator_raised`).
- The shipped mapping has no excluded `basic_category`; exclusion today comes from the adult rule only.
- Drift between the plan pass and the apply pass is detected at the plan hash, before any write. Rows that change while the apply phase itself runs are not re-verified.
- A rollback restores only rows still owned by the run, by design.

### 7.8 Deploy and live steps

Apply migration `1794950472386-DirectoryFoundation` (eight tables) to the live Directory database before deploying this build. It was generated, validated with `pnpm run validate:typeorm-migrations`, and not applied to any live database. Then, as an operator with `directory.operate`:

1. `POST /api/directory/taxonomy/mappings/install` with `{"version":"overture-v3-local-2026-11.1","activate":true}`.
2. `POST /api/directory/taxonomy/runs` with `{id, mappingVersion, scope:"town"|"all", townId?, mode:"dry_run", reason}`. Wait for `complete`. Review the transitions and note `planHash`.
3. `POST /api/directory/taxonomy/runs` with `{id, mappingVersion, scope, townId?, mode:"apply", reason, expectedPlanHash, confirm:"APPLY"}`. Follow `appliedRows` until `complete`.
4. To undo: `POST /api/directory/taxonomy/runs/:id/rollback` with `{reason, confirm:"ROLLBACK"}`.

## 8. Runs

Placeholder. S7c to S7d: run ledger, pause, resume and stop controls under `directory.operate`.

## 9. Evidence

Placeholder. Test counts, live checks and screenshots for each S7 slice.
