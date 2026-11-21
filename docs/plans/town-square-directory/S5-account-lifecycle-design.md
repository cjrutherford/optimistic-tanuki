# S5: Directory account deletion and export lifecycle

Status: phase 1 (Directory side) implemented and tested on a disposable
database. Directory is not yet a registered deletion or export owner, so
nothing here runs for a real account until phase 2.

## Summary

Directory holds account or profile identifiers in four columns across four
tables. On deletion it keeps the minimal decision history, nulls an identifier
only when it matches in the domain that column is known to hold, clears the
free-form input supplied with it, and refuses to change anything when a scope
identifier matches in a domain it cannot prove. Writes for a fenced identity
are refused from the moment the fence is installed, permanently.

## Where identity lives

Gateway supplies two different identifiers and Directory never mixes them:

| Caller value         | Domain  | Stored in                                                                                                                       |
| -------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `req.user.userId`    | account | `directory_business_link_request.ownerId`; link events with `actorDomain='account'`                                             |
| `req.user.profileId` | profile | `directory_boundary_decision.reviewerId`; `directory_address_review_decision.actorId`; link events with `actorDomain='profile'` |

The machine-checked source of truth is `DIRECTORY_ACCOUNT_LIFECYCLE_INVENTORY`
in `apps/directory/src/account-lifecycle-dispositions.ts`. It classifies every
column of all 27 Directory tables; a unit test compares it with the TypeORM
entity metadata, and each deletion transaction compares it with the physical
catalog and refuses to run on drift.

## Dispositions

Tables with an account or profile subject:

| Table / columns                                                                   | Deletion                                                                                                        | Export                               |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `directory_business_link_request.ownerId`                                         | null when it equals the account id                                                                              | exclude (the subject is the account) |
| `…request.status`                                                                 | `pending`/`approved` become `revoked`, with an appended `revoke` event (`actorId` NULL, `actorDomain='system'`) | include                              |
| `…request` other columns                                                          | preserve                                                                                                        | include                              |
| `directory_business_link_active` (row)                                            | delete when its request is owned by the account                                                                 | exclude (status says it)             |
| `directory_business_link_event.actorId`                                           | null when the row's `actorDomain` names the matching domain                                                     | exclude                              |
| `…event.evidenceUrl`                                                              | clear on events of the deleted owner's requests; keep on a deleted reviewer's events about other owners         | include                              |
| `…event` other columns, `actorDomain`                                             | preserve                                                                                                        | include                              |
| `directory_boundary_decision.reviewerId`                                          | null when it equals a current profile id                                                                        | exclude                              |
| `…boundary_decision.sourceUrl`, decision, ids, `createdAt`                        | preserve (validated official source, not free text)                                                             | include                              |
| `…boundary_decision` generation, epoch, hash columns                              | preserve                                                                                                        | exclude (operational)                |
| `directory_address_review_decision.actorId`                                       | null when it equals a current profile id                                                                        | exclude                              |
| `…address_review_decision.reason`, `checks`                                       | clear when `actorKind='human'`; keep on automated rows                                                          | include                              |
| `…address_review_decision.evidenceUrl`, `evidenceHash`, decision, ids, timestamps | preserve                                                                                                        | include                              |

The other 22 tables (imports, listings, towns, geometry, provider and census
state, receipts, and `account_deletion_write_fence`) hold no account or profile
identifier: preserve, exclude from export. The fence table holds only SHA-256
hashes of identifiers, not the identifiers.

Nothing is rewritten to `DELETED_ACCOUNT_ID`. All four columns are nullable, so
NULL is the tombstone; see the open decisions.

## Ambiguity rules

The scope is the account id, the current profile ids and the legacy profile ids
confirmed by Authentication. For every identity column:

- A match in the column's own domain is exact and is erased.
- Any other match of any scope identifier is ambiguous and blocks. This covers
  an account id found in a profile column or the reverse, a link event whose
  `actorDomain` is NULL (legacy rows written before the column existed) or
  unrecognised, and a UUID-shaped legacy profile id found anywhere.
- Legacy ids are never erased by, only blocked on. Non-UUID legacy keys cannot
  equal a `uuid` column and are ignored.
- A NULL domain is never backfilled by inference from the action.

When any ambiguous row exists, `erase` changes nothing and reports
`blocked > 0`. An operator has to resolve the rows (record the domain, or
remove the reference) and the same operation is retried. Reports carry counts
only, never identifiers or row contents.

## Write fence

Table `account_deletion_write_fence` (the shared entity from `libs/storage`,
created by generated migration `1794775325695-DirectoryFoundation.ts`).

- Every action (fence, erase, readback) installs the fence first, in the same
  transaction, for the account id, each profile id and each UUID-shaped legacy
  id. Installation is idempotent per operation; a different operation cannot
  take over an existing key.
- Business-link writes (`requestBusinessLink`, `reviewBusinessLink`,
  `revokeBusinessLink`) call `assertDirectoryIdentitiesUnfenced` first in their
  transaction for every identifier they are about to store or act for. It takes
  the same advisory locks the installer takes, then reads the table, so a write
  either commits before the fence or fails with `ACCOUNT_DELETION_FENCED`.
  Advisory locks are taken before row locks on both sides.
- The identifier is checked under all three kinds, because a write path knows
  the value but the fence may have recorded it as account, profile or legacy.
- Fence rows are kept after erase so a delayed or replayed write cannot
  reintroduce the identity.
- Enforcement is in the application, not in triggers. Other owners use triggers
  added by hand to their migrations; Directory migrations must be generated, and
  the CLI cannot generate triggers.

Not yet fenced: the reviewer write paths `recordBoundaryDecision`, the human
address-review decision and publish paths, and the local review scripts. See
phase 2.

## Erase and readback

`runDirectoryDeletion` runs one transaction per action with a 5 s lock timeout,
a 12 s statement timeout and a 10 000-row bound per table (over the bound it
fails closed with `DIRECTORY_DELETION_ROW_BOUND`). `erase` reads back inside the
same transaction and rolls back unless `remaining` and `blocked` are both zero.
A repeated erase finds nothing and appends nothing. `readback` is the same
count query and is verified only at zero/zero.

`executeDirectoryAccountDeletion` validates the grant shape with the shared
contract, requires `owner='directory'` and the expected action, confirms the
grant with Authentication through `AccountDeletionAuthorityClient`, and
confirms it again inside the transaction; a scope that changed between the two
aborts with `DIRECTORY_DELETION_SCOPE_CHANGED`. Because the shared contract does
not list `directory` yet, the default shape check refuses every grant.

## Export coverage

Not implemented in phase 1; the inventory's `export` column is the
specification. A Directory export receipt for an account must include:

- every link request the account owns: request id, town, listing, business
  community id, status, created time;
- every event on those requests, plus every link event the account or its
  profiles performed: action, domain, evidence URL, time;
- every boundary decision by its profiles: request id, community, decision,
  source URL, time;
- every address-review decision by its profiles: candidate id, actor kind,
  decision, reason, checks, evidence URL and hash, policy version, times;
- a count of rows withheld as ambiguous, with the receipt marked incomplete
  when that count is not zero.

It must exclude the identifiers themselves, other actors' identifiers on shared
rows, operational columns and all imported listing data. The export must use
the same domain-matching rules as erase so the two cannot disagree about what
belongs to an account.

## Transport

Recommended: a Directory internal HTTP route,
`POST /internal/account-deletion/{fence|erase|readback}`, authenticated by a
dedicated bearer secret, carrying the signed grant as the body. Directory
validates the grant back with Authentication over the existing Nest TCP
`ValidateAccountDeletionGrant` message. `createAccountLifecycleHandler` in
`apps/directory/src/account-lifecycle-server.ts` implements the route; phase 2a
mounts it (see "Phase 2a status").

Why: Directory is a plain Node HTTP service and already exposes its internal
operations this way, each behind its own purpose-bound secret. Making it a Nest
TCP microservice like the other owners would add a second server framework to a
service that deliberately has none, for one caller. The bearer secret
authenticates the caller; the grant, re-validated at the authority, is what
authorises the action, so a leaked secret alone erases nothing. The cost is one
HTTP owner client in Authentication next to the RPC one.

Alternative considered: Authentication connects to Directory's database
directly. Rejected: it moves Directory's disposition rules into another
service and bypasses the catalog check.

## Phase 2

1. Add `directory` to the shared owner lists and to Authentication's owner
   registry, with an HTTP owner adapter that maps `{verified, remaining,
blocked}` and a 409 `blocked` reply onto the orchestrator's states.
2. Mount the handler in both Directory runtime modes, add the secret to
   configuration and compose, and construct `AccountDeletionAuthorityClient`
   there. Remove the injected `grantShape` from tests.
3. Supply what Authentication expects from every owner beyond counts: the
   snapshot-purge reply and the runtime readback (instance id, logging policy
   version, database logging state).
4. Implement export capture from the inventory and register Directory as an
   export release owner.
5. Extend the fence to the reviewer write paths and decide on triggers.
6. Give operators a way to list and resolve blocked rows.
7. Compose-level test of a full deletion with Directory as an owner.

### Phase 2a status

Items 1 to 4 are done; the rest stay open.

1. `directory` is in the shared owner lists (`ACCOUNT_EXPORT_RELEASE_OWNERS`, aliased
   as `ACCOUNT_DELETION_OWNERS`). Authentication's `DirectoryOwnerHttpClient`
   sends the bearer secret and the signed grant. A 409 `blocked` reply becomes
   `DirectoryOwnerBlockedError`, which the runner treats as an owner error, so the
   operation is released as blocked and never completes. Any other failure is
   `DELETION_DIRECTORY_UNAVAILABLE`.
2. The handler is mounted on the internal HTTP server in `main.ts` and on the pending
   server in `DIRECTORY_MODE=register-pending-v1`, only when
   `DIRECTORY_ACCOUNT_DELETION_SECRET` is set. `AccountDeletionAuthorityClient` is
   built in `account-lifecycle-runtime.ts`; the injected `grantShape` is gone.
3. Extra routes under `/internal/account-deletion/`: `environment`,
   `purge-snapshots`, `runtime-readback`, served by the shared
   `AccountDeletionSnapshotController` (owner `directory`, payload-free logging
   installed on mount, database logging policy checked).
4. Export capture: `apps/directory/src/account-export-sources.ts` captures from the
   dispositions inventory over `/internal/account-export/{open|read|release}`, using
   the shared spool, Postgres owner and profile-bound snapshot service. Sources:
   `DirectoryBusinessLinkRequest`, `DirectoryBusinessLinkEvent`,
   `DirectoryBoundaryDecision`, `DirectoryAddressReviewDecision`,
   `DirectoryExportCoverage`. Only rows matched in the user's own domain are
   exported; identifier columns are never selected. Ambiguous rows are withheld and
   counted in the coverage row, which marks the receipt incomplete.

Tests: `directory:test-account-lifecycle` (unit, includes the route and sources),
`directory:test-account-lifecycle-postgres`, and
`directory:test-account-lifecycle-http-postgres` (the mounted route on a disposable
database: bad secret 401, refused grant, fence, blocked erase 409, erase, readback,
export capture, snapshot purge). Authentication: `directory-owner-http.client.spec.ts`
and the `directory owner over HTTP` block in `account-deletion-rpc-owners.service.spec.ts`.

## Decisions needing owner confirmation

Each was settled with the most conservative N04-consistent choice.

1. **NULL rather than `DELETED_ACCOUNT_ID`.** The columns are nullable and a
   shared sentinel would make deleted accounts collide in owner-scoped queries.
2. **Live links end with their owner.** Pending and approved requests are
   revoked and the listing is detached, recorded as a `system` revoke event.
   Alternative: keep the page attached with no owner.
3. **Evidence URL on the owner's own requests is cleared**, including on the
   reviewer's event. It was supplied about the owner's claim and may identify
   them.
4. **Reviewer history is kept without the reviewer.** Decision, time, official
   source URL and evidence stay; the reviewer id goes. Alternative: delete the
   rows, which would remove the audit basis for published boundaries and
   addresses.
5. **A human reviewer's `reason` and `checks` are cleared**; `evidenceUrl` and
   `evidenceHash` stay as evidence about the business.
6. **Legacy NULL-domain events always block.** Deriving the domain from the
   action (`request` implies account) would unblock most of them but guesses
   for `revoke`.
7. **A UUID-shaped legacy id blocks wherever it matches** and is never erased.
8. **Application-level fence, no triggers.** Triggers need hand-written
   migration SQL.
9. **Reviewer write paths are not fenced in phase 1.** A deleted reviewer could
   still record a boundary or address decision until phase 2 item 5.
10. **Fence rows are kept forever.** They contain only SHA-256 hashes of identifiers.
11. **No operator tooling for blocked rows yet**; resolution is manual SQL.
12. **Row bound of 10 000 per table per account**, failing closed above it
    rather than batching.

## Phase 2b

`recordBoundaryDecision`, `recordHumanAddressReviewDecision` and
`publishAddressReviewCandidate` now call `assertDirectoryIdentitiesUnfenced` first in
their write transaction for the reviewer or publisher id, so decision 9 no longer
holds for them. System and automatic actors have no identity and are not checked.
`reviewed-boundary-install.ts` and the local review scripts write no reviewer id
directly; the publish script goes through `publishAddressReviewCandidate`. Decision 11
is partly met by the read-only report `scripts/local-directory-account-lifecycle-blocked.cjs`
(`docs/operators/directory-account-lifecycle.md`); resolving rows is still manual SQL.

## Phase 2a decisions needing owner confirmation

13. **Export ambiguity counts the account id and current profile ids only.** Legacy
    ids are not known at export time. Any ambiguous row marks the receipt incomplete.
14. **Link events on the owner's requests are exported regardless of actor**, but
    `actorId` is never exported, only `actorDomain`. A profile-actor event on someone
    else's request carries no `requestId`.
15. **A bad bearer is 401 and a non-POST is 405.** A refused grant is 403; an
    unreachable authority, a changed scope or an unverified environment is 503 with
    an empty body.
16. **Directory is one HTTP origin**, with no TCP replicas. Authentication config is
    env-only (`DIRECTORY_ACCOUNT_LIFECYCLE_URL`, `DIRECTORY_ACCOUNT_LIFECYCLE_SECRET`).
17. **One shared value.** `DIRECTORY_ACCOUNT_DELETION_SECRET` on Directory is the
    same value as `DIRECTORY_ACCOUNT_LIFECYCLE_SECRET` on Authentication. It must be
    at least 32 printable bytes and differ from every other Directory secret.
18. **Authentication fails startup on a one-sided setting** (URL without secret or the
    reverse). With neither set, startup succeeds and every Directory call fails, which
    blocks deletion and export instead of skipping Directory.
19. **Routes live on the internal server** (`DIRECTORY_PORT`, 3120).
20. **Mounting installs payload-free logging** in the Directory process, and the
    `environment` route requires the database logging policy (statement logging off)
    to be active; the operator must configure it.
