# S3 final local checks — incomplete

2026-11-04. This is partial local evidence, not S3 acceptance. No provider, POC data, paid operation, publication, application source edit, or shared-stack change was made.

## Results

| Requested check | Result |
| --- | --- |
| Seeded town privacy via owning write API, reconciliation, receipt and gateway transition | **NOT RUN.** No claim is made for the seeded town or the current gateway path. The earlier `S3-live-evidence.md` covers a different, nonseed town and an earlier source snapshot. |
| External Directory database delayed readiness | **PARTIAL / automatic startup not established.** A current-source Directory builder and isolated Compose network were used. Running the real Directory migration command before starting its configured database exited 1 with `Connection terminated due to connection timeout`. After starting a disposable PostGIS database and waiting for `pg_isready`, manually rerunning the same migration exited 0 and recorded four migrations. This tests operator retry after initially absent database, not a database becoming ready while the full main stack starts, and does not show automatic retry or service readiness. |
| Non-directory profile | **PARTIAL / runtime not tested.** Main plus development Compose configuration without a profile rendered 58 services, included gateway, excluded directory and social-directory-migrate services, and Social depended on db-setup and postgres. No comparison against an earlier revision or application startup was performed. |
| Concurrent workers, restart, late commit | **NOT RUN.** Prior evidence is not substituted for these checks against the current source. |

## Reproduction and boundaries

Checkout HEAD was `6a472b41f957500ccbd987457818ffdc85b1663f` with substantial uncommitted and untracked changes. Docker server 29.1.2, Compose v5.0.0. The build copied the current checkout rather than a frozen source context. A 3,837-file sorted source manifest made during the build is `/tmp/s3-final-source.sha256`, SHA-256 `048602d89ba06f7d04ae15125c05737f01eef4bcab33c6604e7747e8ec317b25`; all listed files matched again after the run. It covers the selected application, library, workspace and Compose paths only, was captured after the build copy, and does not rule out transient edits or identify every build input.

- `timeout --kill-after=10s 600s /tmp/s3-final-local-run.sh > /tmp/s3-final-local-run.log 2>&1` exited 0. The script used `apps/directory/compose.yaml` plus `/tmp/s3-final-local-override.yaml`, isolated project `s3final17938275261655250`, and `docker compose ... run --no-deps --rm directory-migrate`. The override provided a disposable database and a dummy Social service solely to satisfy Compose configuration; it did not start Social. The project network was internal, no ports were published, and test credentials were disposable. The first attempt at the script failed Compose validation because Social was undefined; adding the dummy service preceded the successful run. Build log `/tmp/s3-final-local-build.log`; migration logs `/tmp/s3-final-local-first.log` and `/tmp/s3-final-local-second.log`; run log `/tmp/s3-final-local-run.log`.
- Script SHA-256 `8802742ee3ac1638dd41a7c5dfc9d7cb4b6ded11cbc8b08f320a1539e6d20ecb`; override SHA-256 `a7121c9349b00c1563cb82870cb116b15d26311a16de0deb96bcb1676feeeac6`. Builder image ID was `sha256:0aaf91370f45e7bd321dd877ba6728339b2937f7a556df9c7fdabf11254181f6`; it was removed by the cleanup trap. Build cache and temporary files remain.
- `timeout 30s docker compose -f docker-compose.yaml -f docker-compose.dev.yaml config --format json` rendered the non-directory configuration; `/tmp/s3-final-no-profile.json` contains the rendered result.
- The trap ran `docker compose ... down --volumes --remove-orphans` for the unique project and removed its named builder image. Subsequent project-label container and network queries returned no entries. No other resources were stopped or removed.

These results leave full Compose startup ordering with an external delayed database, automatic recovery, seeded write-to-gateway privacy, non-directory runtime behavior, and concurrent/restart/late-commit behavior as explicit gaps.
