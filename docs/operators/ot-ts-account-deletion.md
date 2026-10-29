# OT/TS account deletion runtime integration

Scope: Optimistic Tanuki (client-interface) and Towne Square (local-hub).
D25–D27 and U01–U03 public controls are locally verified; deployment qualification remains open. The worker keeps account
identities and keys until every required cleanup family is verified.

## Gateway replica inventory

Authentication reads ACCOUNT_DELETION_GATEWAY_ORIGINS as a JSON array of
absolute HTTP(S) origins, at most eight. A single Docker Gateway service can
use ["http://gateway:3000"]; use the actual internal origin for the deployment.
With multiple Gateway processes, list each direct origin. A load-balanced
address that repeatedly selects one process does not prove that every process
was cleaned. Do not put credentials, query strings, paths or user-supplied
URLs in this setting. Use trusted backend network addresses.

Without this setting the oauth-and-sessions cleanup family remains unavailable.
Invalid or duplicate origins fail configuration validation. An unavailable
replica or malformed/nonzero response blocks verification. The registry also requires fresh owner and runtime readbacks; configuring Gateway
origins alone does not establish complete cleanup coverage.

For each declared origin the coordinator sends the current signed
Authentication/readback capability to these internal endpoints:

- POST /api/internal/account-deletion/oauth/purge
- POST /api/internal/account-deletion/oauth/readback
- POST /api/internal/account-deletion/sessions/purge
- POST /api/internal/account-deletion/sessions/readback

These endpoints validate the operation, lease and frozen identity scope with
Authentication before and after cleanup. A user's cookie does not authorize
cleanup. Do not record request bodies or signed capabilities.

OAuth cleanup removes matching linked states and callback references, including
orphaned Redis keys, and prevents later creation for that account. Redis uses
an atomic hashed account marker without a TTL; local markers last for the
process. Socket cleanup drains authentication, closes target connections,
removes retained credentials and denies late gateway registration. Failed
closes retain retry state. Counterpart connections and OAuth records remain.
D00's persistent account fence remains authoritative after a Gateway or Redis
restart.

## Local acceptance boundary

The Gateway adapter has HTTP client/contract tests, OAuth has a real two-client
Redis test, and socket cleanup has a real Chat/Social transport test.
HTTP/socket component tests mock their Authentication transport or issuer;
they do not establish the deployment topology or D27 recovery.

The registered adapters cover jobs/spools, permission caches and rate limits,
search copies, declared diagnostic/audit stores, media custody, app-held grants,
and browser session boundaries. Registration is not runtime acceptance. The
full twelve-owner failure/retry and process restart proof passed in D27. See [the D25 finding](../release-readiness/findings/DF-007-D25.md).

On 2026-10-26 the operator confirmed that the local OT/TS release environment
has no forwarded log capture destinations and no retained legacy OT/TS logs,
including manual copies outside Docker. This is an operator inventory statement,
not evidence that a purge adapter erased historical files. Current processes
must still prove that payload-free logging is active on every declared replica.
Future OTEL/Grafana setup is [documented separately](ot-ts-observability.md).
Adding a collector or retaining new local copies requires updating the inventory
and providing its cleanup/readback contract before deletion can complete.

For the operator-confirmed local inventory above, configure Authentication with:

```sh
ACCOUNT_DELETION_LOG_INVENTORY='{"scope":"local-ot-ts","confirmedAt":"2026-10-26","noForwardedCollectors":true,"noRetainedLegacyLogs":true}'
```

This declaration describes this environment only. Missing inventory, inactive
payload-free logging on any service/Gateway replica, or a failed audit-owner
readback blocks the diagnostic cleanup gate. Do not reuse the declaration after
adding collectors or retaining legacy copies. Each configured replica must have
a distinct runtime instance identity; pointing two entries at the same runtime instance does not
prove coverage of two replicas.

## Owner replicas and shared storage

`ACCOUNT_DELETION_OWNER_REPLICAS` is a JSON object mapping an owner name to
one through eight direct TCP endpoints, for example:

```json
{
  "authentication": [{ "host": "auth-2", "port": 3001 }],
  "social": [
    { "host": "social-1", "port": 3004 },
    { "host": "social-2", "port": 3004 }
  ]
}
```

Use the deployment's actual service ports. Authentication entries describe
additional replicas; the coordinator also cleans its own process. Other owner
entries replace their single configured endpoint. Every live instance must be
listed directly. Unknown owners, duplicate endpoints, unavailable instances,
and conflicting replies block completion. Without an override, the configured
service endpoint declares a singleton; it does not discover hidden replicas.

Authentication replicas sharing an export-job database must share the encrypted
artifact directory. Assets replicas sharing metadata must share the corresponding
storage backend. The coordinator writes a random, nonidentifying challenge and
requires every declared replica to read it before cleanup can proceed. A copied
store UUID in independent directories is insufficient. Local stores retain a
nonidentifying `.ot-store-custody-v1` marker; temporary `.ot-store-probe-*` files
are removed after each probe. S3 probes use `.ot-store-probe/` and remove all
versions of that probe key. These probes do not qualify live S3 deployment by
themselves.

## PostgreSQL diagnostics

The supported local deletion environment disables SQL diagnostics that can copy
personal values into logs. Every owner checks the effective database settings
before mutation and at runtime readback. The reference fixture starts PostgreSQL
with `log_min_messages=fatal`, `log_min_error_statement=panic`,
`log_statement=none`, `log_duration=off`, `log_min_duration_statement=-1`,
and `log_min_duration_sample=-1`. Parse, rewritten-query and plan debug output
must be off; shared, session and local preload-library settings must be empty.
An unknown or incompatible setting blocks the environment check. Configure the
intended database explicitly; the deletion worker does not change shared server
settings or erase pre-existing SQL logs.

## Browser boundary and scope

Set `ACCOUNT_DELETION_BROWSER_ORIGINS` to an object containing both app IDs and
their direct origins. Each origin must serve the checked-in
`/assets/browser-session-boundary.json` contract. Verification combines that
contract with server-session revocation and the signed Gateway cleanup/readback.
It establishes the N06 session boundary, not physical wiping of offline devices,
previously downloaded files, or browser cookie bytes on disconnected devices.

Profile and Classifieds preflight reject account-associated records outside the
explicit OT/TS scopes, including unresolved null scopes. Such a block requires
an ownership/scope resolution; it does not authorize deletion of another
product's data or allow destruction of shared account keys while that data remains.

## Public controls and recovery receipts (U01–U03)

The shared controls appear in OT Settings (`/settings`) and TS My Account
(`/account`). Export status comes from the authenticated job service. Download
uses a native attachment stream after a readiness check; failed, incomplete or
expired jobs do not receive a ready download link.

Deletion displays the current account and requires exact `DELETE` confirmation.
The browser saves a recovery receipt before dispatching acceptance, then opens
`/account-deletion`. Keep that exact route public in both Angular and SSR routing:
normal sessions are revoked as soon as deletion is accepted. A failed storage
write must prevent acceptance. Closing the confirmation leaves the account intact.

Receipts last seven days and are signed with a domain-derived key from Auth's
configured JWT secret. Use a non-default secret of at least 32 characters, shared
by all Auth replicas. Rotation invalidates outstanding receipts but does not
cancel operations. The receipt contains an operation ID, request ID, app,
hashed subject and expiry; it contains no raw account/profile identity or
session credential. Status and retry validate that binding against the durable
operation. Retry cannot begin a new deletion and is allowed only when blocked.

The receipt is saved under `ot:deletion-receipt:<app>` in session storage.
Users should copy it privately before closing the tab. The receipt page can
restore a saved copy without signing in; an invalid copy must not replace a
working one. A receipt remains tied to the originally confirmed account when
another account signs in. It cannot sign in or download that account's data.
Never put it in a URL, diagnostic, analytics event or support transcript.

A blocked status means sign-in remains fenced while cleanup awaits retry or
operator resolution. Receipt expiry/loss does not cancel that cleanup. Public
completion describes application-held storage at the qualified local boundary;
backups, provider-held data, downloaded copies and offline devices retain their
separate acceptance requirements. U01–U03 acceptance is recorded in the release
findings and is not inferred merely from these configuration instructions.

## Retention integration (2026-10-27)

R2-01–R2-03 are locally verified. Immediate account deletion takes precedence
over seven-day session inactivity and ninety-day history windows. Shared
retention status includes eleven reconciled sources and keeps unresolved artifact
custody visible. See [retention operations](./ot-ts-retention.md) and the
[R2 closeout](../release-readiness/findings/DF-007-R2-03.md).
