# Directory account lifecycle: blocked rows

Erasing an account in Directory refuses to change anything while a row carries
one of the account's identifiers in a domain Directory cannot confirm (see
`docs/plans/town-square-directory/S5-account-lifecycle-design.md`, "Ambiguity
rules"). This report shows how many such rows exist and where.

```
DIRECTORY_REVIEW_DATABASE_URL=postgres://... \
  node scripts/local-directory-account-lifecycle-blocked.cjs \
  --account <account-uuid> [--profile <profile-uuid>]... [--legacy <uuid>]...
```

- Read-only. It runs in a `READ ONLY` transaction that is always rolled back and
  does not install a deletion fence.
- Output is JSON with counts per table and column only: `erasable` rows (erased
  in their own domain), and `blocking` rows grouped by which kind of identifier
  matched (`account`, `profile`, `legacy`) and the row's recorded domain
  (`unset` for legacy link events with no `actorDomain`). It never prints row
  contents, identifiers or connection details.
- `remaining` and `blocked` equal the totals the erase readback reports.
- Resolve blocking rows by recording the missing domain or removing the stray
  reference, then retry the same erase operation. Reviewer write paths (boundary
  and address-review decisions and publication) refuse a fenced reviewer with
  `ACCOUNT_DELETION_FENCED`.

Test: `directory:test-account-lifecycle-postgres` (needs
`S5_LIFECYCLE_DISPOSABLE=yes` and a disposable `S5_LIFECYCLE_TEST_DATABASE_URL`).

## Enabling the lifecycle routes

Directory serves the deletion and export routes only when
`DIRECTORY_ACCOUNT_DELETION_SECRET` is set (at least 32 printable bytes, different
from Directory's other secrets). Unset, the routes return 404 and Authentication
treats Directory as unavailable, so deletions and exports block instead of skipping it.

| Where          | Variable                                  | Notes                                                                      |
| -------------- | ----------------------------------------- | -------------------------------------------------------------------------- |
| Directory      | `DIRECTORY_ACCOUNT_DELETION_SECRET`       | bearer secret; blank in compose by default                                 |
| Directory      | `DIRECTORY_AUTHENTICATION_HOST` / `_PORT` | default `authentication` / `3001`; grants and leases are re-validated here |
| Directory      | `DIRECTORY_PROFILE_HOST` / `_PORT`        | default `profile` / `3002`; export identity pages                          |
| Authentication | `DIRECTORY_ACCOUNT_LIFECYCLE_URL`         | e.g. `http://directory:3120`                                               |
| Authentication | `DIRECTORY_ACCOUNT_LIFECYCLE_SECRET`      | same value as the Directory secret                                         |

Set both Authentication variables or neither: one alone stops Authentication at
startup. The compose files pass them through from `DIRECTORY_ACCOUNT_LIFECYCLE_URL`
and `DIRECTORY_ACCOUNT_DELETION_SECRET`. The Postgres server must also run with
statement logging off; the `environment` route reports unverified otherwise.

Test the mounted routes: `directory:test-account-lifecycle-http-postgres` (same
`S5_LIFECYCLE_DISPOSABLE` and `S5_LIFECYCLE_TEST_DATABASE_URL` guards).
