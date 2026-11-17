# S1 candidate ACL workload — isolated evidence

**2026-11-04.** This is one local acceptance check, not acceptance of S1 as a whole or production deployment approval. The working tree contained untracked directory application sources at checkout `6a472b41f957500ccbd987457818ffdc85b1663f`; this checkout ID does not capture those sources. SHA-256: `apps/directory-worker/src/queue.ts` `4d4e33d2836c48aa3c5ffcb236457ebbf3d79cf2d860f99a6dc5a32b140d03c0`, `src/worker.ts` `68da10236c4cd5fca7c698f56b55a2a1eb9d7faae96d7af08dbf0e95719fae1f`, and `apps/directory/src/server.ts` `d7aa56ff4c0de1b30a170b7cfff9d458086ba3d4118951185f3b89a1370a2f00`.

The test `apps/directory-worker/test/s1-acl-workload.test.js` starts a uniquely named disposable `redis:alpine` container (image `sha256:15f5a4aad4c3ba34b9874ddbc7f755b469dbd7b8a9e88c12690c52ef6c72465c`, Redis 8.10.2), binds an ephemeral port to loopback, and generates a temporary credential. The default Redis user is disabled; the candidate user has exactly the S1 candidate permissions: its single `<prefix>:jobs-v3` key, `PING`, `CLIENT SETINFO`, `EVAL`, `HGET`, `HLEN`, `HEXISTS`, `HGETALL`, `HSET`, and `HDEL`. Redis uses AOF with `appendfsync always`. No shared stack, user credentials, provider calls, imports, paid operations, or production data were involved.

The narrow command, run directly because the Nx test target runs all worker test files and requires additional Redis fixtures, was:

```sh
timeout 75s env TS_NODE_PROJECT=apps/directory-worker/tsconfig.json node -r ts-node/register/transpile-only --test apps/directory-worker/test/s1-acl-workload.test.js
```

The rerun passed **1/1** (TAP, 0 failures; `/tmp/s1-acl-workload-rerun.log` is ephemeral). Under the candidate ACL, the current-source queue successfully enqueued, claimed, failed and retried a job on attempt 2, completed it, and read the completed state. The current-source `consumeOnce` worker processed another job to completion. Direct `HGET` on a foreign key, `CONFIG GET`, and `GET` on the queue key each returned `NOPERM`; `PING` succeeded.

The current-source readiness HTTP server, wired to the real queue readiness check, returned **200** before the test stopped Redis and **503** while Redis was stopped. After restarting that same container, the test created a fresh queue connection, returned **200**, confirmed the completed job persisted, and enqueued and processed another job. This is a clean container stop/start with AOF, not a power-loss test. The readiness server here has only the queue check: it is not the full worker process, database readiness, actual ingress, or proof that an existing worker automatically reconnects. The queue source configures `reconnectStrategy: false`; this test explicitly replaces its connection and does not establish automatic worker recovery or orchestration restart behavior.

The initial run passed the workload and stopped-Redis assertions but failed its recovery assertion because Docker assigned a different published host port on restart; the test was corrected to rediscover that port. The test's `finally` removed its containers and temporary ACL directories; a subsequent Docker listing found no `s1acl-` containers. Redis image has no declared anonymous volume. No existing evidence files or production source were changed by this check.

The real gateway's previously observed missing routes remain **404**, not authorization evidence. Production ACL review, real gateway/ingress and any operator authorization, full dependency and process recovery, backup/restore and broader S1 acceptance remain separate gates; see `S1-isolated-stack.md` for their context.
