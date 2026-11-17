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

Placeholder. S7b: reviewer queue summary, assignment, and the review workflow across identity, address, link and boundary.

## 6. Rights

Placeholder. S7c: rights case intake and handling under `directory.rights`, policy withdrawal, and row withdrawal with propagation.

## 7. Taxonomy

Placeholder. S7d: category mapping management and reclassification under `directory.operate`, with review and audit.

## 8. Runs

Placeholder. S7c to S7d: run ledger, pause, resume and stop controls under `directory.operate`.

## 9. Evidence

Placeholder. Test counts, live checks and screenshots for each S7 slice.
