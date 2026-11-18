# S9b backup / restore / verify drill (2026-11-17)

Tools: `scripts/directory-backup.sh`, `scripts/directory-restore.sh`, `scripts/directory-restore-verify.cjs`
(helpers in `scripts/directory-backup-lib.cjs`, unit tests in `scripts/directory-backup-manifest.test.mjs`).
The live stack was only read. Backup root: `~/.cache/optimistic-tanuki/directory-backups/s9-drill`
(outside the repo, files 0600, directory 0700). No connection strings or passwords appear below.

## 1. Backup (live stack, read-only)

```
$ scripts/directory-backup.sh --out ~/.cache/optimistic-tanuki/directory-backups/s9-drill
dumping ot_directory
dumping ot_directory_census_stage
archiving export volume
backup complete in 7s: ~/.cache/optimistic-tanuki/directory-backups/s9-drill
```

| Artifact                         | Bytes      | Notes                                                                       |
| -------------------------------- | ---------- | --------------------------------------------------------------------------- |
| `ot_directory.dump`              | 35,790,430 | head migration `DirectoryExports1794969950698`, 58 tables counted           |
| `ot_directory_census_stage.dump` | 25,319,958 | head migration `DirectoryFoundation1794937486351`, 41 tables counted        |
| `exports.tar`                    | 1,536      | volume `optimistic-tanuki_directory_exports`, 0 files (empty at drill time) |
| `manifest.json`                  | 5,611      | sha256 + size per file, row counts, provider budget totals                  |

Wall time 6.8 s. Dump and counts share one exported REPEATABLE READ snapshot (`pg_dump --snapshot`), so the
manifest counts describe exactly the dumped state. Provider budget ledger at backup: 1224 attempts, 1224 reserved cents
(`ot_directory`).

## 2. Restore into scratch

```
$ scripts/directory-restore.sh <backup> --target-db s9_scratch_restore --source-db ot_directory --exports-dir ~/.cache/optimistic-tanuki/s9-scratch-exports
FENCE REQUIREMENT: ... (see docs/plans/town-square-directory/S3-restore-fencing.md). Scratch targets are not fenced.
verifying backup checksums
restoring ot_directory into s9_scratch_restore
database restored in 4s
export artifacts extracted
```

Total 5.1 s.

## 3. Verify

`node scripts/directory-restore-verify.cjs <backup> --db-url-env <VAR> --source-db ot_directory --exports-dir <dir>`

Result `ok: true`, exit 0, 0.24 s: rowCounts (58 tables) match; latestMigration matches; exportArtifacts 0 live jobs
(the only jobs are 2 `failed`); providerBudget 1224 / 1224 equal; receiptSlots 0 receipts, 0 slots, no orphans;
exportJobs no incomplete rows, no orphan downloads.

### Proof the checks can fail (scratch DB only)

| Mutation                                               | Result                                                            |
| ------------------------------------------------------ | ----------------------------------------------------------------- |
| extra `directory_provider_budget_attempt` row          | exit 1, `rowCounts` and `providerBudget` fail                     |
| complete export job + matching artifact file           | `exportArtifacts` ok (1 live job)                                 |
| same job, artifact bytes appended                      | `exportArtifacts` fails: sha256 mismatch                          |
| same job, artifact file deleted                        | `exportArtifacts` fails: artifact missing                         |
| copy of backup with `exports.tar` modified             | restore aborts before any database work: size and sha256 mismatch |
| restore into existing scratch name without `--replace` | refused                                                           |

(The extra job row also trips `rowCounts`, as expected.)

## 4. Live-target refusal

```
$ scripts/directory-restore.sh <backup> --target-db ot_directory
refusing to restore into live database ot_directory without --live
$ scripts/directory-restore.sh <backup> --target-db ot_directory_census_stage --live
fence not in place: optimistic-tanuki-directory-1, optimistic-tanuki-directory-worker-1 still running; stop all directory serving and workers first
```

`--live` was never exercised past the guard.

## 5. Cleanup

`s9_scratch_restore` dropped, scratch exports directory removed. Live databases were not modified.
A pre-existing `s9_scratch_ctl` database (not created by this drill) was left alone.

## Gaps

- No complete export jobs or artifacts exist live, so the artifact check was proven only with a synthetic job in scratch.
- Receipt tables are empty live; the receipt/slot invariants are structural (orphans, shared slots, receipts <= slots).
- A restore does not rotate recovery epochs or complete the S3 recovery workflow; operators must still fence per S3.
- Backups are unencrypted; protect the backup root.
