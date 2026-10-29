# HLS account-export portability implementation plan

Goal: include authenticated HLS manifests and MPEG-TS segments produced by the existing video pipeline in Assets account captures, with account-owned reference checks and an offline rewrite helper for later artifact assembly.

Architecture: add a pure parser/rewriter to the existing shared Storage library; extend the current Assets media reader and owner callback. Preserve captured original bytes and SHA. The eventual artifact assembler rewrites API asset references to validated local file names using the verified media manifest index and computes a distinct derived-file hash. This slice does not expose downloads or accept the remaining owner inventory.

Tech stack: TypeScript/Node, existing encrypted Storage adapters/spools, PostgreSQL owner transaction, Nx/Jest and real ffmpeg-generated fixtures. No new library project, schema, public route or UI. Existing checkout and protected Directory/Compose/alias changes remain untouched.

## 1. Shared bounded HLS helper and media reader

Owned files for the media worker: new `libs/storage/src/lib/account-export-hls.ts` and `.spec.ts`; existing `apps/assets/src/app/account-export-media-reader.ts` and `.spec.ts`. Root owns Storage index export and all owner/runtime/docs changes.

Export `parseAccountExportHlsPlaylist(bytes)` returning unique normalized reference Asset IDs, and `rewriteAccountExportHlsPlaylist(bytes, resolver)` returning UTF-8 bytes. Resolver returns `{fileName, mimeType}` from verified captured media manifests; require MPEG-TS segments and safe single-leaf names without paths, URL schemes, traversal or controls. Unknown/missing mappings fail. Preserve source bytes; rewriting does not change original capture hash.

Supported input is the finite MPEG-TS media-playlist subset produced by `apps/video-transcoder-worker/internal/transcode/worker.go` and rewritten by Videos processing: UTF-8 `#EXTM3U`, version/target duration/media sequence, optional VOD playlist type, paired positive EXTINF durations and `/api/asset/<UUID>` URI lines, and final ENDLIST. Optional independent-segments/discontinuity tags may be supported explicitly. Reject master playlists, encryption/key/map/URI-bearing tags, external or relative arbitrary URLs, credentials, query strings, traversal, unknown directives, malformed/unfinished playlists and invalid UTF-8. Require at least one segment. Bound full manifest bytes to 1 MiB, unique references to 8192, and line count/length to safe fixed limits.

Recognize MPEG-TS through at least three 188-byte packets with sync bytes at offsets 0,188,376; retain signature-level validation wording. Update the current 64-byte sniff loop to gather enough bounded prefix bytes for TS without breaking existing formats or small streams. HLS must be fully buffered within its separate limit and parsed before any media record is yielded.

Extend media read options with `validateHlsReferences?: (ids: readonly string[]) => Promise<void>`. HLS without that callback fails closed. Await validation before byte delivery. Emit original HLS bytes in existing 48 KiB chunks, existing size/hash fields and a `.m3u8`/`application/vnd.apple.mpegurl` manifest with `hlsReferenceAssetIds`. TS uses `.ts`/`video/mp2t`. Existing 64 MiB/file and 128 MiB/capture accounting, stream limits, abort, authenticated opening and cleanup remain enforced. All previous format regressions must pass.

## 2. Owner reference validation

Root extends `apps/assets/src/app/account-export-owner.service.ts` to pass the callback bound to the same local read-only repeatable-read transaction and captured Profile temp scope. Normalize/deduplicate reference IDs according to the helper contract; validate at most 200 IDs per SQL query with selected bounded fields. Every referenced asset must exist in that fenced account scope and be an exportable active video object. Foreign, missing or pending references fail capture. All owned media is still read through the existing authenticated reader; a reference check alone is not byte integrity. Revalidate cancellation/deadline between batches; no whole-account ID array.

The Assets datasource also needs the same three-second connection/pool wait bound established for Videos. Remove raw configuration logging that includes credentials; retain only host, port and database diagnostics. Verify production options with focused tests and an occupied private single-connection pool.

## 3. Evidence

Focused parser cases: actual generated playlist, safe rewrite/resolver, bad UTF-8, secrets/external/key/master/unknown tags, duplicate/order/end/duration errors, budget limits and bad file names/MIMEs. Reader cases: actual encrypted ffmpeg TS/rewritten HLS, split small chunks, unchanged byte/hash, ownership callback ordering, failures/abort/cleanup and prior PNG/MP4/WebM cases. Source presence/unit tests alone do not establish acceptance.

A fresh private PostgreSQL/encrypted-storage fixture runs all owning Assets migrations, creates two accounts' captured identity scopes and encrypted original/playback/manifest/segment objects, and proves actual full owner capture. Include foreign/missing/pending HLS references and authenticated corruption. Verify before/after table fingerprints, original hashes, scope privacy and cleanup. Assemble only a private fixture directory from verified captured bytes and the rewrite helper; ffprobe must read the generated offline playlist without network access. This is artifact-component evidence, not a downloadable account artifact.

Run the narrow changed tests once, then affected Storage lint and Assets build/lint before accepted integration. Record exact counts, checks not run, private readback/teardown, fields and limits in J12 receipt/finding and master/execution/completion references. Next complete Permissions, Social, Forum and remaining owners, then integrate durable encrypted account artifact/downloads.
