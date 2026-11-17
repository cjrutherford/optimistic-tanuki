# S3 v2 proof live handoff — 2026-11-05

**Result: PARTIAL PASS; full end-to-end operator proof remains unverified.** The current source was exercised on two separate, fully migrated disposable databases on one PostGIS server, with all application writer and serving processes stopped. This is a simulated external fence, not a test that the software detects or enforces a real external fence. The Social traversal source was an empty in-process census stub; the actual Social recovery RPC, nonempty traversal, and complete operator-to-operator traversal handoff were not exercised. The first Social preparation and lock checks invoked the same exported source functions directly; the exact prepare retry used the CLI. Concurrent lock tests used a held database row lock and a waiting operation, not two concurrent operator processes. Old v1 and post-refence v2 proofs were rejected; replay against a separately advanced Directory recovery was not tested. No claim of activation, serving, ACK enablement, restore detection, or production readiness is made.

## Environment and execution

- Checkout HEAD `6a472b41f957500ccbd987457818ffdc85b1663f`; substantial pre-existing uncommitted changes, including the tested source. Current files were bind-mounted read-only into the builder. No application files were edited by this test.
- Isolated internal Docker network `s3proof-30635-3976011-net`; PostGIS image `postgis/postgis:17-3.5` ID `sha256:2ed748fc602dd3031c6724db8cb289e1578c2deb552a4f6e291f6f7e5e6e4f69`, PostgreSQL 17 / PostGIS 3.5.2. Separate `social` and `directory` databases, same disposable server. Builder `s3live-social-builder` ID `sha256:ca607200f52fcdc55c43ae71e91361e180ce8286439944524c6bb85c7f2fc5d6` supplied cached binaries and dependencies; no installation or image build.
- `/tmp/s3-proof-setup.sh` ran `pnpm exec nx run social:typeorm:migration:run` and `pnpm exec nx run directory:typeorm:migration:run`, with `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`. Both exited 0; migration tables contained 36 and 11 rows respectively. Logs: `/tmp/s3-proof-social-migrate.log`, `/tmp/s3-proof-directory-migrate.log`. SHA-256 of the sorted `sha256sum` output for all files in both migration directories: `d55dfdc6ba0ec07dd2916b8ee5ba65b8081d773eb8b4c6c0f3f066d64099c414`.
- Harness: `/tmp/s3-proof-harness.js`, SHA-256 `3b213dd1aeffe5d0f96a8116055d667a0e65be065cb6254406f81b749224ea56`; setup SHA-256 `d7c0f84c4a25b510b68382fcf78722cf2a229d2cd01f475e9d0b099581de2dd1`. Command: `docker exec -e NODE_PATH=/usr/src/app/node_modules -e TS_NODE_PROJECT=/usr/src/app/apps/directory/tsconfig.json s3proof-30635-3976011-build node -r ts-node/register/transpile-only -r tsconfig-paths/register /proof-temp/s3-proof-harness.js` (180-second timeout), exit 0; output `/tmp/s3-proof-run.log`. Initial launch without `NODE_PATH` failed before test execution with `Cannot find module 'reflect-metadata'`; corrected environment succeeded.

## Observations

- PASS: Directory proof CLI rejected blocked and intermediate checkpoints, issued v2 only after both empty traversal passes. Real Directory begin and Social begin/bind CLI paths were used.
- PASS: independently changing each of six identity arguments caused Directory proof issuance and Social bind to reject; forged signature and v1 traversal label rejected on bind.
- PASS: Social bound the expected recovery epoch, owner and Directory generation; preparation left Social fenced, marked it prepared, and retired the initial outbox row. Directory proof and Social prepare each waited while their relevant row was locked, then completed after release.
- PASS: an exact prepare CLI retry preserved a subsequently inserted outbox row; the pre-existing Directory receipt remained. Refencing caused the old proof to be rejected for bind and prepare, preserving that outbox row and receipt.
- NOT TESTED: pre-prepare preservation assertions for all rejection cases; invalid proof and swapped-field rejection specifically at prepare; concurrent competing operator processes; nonempty Social/Directory census and actual recovery RPC; independently advanced Directory rejecting an older otherwise valid proof. The held-lock tests alone do not establish every concurrency interleaving.

## Source SHA-256

```text
7e2f0bce0d3fa866bf9c56c6a555ba0f44d2b45804b05662fd5d0bac15d2cabf  apps/directory/src/recovery-authority.ts
12c1d82b3e757f13c2584ffa53cf9939de3773d98f0055fd600473fc8b54a561  apps/directory/src/recovery-traversal.ts
9f849e7b058af3a495f8dda8e8702acfe8da100cf987b479d1609307e2aaa64b  apps/directory/src/recovery-proof.ts
dfa3af01d131d8d4a254bd0654437bdf8dca4185c130ebc6ecbbe3f27ae88bb1  apps/directory/src/recovery-begin-operator.ts
643eb0fb886a8b3b3549b65c7ffe051f3cf29e43ed990a4d0785684240b24ee6  apps/directory/src/recovery-proof-operator.ts
a2be6afb1724c4d96977dba2652e3d7b8ef34623beecf945cd8335d841ba8981  apps/social/src/source-epoch-operator.ts
1c39d38f5850127e5029064994586d8f1429492b967ca18d16a73d5e707ba10c  apps/social/src/app/services/community-directory-epoch.ts
134c61a356a056e4bd8f7a320b1d2a1bd95ff4356c8388279ef3ce235594df1d  libs/social/contracts/src/lib/directory-recovery-proof.ts
```

## Cleanup

`docker rm -f s3proof-30635-3976011-build s3proof-30635-3976011-db` and `docker network rm s3proof-30635-3976011-net` exited 0. Subsequent filtered container and network listings were empty. Temporary scripts and logs remain under `/tmp` for inspection; no production resources, provider services, publication, commits, or installations were used.
