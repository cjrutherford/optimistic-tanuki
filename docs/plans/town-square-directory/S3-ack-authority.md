# S3 Social ACK authority: operator-fenced handoff

This is a bounded, manual trust boundary. Before either Social or Directory is restored or failed over, an authorized operator must externally stop and fence all serving processes and workers in both systems. The operator must independently verify the identity of the current Directory checkpoint and obtain its source and recovery epochs from the trusted operator channel. Neither Social nor the CLI detects an independent restore; a restored database can contain a stale, apparently valid binding. The external fence must remain in force until a separately implemented and authorized full recovery process permits resumption. If any precondition is uncertain, keep everything stopped.

Directory checkpoint initialization now atomically changes all existing town geometry statuses to `pending`. This is a precaution, not a recovery pass or proof that writers are fenced. The authenticated Social census and snapshot reads currently reject a fenced source epoch, so they cannot yet traverse the bound checkpoint. The Social fence also does not establish that direct database writers and every other writer are inactive. Do not mark recovery complete or enable startup or acknowledgements until a recovery-only read path, durable traversal, and independently verified writer fencing are implemented and reviewed.

With the Social connection configured, the operator first fences its existing singleton using `source-epoch-operator.ts fence --confirm-external-fence`, then invokes from `apps/social`:

```sh
TS_NODE_PROJECT=tsconfig.app.json node -r ts-node/register -r tsconfig-paths/register src/source-epoch-operator.ts bind --confirm-external-fence-and-verified-checkpoint <sourceEpoch> <directoryRecoveryEpoch>
```

The flag records an operator assertion; it does not verify the fence or checkpoint. The two values must come from the independently verified Directory checkpoint, not a network caller. Binding locks the Social singleton, requires it to be fenced, rejects malformed, zero or currently reused epoch values and legacy null-source events, and leaves it fenced. The current source rotation clears the recovery binding. There is no network binding endpoint. Database/operator access is privileged and must be controlled externally. Locks serialize Social operations only; they do not fence Directory or a restore. The current-pair check is not a historical replay registry; freshness across restores depends on the external operator procedure.

The transactional ACK primitive locks the singleton, fails closed for missing or fenced authority, verifies the v2 HMAC and both stored epochs, and locks and deletes only the exact event tuple. It is not connected to the ACK RPC, which remains fenced. No implementation here authorizes unfencing or claims completed reconciliation, restore detection, cross-database recovery, or S3 acceptance. Existing v1 receipts cannot authorize this path.
