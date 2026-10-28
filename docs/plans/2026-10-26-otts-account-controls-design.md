# OT/TS account controls — U01, U02, U03

Scope: Optimistic Tanuki (`client-interface`) and Towne Square (`local-hub`).
These are the existing U slices; the backend owner inventory is unchanged.

Use one shared account-rights panel in the existing settings/account pages.
Export requests use the authenticated session and an expected-account check.
The panel shows actual job state, offers retry/cancel, and exposes a native
streaming download only when the server reports a complete, available artifact.
A failed readiness check removes the stale link. No archive is buffered in
Angular memory.

Deletion requires the displayed account and exact `DELETE` confirmation.
Preparation does not mutate the account. Authentication signs a seven-day
capability bound to a future operation ID, request ID, hashed account subject,
app and expiry. The browser saves it before sending acceptance and opens the
public receipt page before awaiting the response. Acceptance revalidates the
normal session and signed binding; a receipt alone cannot begin deletion.
Status and retry remain available after normal sessions and account keys are
removed. Retry operates only on an accepted, blocked operation.

The minimal receipt is intentionally retained under
`ot:deletion-receipt:<app>` in session storage and may be copied privately.
It contains no raw account/profile ID, email, name, session token or key.
It authorizes status and blocked-operation retry, not login, export or owner
grants. It never goes into a URL. Expiry or loss does not cancel deletion.
A valid receipt is checked before replacing a saved one. Account-switch
responses are generation-guarded; an old request must not clear a newer login.

The signing key is domain-derived from the configured Auth JWT secret, which
must have at least 32 characters and must not be the default. Replicas must
share it. Rotation invalidates outstanding receipts without cancelling their
operations. Preparation fails closed when secure receipt custody is unavailable.
The UI must not dispatch acceptance if receipt storage fails.

U03 exercises actual guarded Gateway HTTP, Auth TCP and all twelve owners in a
labeled disposable PostgreSQL/local-files fixture. Both rebuilt apps use actual
session and account-rights endpoints; unrelated shell display reads may be
controlled and must be identified in evidence. Check desktop/mobile layouts,
keyboard confirmation, accessibility, native TAR downloads, revocation,
blocked retry, restart recovery, receipt reload and account isolation.

Local acceptance is recorded in the U01–U03 findings and receipts after the real browser/protocol proof passed. External providers,
backups, downloaded copies, offline devices and deployment/load qualification
retain their existing R/X boundaries.
