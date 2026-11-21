# S2 isolated Social–gateway–directory evidence

2026-11-04. Result: **partial runtime evidence**, not full S2 acceptance. Checkout HEAD `6a472b41f957500ccbd987457818ffdc85b1663f` was dirty with concurrent, uncommitted application changes. No application source was edited for this test. Runtime images were built from the working tree; because it was changing during the builds, HEAD alone does not reproduce them. The Social and directory builder images subsequently inspected contain the same hashes as the current `community.service.ts`, `app.controller.ts`, and `directory/src/server.ts` respectively; this does not establish a complete source snapshot for all three runtime images.

## Setup and observations

Fresh Social, gateway and directory Docker images were built; runtime image IDs were respectively `sha256:7659afd332d1270e36410ba559f7c69c4cc931d8c78620ed4b46a9e40b284694`, `sha256:43b5f5cbc19ddcb278900f8ddd03d00bd35078ef06da03890c24c66febcf240e`, and `sha256:c4f1f03cd7c5c2829b1f5f641f24cb512685eb7ad35974b97995f4cc16608c80`. A disposable PostGIS database ran the Social and directory Nx migration targets. The checked-in Social seed script, with `SEED_LOCALITY_SLUGS=atlanta-ga` and `SEED_SKIP_CHAT_ROOMS=true`, created one Atlanta Community. Its generated UUID for this run was `7ac38347-b83c-4843-ae3b-d5987239f33f`; this is disposable test data, not a census of existing towns. Three manually inserted synthetic UUIDs represented a public nonseed town, private town, and wrong-scope town. A fourth UUID was absent.

The gateway joined a disposable private service network and a separate disposable ingress network, publishing its port on loopback only. Social, PostGIS, Redis and directory were on the private network; directory had no published port. An independent container on the ingress network attempting `http://directory:3120/health/ready` timed out. This demonstrates the attempted network path failed in this topology; it does not establish production ingress behavior, or test direct access by IP from every network. No Social port publication or direct-host bypass matrix was separately inspected.

Unauthenticated HTTP requests through the gateway yielded:

| Case                               | Observed result                                        |
| ---------------------------------- | ------------------------------------------------------ |
| Seeded Atlanta UUID                | 200, UUID-only town and `pending`                      |
| Synthetic nonseed public town      | 200, UUID-only town and `pending`                      |
| Private, wrong scope, missing UUID | 404 each                                               |
| Malformed UUID; longitude 181      | 400 each                                               |
| Valid point for seeded town        | 200, `pending`                                         |
| Social stopped                     | 503 `Social unavailable`; after restart, 200 recovered |
| Directory stopped                  | 503 `Directory unavailable`                            |

Both public towns had no directory mapping inserted. Thus these results show the current missing-mapping path returns pending; they do not prove reconciliation, geometry validation, or readiness for actual boundaries. Current directory server intentionally returns pending after a successful database query and does not expose stored invalid geometry through this endpoint. **An invalid stored geometry state was not exercised**; invalid point input above is a separate test. No production seed data, provider acquisition calls, POC imports, or paid operations were used.

## Execution and cleanup

The first offline Social build failed because Alpine packages were absent from cache; a normal dependency-download build succeeded. A Social builder build reached its 90-second timeout while exporting; Docker nevertheless recorded the image, and its required migration tooling was checked before use. The first complete stack attempt used only an internal network, so Docker did not publish the requested host port; a request from inside the gateway container did return seeded-town 200 pending. The second attempt added a separate ingress network and produced the matrix above (script exit 0). Nx migration targets succeeded, with Nx Cloud DNS warnings in the isolated network.

Commands and output were captured locally in `/tmp/s2isolated-roundtrip.sh`, `/tmp/s2isolated-roundtrip2.log`, and `/tmp/s2isolated-*-build*.log`; these temporary files are not durable checked-in artifacts. The script's exit trap removed its uniquely named containers and networks. A subsequent Docker listing found no `s2iso-` containers or networks. Test images and Docker build cache remain. No shared services were stopped or changed.

Remaining evidence: invalid stored-geometry handling, actual ready/boundary behavior, direct-port and IP isolation across relevant networks and production ingress, and a reproducible pinned source snapshot for the runtime images. The results are not proof of deployment security or complete S2 acceptance.
