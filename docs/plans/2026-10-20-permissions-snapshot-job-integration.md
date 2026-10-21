# Permissions leased snapshots and export-job integration

Goal: connect the accepted J13 Permissions reader to the existing shared snapshot transport and Authentication job coordinator, after the J14 UUID case repair. Keep the existing partial preview API intact. Jobs remain incomplete with no artifact until required owner coverage and durable delivery are accepted.

## Contract and ownership

Root owns the shared Constants commands/source tuple and Models aliases, runtime fixture/compose/image provenance, actual integration checks and audit documents. The Permissions worker owns the thin registry wrapper, internal controller, module registration and owner source-tuple alias. The Authentication worker owns the thin pull client/spec, Auth module registration, job coordinator/spec and existing Auth constructor-call fixtures and E2E owner-list expectations. No nested agents, root Compose/alias edits, schema changes, new libraries or UI.

Add `PermissionCommands.OPEN_ACCOUNT_EXPORT_CAPTURE`, `READ_ACCOUNT_EXPORT_CAPTURE`, `RELEASE_ACCOUNT_EXPORT_CAPTURE` with `permissions.export.open/read/release`. Export `PERMISSIONS_ACCOUNT_EXPORT_CAPTURE_SOURCES = ['roleAssignment','rolePermission']`. Add Permissions descriptor/open-request aliases to the existing Profile-bound Models types. Reuse generic Storage registry/client; change them only if a concrete new-participant incompatibility is found.

The Permissions registry uses the real accepted owner, shared owner spool, Authentication RPC and Profile identity RPC. Register providers using the existing database/service tokens. Expose the three internal TCP handlers through a separate controller beside the partial preview handler. The established Permissions service token and configuration remain authoritative; default TCP port is 3012.

## Job behavior

Capture Authentication, Profile, Assets, Videos, then Permissions, retaining the exact leased Profile parent for all three children. Verify the new child through the generic pull client and source counts/digests. Renew the job lease while reading. Mark Permissions only after verified capture and successful cleanup. Clean Permissions, Videos, Assets and Profile in that order.

A Permissions capture or cleanup failure records its blocker and preserves only the four preceding verified owner markers. Earlier child/parent failures invalidate their dependent prefixes. Lost leases cannot acknowledge work. Do not persist tokens, content or stale handles in the job ledger. Preserve retry/idempotency and explicit incomplete status/artifact-null behavior.

## Verification

Run narrow wrapper/client/job regressions once, then Models/Constants builds/lint, Storage lint, Permissions/Auth production build/lint and Authentication E2E lint before private runtime. Update all exact constructor call sites and actual success/retry owner-list expectations; preserve failure prefixes at earlier stages.

The checked-in private E2E selection must use real Auth/Profile/Assets/Videos/Permissions RPC and databases. Seed owned assignments on multiple captured Profile pages plus a foreign account's assignment, shared cross-scope/null context and opaque missing targets. Compare exact expected owned/context records with independently read database facts, source counts, terminal record checksum and whole-spool SHA. Exercise scope mismatches, parent binding, lease expiry/revocation, child restart/recapture and an actual job failure/retry at Permissions. Keep prior media capture checks through the current HLS and UUID-corrected source when practical.

Build the changed runtime images from a frozen source set, validate entrypoints, and use the smallest existing private dependency closure. Do not execute old revision-pinned launchers in place. Record exact image/source provenance and retained dependency images separately from production qualification. Verify counterpart fingerprints, fixture/temporary rows, process-held spools, host files and zero private resources after teardown. Record skips and earlier failed attempts separately.

After acceptance, complete Social, Forum and remaining domain owners, then durable encrypted artifacts/downloads, deletion and reusable account controls. DF-007/RR-11 remain open. External provider flows and production qualification remain separately owned.

## Local acceptance

J15 is locally verified; see the [finding](../release-readiness/findings/DF-007-J15-PERMISSIONS-SNAPSHOT-INTEGRATION.md) and [receipt](../release-readiness/evidence/df-007/checkpoint-j15.json). Twenty-three distinct focused tests passed; three opt-in DB tests were skipped. Three client cases were rerun after replacing a local cast with the shared participant type. Affected builds/lints passed before private runtime. Five images were built from base ad87e1c567d6a64ca4ed063a995363da196e972c plus explicit source overlays, excluding the forty-three protected files. Fixture-only refreezes retained identical Docker COPY inputs and image IDs.

Initial runtime: four existing selected cases passed, the new Permissions case failed because its negative payload overwrote the tampered parent descriptor; review also corrected the child descriptor identityCount expectation to zero. Parent identityCount remains 1,006. Corrected narrow runtime: one Permissions case passed with zero skips, all independent readbacks/spools/media checks and private teardown passed. The earlier four unchanged cases were not repeated; five unique cases are verified across two commands, without a combined-green claim. No production behavior changed in response to this fixture failure. Jobs remain incomplete with artifactUrl:null; global owner coverage, artifacts/downloads, deletion and shared controls are pending.
