# S3 Social server restart and isolated restore — 2026-11-05

## Runtime restart

Built Social with `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm nx run social:build:development`. A temporary copy of the resulting app and YAML configuration listened on a dedicated TCP port, using a newly migrated disposable PostGIS 17 Social database and `SOCIAL_DIRECTORY_MODE=register-only`. The operator CLI performed `begin-recovery`, `initialize-register`, and `enable-register-capture` with the external-fence assertion before the server was started. The test used synthetic data and no Directory server.

A Nest TCP `CREATE_COMMUNITY` request created a public Local Hub town. The actual Social server process was terminated and restarted using the same database. A synthetic legacy outbox row was present at the configured cap of one before the second process handled `UPDATE_COMMUNITY` to make the town private. The response succeeded; a database query verified `isPrivate=true`, a changed dirty register token, and exactly one unchanged legacy event. This uses the real built server, Nest TCP transport, datasource and Social service. It does not use Gateway, Directory, Redis, a containerized Social image, or a real external production fence.

## Social-only restore exercise

While the Social server was stopped, a custom-format `pg_dump` snapshot was taken before the privacy update and restored with `pg_restore --exit-on-error` into a separate disposable Social database. Inspection **before any restored server or writer was allowed to run** showed the restored row still had `fenced=false`, `phase=capture-only`, and a baseline matching its source epoch. The restored community was public: the later privacy change was absent. This demonstrates that the local marker and phase do not detect a restored snapshot and that changes newer than the backup are not recovered by this procedure.

With processes stopped and the external-fence condition controlled by the fixture, the operator commands rotated the restored source epoch, rebuilt/verified the baseline and explicitly re-enabled capture. The legacy event count remained one. A second `begin-recovery` was inspected separately: it set the authority to fenced and cleared the baseline marker. A temporarily started Social server in register-only mode rejected a `CREATE_COMMUNITY` request in that state, and the database contained no matching community; it was then stopped. This limited test deliberately starts the server only to verify the database fence and is not a production recovery procedure.

A new Social process must not be started on a restored database before an external operator fence, authority rotation and appropriate reconciliation; the old snapshot can appear writable. Restoring Social also rolls its authoritative data back to the backup point. This experiment does not restore Directory, verify two-store reconciliation, recover later Social changes, prove external credential revocation or control direct writers, or establish end-to-end S3 acceptance. Directory startup and ACK remain fenced.

## Cleanup

Only the dedicated temporary Social processes, copied config/build files and disposable PostGIS container/database were used. The temporary processes and container were stopped after verification. No real user data or provider access was involved.
