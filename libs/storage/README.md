# Storage

`storage` contains shared storage-related utilities and abstractions. Its source lives under `libs/storage/src/lib`.

## Repo Role

- reusable storage helpers for backend services
- shared infrastructure layer rather than end-user UI

## Vault storage (regulated tax documents)

Every object written through `LocalStorageAdapter` or `NetworkStorageAdapter` is sealed in an
AES-256-GCM envelope before it reaches disk or S3. Both adapters decrypt on read and refuse to
return anything that is not an authenticated envelope.

### Envelope format

```
OTENV1:{"alg":"AES-256-GCM","v":1,"kid":"kek-sha256-<16 hex>","iv":"<b64 12B>",
        "tag":"<b64 16B>","dek":"<b64 32B>","dekIv":"<b64 12B>","dekTag":"<b64 16B>",
        "aad":"<b64 caller associated data>"}\n<raw AES-256-GCM ciphertext bytes>
```

- `dek` is a random per-object 32-byte data key, itself wrapped with AES-256-GCM under the KEK
  (`dekIv`/`dekTag`).
- The KEK is `sha256(VAULT_STORAGE_KEK)`; it is never checked in and never defaulted.
- `aad` carries `{formType, handling, originalName}` and is covered by the canonical associated
  data string, so rewriting the classification in the header breaks authentication.

### Tax classification

`TaxDocumentClassifierService` routes US tax documents (Form 1040, W-2, 1099) to `TAX_STRICT`
handling using filename patterns plus content markers over the first 256 KiB. Tax-classified
objects are owner-only on disk (`0600`, directory `0700`), are always encrypted, and record the
classification in the S3 object metadata. A declared `image/*`, `video/*` or `audio/*` type that
contradicts a tax-form content signature is rejected rather than stored.

### S3 Object Lock

`S3Service` sends `ObjectLockMode`, `ObjectLockRetainUntilDate` and `ObjectLockLegalHoldStatus`.
Object Lock is only honoured when the bucket reports both versioning and Object Lock enabled;
otherwise the upload is denied. `enableBucketVersioning()` is available for operators, and S3
Object Lock must be enabled at bucket creation time.

### ZFS awareness

`ZfsStorageService` reports the real filesystem behind the local storage path, resolves the
enclosing ZFS dataset and pool from `zfs list`, and never claims a dataset or a snapshot that does
not exist. No snapshot is ever created by a write.

## Required environment

| Variable                                       | Required                    | Purpose                                                                                              |
| ---------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------- |
| `VAULT_STORAGE_KEK`                            | yes for any read or write   | Key encryption key for envelope encryption; absent means fail closed                                 |
| `VAULT_STORAGE_KEK_ID`                         | no                          | Label recorded in the envelope `kid` instead of the derived fingerprint                              |
| `VAULT_STORAGE_S3_ENDPOINT`                    | no                          | Defaults to `http://localhost:9000` for local development; set `https://s3.wasabisys.com` for Wasabi |
| `VAULT_STORAGE_S3_REGION`                      | no                          | Defaults to `us-east-1`                                                                              |
| `VAULT_STORAGE_S3_ACCESS_KEY_ID`               | yes for the network adapter | Never defaulted                                                                                      |
| `VAULT_STORAGE_S3_SECRET_ACCESS_KEY`           | yes for the network adapter | Never defaulted                                                                                      |
| `VAULT_STORAGE_S3_BUCKET`                      | yes for the network adapter | Never defaulted                                                                                      |
| `VAULT_STORAGE_OBJECT_LOCK_MODE`               | no                          | `GOVERNANCE` or `COMPLIANCE`                                                                         |
| `VAULT_STORAGE_OBJECT_LOCK_RETAIN_DAYS`        | no                          | Positive number of days to retain                                                                    |
| `VAULT_STORAGE_OBJECT_LOCK_LEGAL_HOLD`         | no                          | `ON` or `OFF`                                                                                        |
| `VAULT_STORAGE_OBJECT_LOCK_REQUIRE_VERSIONING` | no                          | Set to `false` only to skip the readiness probe                                                      |
| `VAULT_STORAGE_ZFS_REQUIRED`                   | no                          | `1` denies local writes when the target is not a ZFS dataset                                         |
| `CLAMAV_HOST`                                  | yes for virus scanning      | Unset means file processing is denied; there is no local default host                                |
| `CLAMAV_PORT`                                  | no                          | Defaults to `3310`                                                                                   |
| `CLAMAV_SOCKET_TIMEOUT_MS`                     | no                          | Defaults to `3000`                                                                                   |
| `CLAMAV_SCAN_DEADLINE_MS`                      | no                          | Defaults to `30000`                                                                                  |
| `VAULT_STORAGE_CLAMAV_MAX_SCAN_BYTES`          | no                          | Defaults to 25 MiB                                                                                   |

## Nx Commands

```bash
pnpm exec nx build storage
pnpm exec nx test storage
```
