# Videos account ownership implementation plan

Goal: capture the seven retained Videos tables for an authenticated account using a leased, same-snapshot Profile identity set, then integrate a verified Videos snapshot into account-export jobs.

Architecture: reuse the established owner emitter, spool and Profile identity paging protocol. Extract the unchanged Assets identity client into the existing shared Storage library with a compatibility export; Videos must not import an Assets application file. A private temporary identity table bounds memory. Read all seven tables in a read-only repeatable-read transaction, using keyset pages and selected, bounded fields. Keep media bytes in Assets; Videos emits typed asset references and processing state without asserting cross-store media consistency.

Tech stack: NestJS, TypeORM/PostgreSQL, shared Models/Storage, Nx/Jest, private Docker fixtures. Existing checkout only; Directory stubs and protected Compose/alias changes excluded. No schema or public UI in this slice.

## 1. Shared identity client

Move Assets Profile snapshot paging implementation to `libs/storage/src/lib/account-export-profile-snapshot.client.ts`, retain an Assets alias from its original file and export the generic client from Storage. Preserve timeout, cancellation, exact descriptor/scope/count/cursor/order checks and page-by-page delivery. Existing nineteen focused tests must still pass. No new project or cross-app import.

## 2. Videos database component

Create `apps/videos/src/app/account-export-owner.service.ts` and focused spec. Constructor takes DataSource, shared AccountExportProfileSnapshotClient and Auth client. API captureAccount({grant,profileSnapshot,onChunk,signal?,captureTimeoutMs<=45000}). Sources in deterministic order: channel, video, channelSubscription, videoView, channelFeed, programBlock, liveSession. One capture per instance; exact lease before capture/every delivered chunk/completion. No raw request/token retained after capture. Temporary table before read-only transaction; statement10s/lock2s/capture45s; all page reads bounded; transaction/drop/connection cleanup precedes terminal proof. Dirty cleanup quarantines and error-releases the actual PostgreSQL connection as J8 does.

Ownership policy:

- Channel candidates match account userId OR captured profileId; both must agree before inclusion. This detects contradictory stored ownership instead of hiding it.
- Video and channelFeed/programBlock are owned by joined owned channel. Community IDs must agree where present. Pending/processing video makes capture fail closed because original/output references may be changing; ready/failed are metadata states, raw processingError is omitted.
- Subscription candidates match actor userId OR captured profileId; both required fields must agree. Views match either present actor identity, reject contradictory present actor IDs; anonymous and other viewers of owned videos are excluded. Target channel/video IDs are opaque activity references; counterpart user/profile IDs and IP addresses are omitted.
- Live sessions include account-created rows (both creator IDs must agree) and rows attached to owned channels. Owned-channel rows created by another actor retain safe session metadata with creator identifiers omitted; community linkage must agree. Own-created sessions on other channels are personal activity with opaque target references. Never include liveSourceUrl. Shared community membership alone is not ownership.
- Channel banner/avatar and Video original/legacy/playback/HLS/thumbnail references remain typed IDs, not storage paths or byte claims. Program/feed references are opaque metadata; full referenced counterpart objects are not joined into export. No data deletion or media-reference authorization claim here.

For every source use selected columns and bounded text projections with explicit oversize rejection, never silent truncation or SELECT\*. Retain complete supported text within the emitter/spool budget. Full UUID keyset includes minimum UUID. No arbitrary row cap advertised as complete.

## 3. Private component acceptance

Use fresh isolated PostgreSQL, real three owning-service migrations, actual shared emitter/spool, fake only Auth/Profile RPC for component scope. Two accounts and multiple captured profile pages (1006 IDs), all seven sources, minimum UUID, long supported text, foreign/counterpart rows, null actor cases, contradictory ownership/community, pending processing, secret IP/stream URL/errors absent, snapshot late insert, lease loss, abort and cleanup failures. Verify safe selected projections, SHA/count terminal proof and exact source-table fingerprints before/after; independent fixture/temp-table readback and teardown. Run focused Nx tests once and Videos/Storage/affectedAssets pre-E2E lint/build.

## 4. Transport and jobs, separate checkpoint

After component evidence, register a leased bounded snapshot transport and Auth client using J9 conventions, keep Profile parent alive through dependent capture, stage marker only after verified capture and cleanup. Actual private Auth/Profile/Assets/Videos RPC fixture must exercise nonempty captures, access fences, restart/recapture and failure propagation. Media still authenticated through Assets; processing races and HLS segment references require explicit disposition before account portability can be accepted.

## 5. Remaining owners and artifacts

Reconcile the source inventory after Videos. Upgrade partial Social/Permissions/Forum previews to full paged captured owners, then service-specific remaining owners in dependency order. Download artifacts require accepted required-owner coverage, durable encrypted retention, authenticated retrieval, expiry/revocation, manifests and safe filenames; no overall complete/downloadable flag while any required source remains unresolved. Record each checkpoint in master audit/execution/completion map and its receipt, including checks not run. External provider flows/release qualification remain separately owned.

## J11 implementation ownership

Root owns shared parent-bound descriptor aliases, Videos commands/source tuple, module/controller registration, Authentication coordinator/config and actual runtime fixture. A Luna worker extracts the existing Assets registry into the shared Storage library with thin Assets and Videos wrappers; a second worker extracts the Auth pull client into a shared implementation and thin Auth wrappers. No protocol change to Assets. Generic services take trusted participant/source/command configuration and retain all existing limits, exact lease scope, parent binding, cleanup charging and owner-promise draining. Rerun existing seven Assets registry and twenty-five Auth Assets client regressions after extraction, plus focused Videos wrapper cases. Actual private Auth/Profile/Assets/Videos integration is required before recording a Videos job marker as verified. Parent Profile cleanup follows both child captures; any failed owner or cleanup leaves jobs failed/incomplete without an artifact.
