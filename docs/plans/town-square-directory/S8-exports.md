# S8 — Export and portability

Status: implemented, deployed and verified locally on 2026-11-17. Evidence is in §7.

Scope: operator export from the Owner Console. Public self-service export is a
separate product decision and is not built here.

## 1. Rules

1. **Independent export grant.** A row is exported only when
   `evaluateOvertureFieldRights(row, 'export', policy).eligible` is true for the
   job's release. `publicDisplay` or `privateDisplay` approval never enables
   export. The policy is the trusted file `DIRECTORY_RIGHTS_POLICY_FILE`, which
   is the same artifact rights sync reads. With no policy for the release, or no
   `operations.export: true`, the job **fails** with `export_not_granted` before
   reading rows. No artifact is written.
2. **Field allowlist.** The artifact only ever carries these keys, each one
   only when its rights field is `eligible`:

   | Export key | Listing key | Rights fields that must be eligible      |
   | ---------- | ----------- | ---------------------------------------- |
   | `name`     | `name`      | `name`                                   |
   | `category` | `category`  | `basic_category`, `primary`, `hierarchy` |
   | `location` | `location`  | `geometry`                               |
   | `address`  | `address`   | `address`                                |
   | `phone`    | `phone`     | `phone`                                  |
   | `website`  | `website`   | `website`                                |

   No other listing key is copied: `assignmentChangeToken`, raw `sources`,
   ids and confidence are all dropped. A row whose required fields (`name`,
   `category`, `location`) are not all eligible is left out and counted in
   `excludedRows`.

3. **Non-exportable providers.** A field whose lineage includes any source
   from a non-exportable provider is denied, whatever other sources supplied
   it. A source counts as non-exportable when its `provider` or `dataset`
   matches `/geoapify/i`. The denial still applies when the row is a merge and
   the policy grants every other source.
4. **Adult and excluded rows.** Rows with `listing.adult === true` are left
   out and counted in `excludedRows`.
5. **Provenance.** Each exported row carries a per-field
   `provenance: {<key>: {datasets: [{dataset, license}], attributions, termsUrls, notices}}`.
   This comes from the rights evaluation of that field. The header line
   carries the union of attributions, terms URLs and notices.
6. **Failure is a status.** A job is `complete` only when the file has been
   written, `fsync`ed, renamed into place, and its SHA-256 and byte count
   recorded. A job with zero exported rows fails with `no_eligible_rows`, and
   no file is written. A partial file is deleted when the job fails.
7. **Retention.** A complete artifact expires `DIRECTORY_EXPORT_RETENTION_HOURS`
   after completion; the default is 24. The worker's sweep then marks the job
   `expired` and deletes the file. A download after expiry returns 410.
8. **Withdrawal.** When a withdrawal request completes, every `complete` job
   whose `scanIds` intersect the withdrawn scans becomes `withdrawn` and its
   file is deleted. This covers all withdrawal kinds:

   - `scan` withdraws jobs that contain that scan.
   - `policy` withdraws jobs that contain the scans that are members of that
     policy.
   - `row` withdraws jobs that contain that row's scan. We are conservative
     here and do not rewrite artifacts.

   A download of a withdrawn job returns 410.

9. **Authorization.** Gateway routes require `AuthGuard`,
   `DirectoryOwnerScopeGuard`, `PermissionsGuard` and
   `@RequirePermissions(DIRECTORY_PERMISSIONS.export)`. The
   `directory.export` permission is seeded to `owner_console_owner`, `owner`,
   `global_admin` and `system_admin`. Every download is audited in
   `directory_export_download` with the actor, the time and the outcome. That
   includes refused downloads.

## 2. Data

Both tables are TypeORM entities. The migration is generated, never written by hand.

`directory_export_job`:

- Identity and request:
  - `id` uuid PK: the client idempotency id.
  - `actorId` uuid.
  - `releaseId` varchar(100).
  - `scope` jsonb: `{}` or `{communityId}`.
  - `format`: `'jsonl'`.
  - `requestHash` char(64): the SHA-256 of the canonical request. A replay
    with the same id and a different hash returns 409 `idempotency_mismatch`.
- Lifecycle:
  - `status`: one of `queued`, `running`, `complete`, `failed`, `expired`,
    `withdrawn`. This is a CHECK constraint.
  - `attempts` int.
  - `leaseToken` uuid null.
  - `leaseExpiresAt` timestamptz null.
  - `errorCode` varchar(64) null.
- Results:
  - `rowCount`, `excludedRows` int.
  - `byteCount` bigint.
  - `sha256` char(64) null.
  - `artifactName` varchar(200) null.
  - `schemaVersion`.
  - `scanIds` jsonb: the array of scan ids read.
- Timestamps: `expiresAt`, `completedAt`, `withdrawnAt`, `createdAt` and `updatedAt`.
- Index on (`status`, `updatedAt`).

`directory_export_download`:

- `id` uuid PK.
- `jobId` uuid.
- `actorId` uuid.
- `outcome` varchar(16), one of `served`, `not_ready`, `expired`, `withdrawn`,
  `integrity_failed`. This is a CHECK constraint.
- `createdAt`.

## 3. Worker

`startExportWorker(db, {dir, intervalMs, pageSize})` runs in-process in the
Directory runtime, as `startWithdrawalWorker` does.

1. **Claim.** One `queued` job, or a `running` job whose lease has expired,
   using `FOR UPDATE SKIP LOCKED`. The lease lasts 120 s and is renewed every
   page.
2. **Read.** Rows come from the served set: non-revoked policy, completion, no
   scan revocation and no row revocation. Reading goes one scan at a time, then
   keyset-paged on `sourceFileRowNumber`, with a page size of 1000 by default.
   This keeps every query under the pool's 3 s `query_timeout`. The row's
   `releaseId` is the job's `releaseId`, and rights sync uses the same
   convention.
3. **Write.** Output goes to `<dir>/<id>.jsonl.partial`, then is renamed to
   `<dir>/<id>.jsonl`.
4. **Retry.** Up to 3 attempts for retryable errors, which are I/O and DB
   timeouts. `export_not_granted`, `no_eligible_rows` and
   `serialization_failed` are terminal.
5. **Sweep.** Each tick also expires complete jobs past `expiresAt`.

## 4. Artifact (schema `town-square-directory-export/v1`)

The artifact is JSONL. Line 1 is the header:

```
{"type":"header","schema":"town-square-directory-export/v1","jobId","releaseId","generatedAt","policyVersion","fields":[...],"attributions":[...],"termsUrls":[...],"notices":[...]}
```

Each row line has the form:

```
{"type":"row","key":"<sha256(scanId|row) first 32 hex>","name",..,"provenance":{...}}
```

The last line is the trailer:

```
{"type":"trailer","rowCount","excludedRows"}
```

The JSON Schema is in `apps/directory/src/export-schema.json`, and the tests
validate every line against it.

## 5. Internal routes (Directory, local-evaluation bearer)

| Method | Path                                            | Body or query                            | Result                                                                                                                                      |
| ------ | ----------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| POST   | `/internal/exports`                             | `{id, actorId, releaseId, communityId?}` | 200 job (new or replay), 409 `idempotency_mismatch`                                                                                         |
| GET    | `/internal/exports`                             | `status, limit, offset`                  | `{items, total}`                                                                                                                            |
| GET    | `/internal/exports/:id`                         |                                          | job, or 404                                                                                                                                 |
| POST   | `/internal/exports/:id/retry`                   | `{actorId}`                              | `failed` becomes `queued`; anything else is 409 `invalid_state`                                                                             |
| GET    | `/internal/exports/:id/artifact?actorId=<uuid>` |                                          | 200 stream with `content-type: application/x-ndjson`, `x-content-sha256` and `content-disposition`; 409 not ready; 410 expired or withdrawn |

The download verifies the file's SHA-256 against the job before it sends a
single byte. A mismatch returns 503 and records `integrity_failed`.

A job's JSON never includes the filesystem path.

## 6. Gateway and Owner Console

The gateway controller is `directory/exports` and mirrors these routes. It
streams the artifact through.

The page is `/dashboard/directory-exports`:

- A request form takes the release id and an optional community id.
- A job table shows status, rows, excluded rows, size, SHA-256, expiry and the error code.
- Download and Retry actions.
- An empty state.

The page also has an operator workspace tile.

## 7. Evidence

### 7.1 What was built

- **Directory**:
  - `apps/directory/src/export-job.ts` holds the projection, job lifecycle, worker, expiry sweep, withdrawal hook and verified download.
  - `export-routes.ts` holds the internal routes, wired in `register-pending-runtime.ts`.
  - `export-schema.json` is the artifact schema.
  - The two entities have the generated migration `1794969950698-DirectoryExports.ts`. It only creates the two tables. The generator also emitted 52 `SET DEFAULT gen_random_uuid()` statements for existing tables. That drift predates this slice, so those statements were trimmed and left out.
  - `apps/directory/compose.yaml` and the Dockerfile add a `directory_exports` volume at `/var/lib/directory/exports`.
  - A completed withdrawal now withdraws the export jobs it touches, in the same transaction, and deletes their files after commit.
  - Without `DIRECTORY_EXPORT_DIR`, create, retry and download return 503 and the worker does not start.
- **Gateway**: `directory-exports.controller.ts` under `directory/exports`. It only forwards an artifact whose `x-content-sha256` is a valid 64-hex value, and it streams the body. The new routes are in the scope matrix and no-store specs.
- **Permission**: `directory.export` is in `default-permissions.json` for the four owner roles. The live seed was re-run in `ot_permissions`.
- **Owner Console**: `/dashboard/directory-exports` has a request form, job cards, download, retry, polling while a job is queued or running, and a workspace tile.
- **Job JSON**: it never carries the file path, lease token or full scan list. It reports `scanCount` instead.

### 7.2 Tests

| Suite                                                                                                 | Result                   |
| ----------------------------------------------------------------------------------------------------- | ------------------------ |
| `apps/directory/test/exports.postgres.test.js` and `export-job.test.js`, on scratch DB `s8_scratch_*` | 8 of 8 pass              |
| `rights-withdrawal.postgres.test.js` (withdrawal now touches exports)                                 | 1 of 1 pass              |
| `account-lifecycle` unit and Postgres suites (the new tables are classified)                          | 11 of 11 and 4 of 4 pass |
| `nx test gateway`                                                                                     | 2302 pass                |
| `nx test permissions`                                                                                 | 135 pass                 |
| `nx test owner-console`                                                                               | 752 pass                 |
| Builds of directory, gateway and owner-console                                                        | pass                     |
| Personality audit                                                                                     | no new literals          |

The Postgres integration test proves every acceptance item that needs a grant. A test policy grants `export` on the scratch DB only. Each item and how it is shown:

- **Request to artifact:** a queued job runs through to a complete JSONL file.
- **Pagination:** a page size of 2 over two scans, so the run crosses several pages.
- **Idempotency:** a replay of the same id returns the stored job, and a mismatched replay returns 409.
- **Retry:** an injected I/O failure leaves the job retrying, and it then completes.
- **Checksum:** the SHA-256 and byte count match the file.
- **Schema:** every line validates against `export-schema.json`.
- **Failure leaves no file:**
  - with no grant, the job fails with `export_not_granted`;
  - with zero eligible rows, it fails with `no_eligible_rows`.
- **Download before completion:** returns `not_ready`.
- **Expiry:** the sweep marks the job `expired` and deletes the file; a download then returns 410.
- **Scan withdrawal:** the job becomes `withdrawn` and the file is deleted; a download returns 410.
- **Tampering:** a tampered file returns 503 with `integrity_failed`, before any byte is sent.
- **Audit:** download audit rows exist for every outcome.
- **Geoapify:** in a merged phone field, a Geoapify source denies the field.

### 7.3 Sanitized artifact and allow/deny examples

[`s8-evidence/sample-artifact.jsonl`](s8-evidence/sample-artifact.jsonl) is the artifact from the scratch run. Every value in it is synthetic. It shows:

- the header with schema, fields, attributions, terms and notices;
- four rows with per-field provenance;
- the trailer: `rowCount 4`, `excludedRows 2`.

Allow and deny examples, by source and field:

| Row                          | Field                                        | Lineage                      | Result                                                        |
| ---------------------------- | -------------------------------------------- | ---------------------------- | ------------------------------------------------------------- |
| A One                        | phone                                        | meta, granted                | exported                                                      |
| B Two                        | phone                                        | meta, granted, plus Geoapify | **denied**: the field is absent and the row is still exported |
| any                          | `assignmentChangeToken`, raw `sources`, `id` | not allowlisted              | never copied                                                  |
| adult row                    | all                                          | `listing.adult = true`       | row excluded and counted                                      |
| row missing a required grant | name, category or location                   | not eligible                 | row excluded and counted                                      |

### 7.4 Live stack (2026-11-17)

- **Backup**: `ot_directory` was dumped with `pg_dump -Fc` (35.8 MB) to `/tmp/claude-1000/s8-backup-202611172149/ot_directory.dump`.
- **Rollback tags**: `:pre-s8` on the directory, directory-worker, gateway, owner-console and permissions images.
- **Deploy**: migration `DirectoryExports1794969950698` applied through `directory-migrate`. Directory, permissions, gateway and owner-console were recreated from a clean shell and all came up healthy. The export volume is owned by `node`.
- **Evidence**: `apps/local-hub-e2e/src/s8-exports-evidence.spec.ts` passed 3 of 3. The outcome is in [`s8-evidence/s8-live-outcome.json`](s8-evidence/s8-live-outcome.json).
  1. **Authorization.** Anonymous list and download return 401. The owner list returns 200 with `cache-control: no-store`. A download of an unknown id returns 404.
  2. **UI request for release `2026-10-21.0`.** The job is queued and then fails with `export_not_granted`. It has no SHA-256 and 0 rows. The card says "No export grant for this release. Public display approval does not allow export." and offers no Download button. A download returns 409 `not_ready` and is audited. Screenshots: `s8-01-not-granted-desktop.jpg` and `s8-02-not-granted-mobile.jpg`. Axe found no serious or critical issues and the page has no horizontal overflow.
  3. **Idempotency and retry.** A replay of the same id returns the same job, and a mismatched release returns 409 `idempotency_mismatch`. Retry requeues the job and it fails again for the same reason. A retry of an unknown id returns 404.
- **After the run**: `/var/lib/directory/exports` is empty. The DB holds 2 jobs, both `failed`/`export_not_granted`, and 1 `not_ready` download audit row. These failed job records are inert and are kept as the audit trail.

### 7.5 Open items

- **Export grant**: this is an owner decision. The live stack exports nothing until a policy for the release sets `operations.export: true`, and each source term lists `export` fields, in `DIRECTORY_RIGHTS_POLICY_FILE`. The six open rights cases for `2026-10-21.0` must be decided first.
- **Withdrawal granularity**: rights `exclude_field` decisions do not yet revoke existing artifacts. Only completed withdrawals do. Artifacts expire within 24 h in any case.
- **Public self-service export**: a separate product decision, not built.
