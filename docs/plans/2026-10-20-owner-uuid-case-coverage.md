# UUID case coverage in existing account-export owners

Goal: include uppercase canonical UUID owner keys stored in varchar columns before adding further job stages or accepting account artifacts. The J13 Permissions reader already has this behavior. Source review found matching omissions in current/legacy Profile, Assets and Videos; Authentication's reviewed keys are native UUID columns.

Scope: existing owner readers and focused component fixtures only. No schema, writer/API, shared transport, job, UI, Directory, root Compose or alias changes. Preserve current bounds, lease/snapshot rules, strict UUID validation, counterpart preservation and cleanup.

## Ownership policy

Canonical UUID text is case-insensitive. Compare varchar account/profile owner columns through `lower(column)` with canonical captured UUIDs/account IDs, and normalize returned UUID identity fields after validation. Native UUID columns need no text-case workaround. This does not broaden ownership to arbitrary noncanonical strings or fetch counterpart content.

Apply the same predicate to every page and long-text/media reread. Assets media ordering/cursors must use the same folded profile key on both sides; otherwise mixed-case rows can disappear across page boundaries. Guardian activity actor/dependent account keys are also varchar and need equivalent treatment. Video channel, subscription, view and live-session actor predicates must keep their existing relationship checks.

## Owned files

The Profile worker owns current `account-export-owner.service.ts`, legacy `account-export-legacy-reader.ts`, their existing focused specs where necessary and the existing opt-in PostgreSQL owner fixture under `apps/profile`. The media worker owns `apps/assets/src/app/account-export-owner.service.ts`, its focused spec and HLS PostgreSQL fixture, plus `apps/videos/src/app/account-export-owner.service.ts`, its focused spec and PostgreSQL fixture. Root owns private runners, source/evidence capture, review and documents. No nested delegation or unrelated edits.

## Acceptance

For each changed owner, run the narrow meaningful unit selection and owning production build/lint, then a fresh private migrated PostgreSQL selection proving uppercase principal capture through the real SQL. Include Profile and Timeline plus retained Goal/Project owner keys and long-text/media rereads; Assets metadata/bytes/HLS references, guardian account roles and mixed-case media keyset boundaries; Videos owned channels, subscriptions and actor-owned foreign-target views. Preserve minimum IDs, exact record counts/digests and counterpart fingerprints.

Use the existing opt-in fixture isolation and actual migration classes. Fake only the already-established Auth/Profile RPC boundaries. Verify temp relations, spools/file descriptors, fixture rows/schema restoration and private teardown. Tests and images from earlier slices are historical evidence; do not rerun unchanged broad suites or claim a live transport fix from component tests alone.

After this component repair, integrate the accepted Permissions reader using the shared leased registry/pull client, stage it after Videos and clean children in reverse order before Profile. Then finish Social, Forum and remaining domain owners before durable encrypted artifacts/downloads, deletion and shared controls. DF-007/RR-11 remain open.
