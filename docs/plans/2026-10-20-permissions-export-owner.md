# Complete Permissions account-export owner

Goal: replace partial-preview assumptions with a bounded complete reader for personal role assignments, using every identity page from the retained Profile snapshot. Implement after HLS component acceptance; integrate the leased transport/job checkpoint only after the reader has its own PostgreSQL evidence.

Use the established Videos owner/emitter and shared Profile identity consumer in the existing Permissions app. No schema or UI changes, new library project, Directory/configuration edits, worktree or external operations. Keep the existing partial preview API intact.

## Ownership and dispositions

`role_assignment.profileId` in the captured identity scope is the personal ownership predicate. Export every assignment, including opaque nullable `targetId`, independent nullable assignment scope, role ID and original timestamp. Minimum UUID cursors must work. Treat uppercase canonical UUID profile strings as the same identity, normalizing the exported UUID; derive the ownership join from that policy.

Role, Permission and AppScope definitions are shared context. Export only the definitions reachable from owned assignments; never describe or delete them as personal rows. Use two deterministic sources, `roleAssignment` and `rolePermission`. Assignment records include bounded Role and nullable assignment/Role scope context. Role-permission records include reachable Permission and its nullable scope context, keyed by role/permission UUID pair and deduplicated through an EXISTS ownership predicate. Include roles with zero permissions. Exclude the scope-wide `app_scope_permissions` configuration matrix.

Preserve independent assignment, Role and Permission scope IDs: the checked-in seed intentionally has cross-scope links. Validate each non-null reference independently. Missing required Role, Permission or referenced scope is corruption; nullable Permission scope after SET NULL and missing opaque target resources are legitimate. All context is read-only.

## Reader and cleanup

Follow the Videos owner signature and exact copied six-field grant validation. One capture per instance, cooperative deadline at most 45 seconds, exact Auth lease validation before chunks and completion. Dedicated QueryRunner, private profile temp table, read-only repeatable-read transaction, 10-second statement and two-second lock bounds. Consume all Profile pages without a whole-account identity array. Pages use 200 rows plus a probe, bounded SQL projections and null initial cursors.

Define explicit limits before serialization: names/resource/action 1024 characters, descriptions 65536, opaque target references 4096. Include SQL original lengths and fail oversize instead of truncating silently. Preserve timestamp-without-time-zone values as database text, without inventing a timezone. Existing emitter/spool byte budgets still apply; fail if a composite context record exceeds them.

Cleanup precedes terminal proof: commit or rollback, drop temp relation, release runner, final lease validation, terminal. Dirty cleanup quarantines the owner and error-releases the underlying PostgreSQL connection through the established bounded seam. Set production datasource `connectTimeoutMS: 3000`; preserve existing env overrides and migration behavior.

## Verification

Run only meaningful focused owner/config tests, then Permissions build/lint before the private fixture. A new disposable migrated database must exercise 1006 captured identities (eleven shared identity pages), first/minimum/middle/last assignments, multiple keyset pages, counterpart exclusion, reachable shared context, cross-scope links, zero-permission roles, null scope and opaque missing targets, long/oversize text, repeatable-read insertion, stale lease/abort/failure and dirty cleanup. Fake only Auth/Profile RPC. Retain checksums/counts, six-table fingerprints, independent row/temp/spool readback and exact private teardown. Verify an occupied single-connection pool with production timeout options.

After component acceptance, add a thin Permissions wrapper over the shared leased registry and Auth pull client, register the providers/internal commands and stage after Videos with reverse child cleanup before Profile release. Jobs remain incomplete and artifacts null until all required owners are accepted. Run affected CI-aligned gates and selected actual TCP cases before marking that integration verified.

Record findings and synchronize the master audit/execution map. DF-007 and RR-11 remain open throughout these bounded components. Social, Forum, remaining domain owners, durable encrypted artifacts/downloads, deletion and reusable shared controls follow.

Before artifact acceptance, audit the other varchar-backed principal predicates for the same UUID case boundary. Existing Assets joins compare captured lowercase UUID text with raw profile strings; their uppercase-key behavior has not been covered. Repair and verify any omissions in a bounded follow-up rather than claiming whole-account completeness from canonical-only fixtures.
