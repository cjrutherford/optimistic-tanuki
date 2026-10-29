# DF-007 J15 — Permissions snapshots in export jobs

**Status: locally verified bounded internal integration.** Authentication now captures Permissions through the shared leased snapshot transport. A narrow private run passed the Permissions integration after a fixture-only correction; four unchanged cases passed in the preceding attempt and were not rerun together. This is not a single combined green run or production qualification. DF-007 and RR-11 remain open.

## Behavior

Authentication captures owner data in this order: Authentication, Profile, Assets, Videos, then Permissions. The Permissions capture uses the exact leased Profile descriptor shared with Assets and Videos, and the same job lease is renewed while the shared pull client reads bounded chunks. Permissions exposes only the internal open/read/release TCP commands and the `roleAssignment` and `rolePermission` sources.

The generic Storage participant type now includes Permissions; the Auth wrapper uses that type directly without a compatibility cast. The job records the fifth owner marker only after the Permissions spool has been verified and its cleanup succeeds. It closes child snapshots in reverse order: Permissions, Videos, Assets, Profile. A Permissions capture or cleanup failure retains the four earlier owner markers. Earlier cleanup failures reduce the prefix. A lost lease cannot finish or acknowledge the job.

Jobs remain `incomplete` with a null artifact. Snapshot spools remain local and bounded by the shared Storage limits: two active entries, 64 KiB reads, 256 MiB per capture, 512 MiB aggregate reservation, and a 120-second handle lifetime. This is capture evidence, not durable export assembly or portability acceptance.

## Evidence so far

Twenty-three distinct focused tests passed: one Permissions wrapper test and 22 Authentication client/job tests; three database-gated job tests were skipped. After the shared participant type was widened and the local cast removed, the three shared-client tests were rerun and passed; they are not counted as additional distinct tests. Permissions and Authentication production builds and lint passed; shared Models/Constants builds and lint, Storage lint, and Authentication E2E lint passed. Peer production review returned GO with no concrete blocker.

Logs are retained under `.runtime-artifacts/account-rights/finish-sequence/permissions-integration/`: `permissions/wrapper-unit.log`, `auth/client-job-unit.log`, `root/client-type-unit.log`, the Permissions and Auth `build.log`/`lint.log` files, and shared `root/shared-build.log`/`shared-lint.log` plus `root/fixture-lint.log`.

The narrow private E2E selection passed one Permissions case on attempt 2. It captured two owned assignments and two reachable role-permission links across the first and last of 1,006 captured Profile identities, excluded a foreign assignment, and checked cross-scope, null-context, and opaque-target records. Exact source counts and database-derived record expectations matched; the job remained `incomplete` with `artifactUrl: null`. The fixture compared counterpart fingerprints and restored all seeded Permissions definitions to baseline.

Attempt 1 had four existing selected cases pass and the new Permissions fixture fail; six cases were unselected. The fixture's negative override was overwritten, leaving the child identity count at zero. After correcting only the fixture, attempt 2 reran that Permissions case alone and passed. Thus five unique selected cases passed across two attempts; the four unchanged cases were not rerun, so no combined all-green run is claimed. Attempt 1 teardown left zero containers, networks, or volumes.

Attempt 2 verified zero fixture rows and temporary relations in Auth, Profile, Assets, Videos, and Permissions; all five owner processes had zero spool file descriptors, and the private media fixture directory was empty. Assets/Videos processes and Auth/Profile process IDs remained unchanged; Permissions alone restarted and successfully served recapture. The test log includes expected TCP `ECONNRESET` messages during the intentional Permissions restart, so logs are not claimed to be error-free. Final teardown left zero private containers, networks, or volumes. The exact final-image proof compared all Docker COPY inputs and bytes for five services after a fixture-only refreeze; each final image retained its built image ID. Runtime artifacts and image IDs are recorded in `.runtime-artifacts/account-rights/finish-sequence/permissions-integration/runtime/attempt-2/` and `final-image-proof.json`.

The accepted runtime source base is `ad87e1c567d6a64ca4ed063a995363da196e972c`; final source manifest `bf5389a29c235bb90ea438bb018ebd89cb2528c2b6bdb3e7de0b3951650c0cb4` contains 18 source hashes. Capture metadata and compose configuration are in `.runtime-artifacts/account-rights/finish-sequence/permissions-integration/runtime/capture.json` and `compose.json`. This is local integration evidence only. See the [J15 checkpoint](../evidence/df-007/checkpoint-j15.json) for exact gate results, image IDs, and evidence paths.

## Remaining work

Social, Forum, and remaining domain owners still need complete captures. Durable encrypted artifacts, authorized downloads, deletion, reusable lifecycle controls, and shared UI remain open. External provider flows, browser validation, remote CI, and production qualification are separate work. DF-007/RR-11 are not complete.
