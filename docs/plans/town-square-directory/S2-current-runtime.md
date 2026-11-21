# S2 current-source isolated runtime evidence

2026-11-04. **Partial S2 runtime evidence; not region validation acceptance.** Ready geometry is deliberately unavailable until S3. This run proves the observed pending and fail-closed paths, not boundary containment, reconciliation, production ingress security, or all privacy-transition races.

## Source and images

HEAD was `6a472b41f957500ccbd987457818ffdc85b1663f` with pre-existing uncommitted application changes. A disposable snapshot was made from `git ls-files -co --exclude-standard` before the builds and used as the Docker build context for all images and migration builders. The source tar SHA-256 was `e5045a0e7e045e97865cd42da4791c9203556c8e54c13e7c29d639d515f86005`. After the run, all 9,531 snapshotted files matched the checkout by SHA-256, and the tracked/untracked nonignored file list was unchanged. The sorted complete file hash manifest SHA-256 was `77e2bbc5a6124d661595b8760f88cb3408a9d6a9a318a72ef054df54b4b5c27e`; the 3,800-file Social/gateway/directory/libs subset manifest was `c998c2f6bbcff95a67eef1a2dbb7fda26d5a9d583b5a5b7970c535f5f5f95b82`. The snapshot was made before, and compared after, the runtime run; it is not a guarantee that files never changed transiently between comparisons.

Relevant file SHA-256 values in the snapshot and checkout both before and after:

| File                                                             | SHA-256                                                            |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ |
| `apps/social/src/app/app.controller.ts`                          | `81a61f4c3842c7f12c8b4a007684d2d56a5a3fae1bf80f12a8eae6186f17b75a` |
| `apps/social/src/app/services/community.service.ts`              | `94791142aaad4ecf14b9948aee30e0e8d95777a1693a84a016b96c7c7404c063` |
| `apps/gateway/src/controllers/directory/directory.controller.ts` | `6dbb53db0a58b65db7fcd45875eae1d852d3c1e9e8f6e3bc7b0ec66f46e8103a` |
| `apps/directory/src/server.ts`                                   | `08c7ab1e95b83984939f78f83bd5be103fbb6dc2608c69f8b03c2a499a3126cb` |
| `apps/directory/src/town-geometry.ts`                            | `99dfebf51d8ae52a5f8a4763f3815045b389b0e7e9e1f208f7e2663699141ad0` |

Runtime image IDs: Social `sha256:625c7187a9535e8e147dc9e851960d091749be1c304fbb5ca6306ac6187700a4`; gateway `sha256:a53c5879e13e2e305b36829b0afac907dff1ec1fbc6c06c40fd0a5a9ffb0ab57`; directory `sha256:c4f1f03cd7c5c2829b1f5f641f24cb512685eb7ad35974b97995f4cc16608c80`. Images were built with each app's Dockerfile against the frozen context. Docker cache and external base/package dependencies were used; these hashes establish the tested image identities, not a reproducible dependency supply chain.

## Real-stack results

A disposable PostGIS database ran the Social and directory Nx migration targets; the checked-in Social seed created Atlanta (`edb420ee-ab56-4058-9463-69f82ec4f63d`). Synthetic rows supplied a public nonseed town, private town, wrong-scope town, and public town with alphabetic UUID; another UUID was absent. No provider acquisition, POC data, or paid operation was used. Requests were unauthenticated through the gateway.

| Probe                                            | Observed                                       |
| ------------------------------------------------ | ---------------------------------------------- |
| Seeded Atlanta and public nonseed                | 200, `pending`, only `town.id` and `status`    |
| Private, wrong-scope, absent                     | 404 each                                       |
| Uppercase `ABCDEF12-ABCD-4ABC-8ABC-ABCDEF123456` | 200, canonical lowercase ID and `pending`      |
| Malformed UUID; longitude 181                    | 400 each                                       |
| Valid coordinates                                | 200, `pending`                                 |
| Social stopped                                   | 503 `Social unavailable`; 200 after restart    |
| Directory stopped while Social and Redis were up | 503 `Directory unavailable`; 200 after restart |
| Redis stopped after Directory recovery           | 503 `Directory unavailable`                    |

For the stored-invalid case, a synthetic self-intersecting polygon was inserted into `directory_town_geometry`, with the town marked `invalid`; PostGIS returned `ST_IsValid=false` and a self-intersection notice. Both status and point validation returned 200 `pending`, without exposing geometry. This exercises a persisted invalid state, not the geometry ingestion/validation service itself, and does not establish ready-geometry behavior.

The gateway was attached to an internal service network and a separate ingress network and published only on loopback. Social and Directory had no published ports. A disposable client on the ingress network timed out when connecting to Directory's service name and separately to its actual service-network IP `172.18.0.5:3120`. This proves only those attempted paths in this Docker topology; host access, other networks, and production routing were not exhaustively tested.

## Execution and cleanup

Final run: `timeout 300s /tmp/s2current-roundtrip.sh`, exit 0; detailed output is `/tmp/s2current-roundtrip-independent.log`, source snapshot `/tmp/s2current-context`, tar and manifests `/tmp/s2current-source.tar`, `/tmp/s2current-all.sha256`, and `/tmp/s2current-snapshot.sha256`. These are local temporary evidence, not durable repository artifacts. Nx reported Cloud DNS warnings in the isolated network, while both migration targets reported success.

An initial attempt hit Postgres's temporary initialization listener; using TCP readiness resolved it. A subsequent run reached the direct-IP timeout but the disposable Node probe did not exit before its command deadline; explicit probe exit resolved that. The independent-outage run above supersedes both. Exit traps removed this run's uniquely named containers and networks, and a Docker listing showed no `s2current-` containers or networks afterward. Test images, build cache, and local temporary evidence remain; no shared service was stopped, and no app source was edited by this pass.

## Independent current-source rerun

On 2026-11-04 this verification was repeated from a newly frozen checkout snapshot at HEAD `6a472b41f957500ccbd987457818ffdc85b1663f` (dirty working tree). The snapshot tar SHA-256 was `049d4df15ac30a8c7fb4021026f825e634ab36b9ae41c9f4acb9a739866902e3`. The sorted SHA-256 manifest of all 3,800 files under `apps/social`, `apps/gateway`, `apps/directory`, and `libs` was `c998c2f6bbcff95a67eef1a2dbb7fda26d5a9d583b5a5b7970c535f5f5f95b82` both in the frozen context before the builds and in the checkout after the run. The five individual hashes in the table above also matched before and after. This comparison does not rule out transient changes between snapshots, or establish reproducible external dependencies.

The three Dockerfiles were rebuilt from that snapshot, using Docker cache where applicable. Runtime image IDs were Social `sha256:625c7187a9535e8e147dc9e851960d091749be1c304fbb5ca6306ac6187700a4`, gateway `sha256:a53c5879e13e2e305b36829b0afac907dff1ec1fbc6c06c40fd0a5a9ffb0ab57`, and directory `sha256:c4f1f03cd7c5c2829b1f5f641f24cb512685eb7ad35974b97995f4cc16608c80`. The Social and directory migration-builder images were `sha256:2e02e104878a6c3633188c6b34c2e34b30a2af706eb6b6385e6af6f873719575` and `sha256:9f8cf48ca4a239c7fb4db4f9a6ab52e5a145006834da0ab69f9ef9a87ed11b4e`. Both Nx migration targets succeeded on a new isolated PostGIS database; Nx Cloud emitted DNS warnings. The checked-in seed created Atlanta `6bb00d66-61b7-4978-985c-cf056a327e5e`.

The inspected `/tmp/s2isolated-roundtrip.sh` and its stronger prior derivative were used to prepare a separate script with unique image tags and log paths. `timeout --signal=TERM --kill-after=15s 300s bash /tmp/s2verify-1793819947-548530/roundtrip.sh` exited 0. Its unauthenticated gateway probes observed:

| Probe                                                                 | Result                                                                                           |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Seeded Atlanta; synthetic public nonseed                              | 200, `pending`                                                                                   |
| Private, wrong-scope, missing                                         | 404 each                                                                                         |
| Uppercase UUID                                                        | 200, canonical lowercase ID and `pending`                                                        |
| Malformed UUID; longitude 181                                         | 400 each                                                                                         |
| Valid point                                                           | 200, `pending`                                                                                   |
| Persisted self-intersecting polygon marked invalid                    | PostGIS `ST_IsValid=false`; status and point validation both 200 `pending`, no geometry returned |
| Social stopped, then restarted                                        | 503 `Social unavailable`, then 200                                                               |
| Directory stopped, then restarted                                     | 503 `Directory unavailable`, then 200                                                            |
| Redis stopped after directory recovery                                | 503 `Directory unavailable`                                                                      |
| Ingress-only client to directory name and actual IP `172.18.0.5:3120` | Both timed out; Social and directory had no published ports                                      |

The gateway was published only at loopback port `32774`; the disposable internal and ingress networks and containers named `s2verify-1793820037-557553-*` were absent after the exit trap. Temporary snapshot, manifests, script, and logs remain under `/tmp/s2verify-1793819947-548530/`; uniquely tagged test images and Docker build cache remain. No shared services were stopped, and no source acquisition, provider calls, paid operation, or publication was performed.

This remains partial runtime evidence: the persisted-invalid probe inserts synthetic state directly and does not test ingestion; ready geometry, containment, reconciliation, privacy-transition races, host/other-network access, and production routing remain unverified. The script prints observations rather than asserting each response, so the results above were inspected from its captured log.
