# Account deletion and portable export implementation plan

> Execute checkpoints in order, using the existing current checkout. No worktrees. Use the delivery workflow with flat delegation and independent verification/review.

**Goal:** Deliver DF-007 account-level deletion and portable JSON export across the shared platform, including media and provider/backup acceptance, before claiming availability.

**Architecture:** Authentication is the account authority and intended coordinator. Owning services implement explicit export/deletion/readback participants; no generic cross-database deletion or profile-delete shortcut is permitted. Completion requires an accepted ownership inventory, every required participant, portable media and provider/backup proof. Unknown or unavailable coverage remains incomplete.

**Tech stack:** Existing NestJS services, shared models/constants, TypeORM/PostgreSQL, Nx/pnpm, local Docker E2E, existing reusable Angular UI when the complete feature is ready.

## Existing decisions

- Delete the account's own data/content; preserve other people's content.
- Leave deleted-account placeholders in affected conversations.
- Export portable JSON with associated images/video; encrypted storage bytes or expiring internal URLs are not portable exports.
- Do not expose password hashes, raw session/action/provider tokens, TOTP secrets or private key material in exports.
- Do not introduce retained-data exceptions or describe support contact as a working deletion route.
- Keep Gateway's current profile DELETE fail-closed until supported downstream deletion exists.
- Preserve directory stubs and their root Compose/TypeScript alias changes unchanged and excluded.

## Design alternatives considered

1. Generic database cascade/profile deletion: rejected because identity/content span services, media bytes are separate, and shared records include other users' content.
2. A new lifecycle microservice: deferred; the existing Authentication authority can coordinate without adding another deployment boundary.
3. Explicit service participants with a durable Authentication coordinator: selected. Start with safe, internal read-only export participants, then add complete coverage and durable orchestration before public success or deletion.

## Checkpoint A — Internal core export and fail-closed coverage

**Status (2026-10-17):** Locally verified; see [findings](../release-readiness/findings/DF-007-A.md) and [receipt](../release-readiness/evidence/df-007/checkpoint-a.json). This is not full DF-007 acceptance.

**Owners:** existing shared models/constants; Authentication; Profile; their focused test/E2E projects.

1. Add typed internal participant/snapshot contracts and versioned known participant coverage. Mark the inventory unaccepted/incomplete; the mapper found candidates across the whole workspace, not a complete ownership proof.
2. Add a strict allowlisted Authentication identity snapshot and Profile snapshot covering all profiles owned by the account and their timelines. Missing/invalid account IDs must never become unscoped ORM predicates.
3. Add explicit completeness evaluation: missing, failed, partial, duplicate/unknown or unverified participants cannot yield a complete export. Internal previews must remain visibly incomplete, and no downloadable artifact/public complete endpoint is enabled.
4. Add meaningful regression tests for cross-account isolation, multi-profile coverage, secret exclusion, missing participants and service failure. Preserve the existing Gateway deletion denial/501 tests.
5. Run pre-E2E checks below, then the smallest real Authentication/Profile integration test with controlled accounts and exact cleanup.
6. Record the checkpoint findings and remaining coverage in the DF-007 report and master/execution references. This checkpoint does not accept DF-007 or RR-11.

No schema change is needed just to read snapshots. Add a durable ledger only when implementing orchestration; use Authentication's Nx TypeORM migration generation target for any new schema.

## Checkpoint B — Complete the ownership inventory and export participants

### B1 — Safe local account metadata

**Status:** Locally verified; see [findings](../release-readiness/findings/DF-007-B1.md) and [receipt](../release-readiness/evidence/df-007/checkpoint-b1.json). Continue at B2. DF-007 remains open.

Expand the existing internal snapshots with the account's age-eligibility status/end date, each owned profile's stored `blogRole`, and local OAuth linkage metadata. Query provider records by the authenticated account ID, select explicit fields, recheck ownership, and apply the existing row/string/response limits. A failed or truncated provider read must remain explicit; it cannot become a successful zero-data acknowledgement.

Distinguish intentionally excluded credentials from unimplemented account data. Never serialize passwords/hashes, TOTP secrets, private keys, raw session/action tokens, token hashes, or provider bearer credentials. Keep guardian shared rows, email-action/security metadata, media, pagination and the wider inventory visibly unresolved for the following checkpoints. B1 does not enable a public route, artifact, deletion, schema change or UI.

Acceptance requires focused field/secret/ownership/budget tests, CI-aligned pre-E2E checks, independent review, and a private Auth/Profile TCP run. The integration fixture must include owned and foreign provider-link metadata and prove that only the authenticated account's records appear. Seed only generated test accounts in the explicitly configured private database, use parameterized statements, and remove/read back those fixture rows before project-scoped teardown. No external provider or email operation is needed.

### B2 — Linked guardian records and own security-event metadata

**Status:** Locally verified; see [findings](../release-readiness/findings/DF-007-B2.md) and [receipt](../release-readiness/evidence/df-007/checkpoint-b2.json). Continue at B3. Full account coverage remains open.

Continue the internal preview with role-relative linked guardian permissions, own policy-notice records, own email-action metadata and Profile guardian activity. Use exact account-ID predicates, explicit selected fields and independent ownership/role checks. Do not assign unlinked guardian requests by email.

Dependent projections may contain their own DOB and owned profile ID. Guardian projections omit the dependent’s DOB, account and profile IDs. Both omit counterpart identities/contact details and all token hashes. Permission output is limited to role, status, app, creation/attestation timestamps and recorded attestation version; full attestation text and lifecycle/transport fields stay explicitly uncovered. Policy notices report provider acceptance with that exact meaning, never inbox delivery. Export only own action purpose/app/creation/consumption metadata; active-token, return-path and credential fields remain excluded, and pruned history remains uncovered.

Profile activity must match a real profile owned by the recorded dependent. Export role, app, operation and timestamp; include profile ID and changed field names only for the dependent’s own profile. Omit those fields in the guardian projection and keep that redaction explicit. Reject malformed, self-actor, orphan or owner-mismatched rows with partial-coverage markers. Existing retention limits do not establish a complete lifetime history or authorize new retention exceptions.

Apply the existing row/string/byte limits to every new store. Reads that fail or truncate remain partial. Preserve all session/foreign-account/inline-media tests, add role-specific and field-exclusion unit tests, then seed current-schema records for generated accounts in the private TCP test. Run the same pre-E2E gates, independent review, direct fixture readback and project teardown. No public route, artifact, deletion, schema, provider/email operation or UI is included.

### B3 — Permissions and bounded owned-profile identity pages

**Status (2026-10-18):** Locally verified; see [findings](../release-readiness/findings/DF-007-B3.md) and [receipt](../release-readiness/evidence/df-007/checkpoint-b3.json). Continue at B4. Full export/deletion remain open.

Add a narrow internal Profile command in the canonical Profile contracts and existing account-export controller. Validate account/cursor UUIDs, page-size bounds and the same persisted session/subject binding before querying. Select only profile ID and owner ID, recheck every returned owner and ID, use deterministic keyset pages with a fixed maximum size, and reject malformed/duplicate/non-progressing pages. Return explicit `hasMore`/`nextCursor` and an unfenced-live-read limitation. Never infer a stable account snapshot or complete zero-data proof from the last or empty page; concurrent inserts can sort behind the cursor. Durable snapshot fencing remains future work.

Permissions independently validates the account session and resolves IDs through that command, without accepting caller-provided profile IDs or relying on the media/budget-limited Profile preview. Consume bounded pages with total-ID, assignment, time and byte budgets. Export explicit owned assignment metadata and shared role/scope references, disable eager relation graphs, and omit unreviewed target IDs. A failed, unavailable, foreign, malformed, repeated or over-budget resolver/assignment result remains partial. The Permissions participant and whole preview remain incomplete, including an empty result.

Wire the participant through existing service-token/configuration patterns and add its coordinator result validation. Role, scope, permission definitions, role-permission joins and community/shared targets remain shared data; this read-only slice does not delete or claim ownership of them. Profile-specific definitions and target mappings stay unresolved until independently classified.

Acceptance requires session/subject and cross-profile isolation, strict paging/cursor/ownership tests, bounded responses, unknown/failed/malformed participant behavior, CI-aligned pre-E2E checks and independent review. Extend the checked-in Authentication E2E service closure with Permissions and its database, then use generated controlled accounts/profiles and exact-ID cleanup/readback to prove owned assignments appear, foreign assignments and shared definitions remain intact, and a failed identity lookup cannot become complete zero data. No public route, artifact, deletion, schema, provider/email operation or UI is included.

### B4 — Bounded Social post and interaction preview

**Status (2026-10-18):** Locally verified as a bounded internal preview; see [B4 findings](../release-readiness/findings/DF-007-B4.md) and [receipt](../release-readiness/evidence/df-007/checkpoint-b4.json). DF-007 and RR-11 remain open.

Add an internal Social participant using its existing Authentication/Profile clients and the B3 identity resolver. Authenticate before ORM access, accept no caller-provided profile list, validate every page and recheck both account and profile ownership on each returned core row. Use UUID keyset pages of at most 100, at most 1,000 profile IDs and 1,000 rows per collection, a finite read-time budget, selected columns without eager graphs, and the existing string/participant/combined byte limits. Failed, malformed, orphaned, duplicate, over-budget or unfenced reads remain explicitly partial, including empty results.

Limit this checkpoint to owned Post, Comment, Reaction and Vote rows, Attachment metadata on verified owned posts, and Poll definitions directly authored by the validated account/profile pair. Actual Social entities and migrations establish no Poll/Post association: no join columns or association table exist. Query Polls only by stored `userId` plus trusted Profile IDs, recheck both, include the owned `profileId`, and never use a Post relation or predicate. Exclude moderation fields and Poll `votes`; always report `poll-post-association-unverified` and `social-poll-vote-history-uncovered`. Historical/internal-RPC Poll authorship remains unverified. Also exclude arbitrary SocialComponent JSON and unreviewed Link URLs. Targets are opaque references only; do not copy another author’s content. Resolve target existence with selected identifiers only. Omit foreign parent-comment identifiers unless independently classified. Never fetch attachment URLs or claim portable media bytes.

Wire Authentication’s Social participant using existing token/config patterns and strict envelope/aggregate validation. Extend the checked-in private E2E closure to Authentication, Profile, Permissions and Social with their four private databases; update dedicated/shared E2E composition and environment contracts together. Generated fixtures must prove multi-profile ownership, own comments/interactions on foreign posts, exclusion of foreign comments on own posts, safe sidecars, foreign/shared preservation and exact cleanup/readback. Run narrow service/contract checks, the same full pre-E2E CI gates and independent review before private runtime.

All other Social stores remain uncovered. This slice adds no schema, public route, UI, download or deletion. Existing post removal deletes foreign comments through service logic and cascading relationships; account deletion must resolve that preservation problem before using it. Do not reuse that path unchanged for account erasure.

### B5 — Bounded Social personal-state preview

**Status (verified 2026-10-18):** The five-store extension is locally verified as an internal partial preview; see [B5 findings](../release-readiness/findings/DF-007-B5.md) and [receipt](../release-readiness/evidence/df-007/checkpoint-b5.json). DF-007 and RR-11 remain open.

B5 extends the B4 participant with `SavedItem`, `SearchHistory`, outgoing `FollowEntity`, outgoing `UserBlock`, and outgoing `UserMute`. It reuses authenticated subject validation and trusted Profile IDs. Saved/search rows require owned profile IDs; relationship queries are actor-side only and recheck the actor against the selected trusted IDs. Inbound rows are not queried. Counterpart/target IDs are opaque; no counterpart lookup or copied content is included. `isMutual`, `itemTitle`, and `resultCount` are omitted. Mute durations accept null or positive safe integers up to 31,536,000 seconds; invalid legacy values are omitted and leave the result partial.

The preview has eleven partial arrays across B4 and B5. The five B5 stores use explicit selected columns, pages at most 100, and a 1,000-row scan cap plus one truncation probe per store. That scan cap does not extend to B4's existing collection readers; the shared 15-second deadline remains. The result is always partial and unfenced. Output/string limits do not bound database-read memory, and the deadline does not establish SQL cancellation.

Independent source review passed. All 31 recorded pre-runtime gates passed. The clean private Authentication E2E ran uncached and passed 21/21; same-run `ot_social` counts for all five added tables were zero before and after, 15 selected legacy marker counts were zero, and project teardown left no containers, networks, or volumes. R1 (wrong database selected for readback) and R2 (cached E2E replay) are retained as non-acceptance attempts. Generated-fixture exact-ID assertions remain scoped to named Social, Permissions, and Authentication guardian tables; OAuth/key-data cleanup has no post-delete absence assertion.

This is not a complete Social/account inventory, portable export/download or deletion implementation. No schema, public route, new participant/configuration entry, UI, or provider operation was added. Keep remaining stores, other participants, portable media, durable orchestration, providers/backups, deletion and account-wide readback in the broader DF-007 work. The Authentication E2E target now sets `cache: false`; the default command executed against a fresh private stack and passed 21/21 with same-run database readback and teardown. See the [cache-baseline findings](../release-readiness/findings/AUTHENTICATION-E2E-CACHE.md) and [receipt](../release-readiness/evidence/df-007/e2e-cache-baseline.json). This host-side Nx change does not alter B5 application-image provenance or expand DF-007/RR-11 acceptance.

### B6 — Bounded Forum authored-content preview

**Acceptance:** This checkpoint is an internal, always-partial, unfenced Forum preview. It does not accept DF-007 or RR-11. The source-only review used baseline `46b6843f35aa71048312b7b1494c11cdf8e5c22b`; implementation review and runtime evidence must use the checkpoint-specific frozen source manifest and current receipts, rather than reusing that baseline hash set.

Add a Forum-owned TCP snapshot participant for only authored `Topic`, `Thread`, and `ForumPost` rows. Reuse the existing `AuthCommands.Validate` and Profile `GetOwnedAccountProfileIdPage` contracts. Require a UUID account ID and nonempty token/app ID; send Auth exactly `{ token, userId: accountId, appId }` with a 3-second first-response timeout and require both `isValid === true` and `data.userId === accountId` before any Forum repository read. Passing `userId` into Validate does not itself prove the response subject matches. Resolve trusted profile IDs in pages of 100 with 3-second first-response timeouts, validate account/cursor/page shape and ordered unique UUIDs, and stop at 1,000 IDs or ten RPC pages with an explicit truncation marker. Never accept profile IDs from the caller or use only the token's selected profile.

Use selected columns and UUID keyset pagination (`id > cursor`) for each entity. Require both `userId === accountId` and `profileId` in a trusted profile-ID page in the query; independently recheck returned rows. Do not query through `ForumAccessService.list()` or hydrate parent/child/link relations. A ForumPost authored by the account in a shared foreign-authored thread may appear as the account's contribution, with `threadId` opaque; do not include the parent thread/topic or foreign reply content. Query at most 1,000 candidate rows plus one probe per entity, with query pages no larger than 100 and a global per-participant 15-second read budget. This is a bound on returned candidate rows and output, not a bound on rows scanned inside PostgreSQL or proof of SQL cancellation. Because the conjunctive owner predicate excludes rows whose profile ID is outside the trusted set, do not claim to detect every inconsistent owner/profile mapping; only report a mismatch if an actually returned row violates the independent recheck.

Limit output to row ID, account/profile IDs, app scope, the authored text fields (`Topic.title/description`, `Thread.title/description/content`, `ForumPost.content`), timestamps, visibility, and scalar parent IDs as opaque references. These authored fields contain sanitized HTML and may embed `href`/`src` references: preserve them as JSON strings, but never parse, render, fetch, dereference, or traverse them. Omit separate ForumLink objects, media bytes/provider paths, moderation and report history, parent/foreign content; do not claim authored strings have been stripped of or contain no URLs. Emit the exact uncovered marker `embedded-media-and-link-references-unresolved`, alongside `forum-preview-unfenced`, `forum-links-unreviewed`, `forum-reports-and-moderation-uncovered`, and `forum-media-references-unresolved`. Enforce the existing 4,096-character string limit, 512 KiB participant limit, and 1 MiB aggregate limit. Omit participant data on byte overflow. Always return `status: partial`, including empty and failed reads, with explicit markers for actual truncation, malformed pages/rows, read failure and budget exhaustion. The account preview remains `complete: false`, `downloadable: false`; do not add an account-wide timeout or imply timed-out SQL was cancelled. Auth and Profile RPCs each retain a maximum 3-second first-response timeout, capped by remaining participant budget; the Forum coordinator allows 16 seconds for the participant response. The strict conjunctive owner query filters profile mismatches before application recheck, so only mark mismatches actually observed on returned rows; legacy authorship provenance remains unverified.

**Files:**

- Create `apps/forum/src/app/account-export.service.ts`, `apps/forum/src/app/account-export.service.spec.ts`, `apps/forum/src/app/account-export.controller.ts`, and `apps/forum/src/app/account-export.controller.spec.ts`.
- Modify `apps/forum/src/app/app.module.ts` to register the controller/service, existing Topic/Thread/ForumPost repositories, and TCP Auth/Profile clients. Modify `libs/constants/src/lib/libs/forum.ts` with one internal snapshot command; the constants barrel already exports Forum commands. No entity, schema, migration, public route, Gateway composition, or `apps/forum/src/config.ts` change is needed; use the existing service-token contracts and `SERVICE_AUTHENTICATION_*` / `SERVICE_PROFILE_*` environment values with the current service ports.
- Modify `apps/authentication/src/app/account-export.service.ts` and its spec to call Forum as the fifth sequential participant after Social; validate `contractVersion`, `participantId`, matching `accountId`, required `partial` status, the Forum marker allowlist, object data, string/byte limits, and failure/unavailable fallback. Add `FORUM_SERVICE` configuration in `apps/authentication/src/app/app.module.ts` and `services.forum` environment/default wiring in `apps/authentication/src/config.ts` plus `apps/authentication/src/config.spec.ts`. Do not change the fixed coverage inventory or its `accepted: false` flag.
- Extend `apps/authentication-e2e/project.json` implicit dependencies and `e2e` build dependencies with `forum`. Extend `apps/authentication-e2e/src/authentication/account-export.spec.ts` with the Forum TCP client, generated exact-ID fixtures, output checks, readback and cleanup.
- Extend `scripts/e2e-environment-manifest.mjs` and `scripts/tests/e2e-environment-manifest.test.mjs` with Forum in the Authentication E2E closure; update its service list, dependencies and image budget from 6 to 7. Extend `e2e/docker-compose.authentication-e2e.yaml` with the Forum service and `ot_forum` in its explicit database list. Update the fixture marker consistently in `.github/workflows/ci-cd.yml`, `scripts/run-all-e2e-locally.sh`, and `e2e/README.md`; extend the guarded allowlist to `ot_forum` without broadening the host/port requirement. The shared CI stack and default migration database list already include Forum.
- Validate Gateway identity propagation using `apps/gateway/src/auth/auth.guard.spec.ts` (signed token claims are verified before attaching `request.user`) alongside `apps/gateway/src/controllers/forum/forum.controller.spec.ts` (Forum create/update payloads use the authenticated user/profile). Change these tests only if the existing assertions do not cover the exact claims needed by this slice; controller tests alone do not prove JWT authenticity.

**Test-first acceptance:** Write Forum service/controller tests before implementation. Cover invalid session/subject and Auth response-user mismatch with zero Forum repository reads; Profile timeout/failure and malformed, foreign-account, duplicate, non-increasing or over-cap pages; rows returned despite query predicates that fail ownership rechecks; keyset progress and one-probe truncation at 1,000 per entity; byte/string limits; read-budget exhaustion; and always-partial empty/unavailable responses. Coordinator tests must reject wrong participant/version/account, non-partial Forum status, unknown markers and oversized payloads while preserving a failed Forum placeholder and incomplete coverage.

Seed only generated Forum IDs in the explicitly marked private E2E database. Use two accounts, two owned profiles for the target account and one foreign profile. Create target-authored topics/threads/posts across both owned profiles, a target-authored post in a foreign-authored shared thread, and a foreign-authored reply. Assert only target-authored records and text appear, the foreign reply and parent text stay absent, an included parent reference is only an opaque ID, all five coordinator participant entries are present, and the preview remains partial/non-downloadable. Read every generated Forum row before and after preview and compare exact fixture state; clean only generated IDs in dependency order (posts, threads, topics) and assert none remain. No account/user/profile-wide deletion predicates, wildcards, providers, Assets calls, media traversal or live user data.

**Validation order:**

1. Focused tests, one command per changed boundary:

   - `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run forum:test --testFile=apps/forum/src/app/account-export.service.spec.ts --runInBand`
   - `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run forum:test --testFile=apps/forum/src/app/account-export.controller.spec.ts --runInBand`
   - `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run authentication:test --testFile=apps/authentication/src/app/account-export.service.spec.ts --runInBand`
   - `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run authentication:test --testFile=apps/authentication/src/config.spec.ts --runInBand`
   - `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run gateway:test --testFile=apps/gateway/src/auth/auth.guard.spec.ts --runInBand`
   - `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run gateway:test --testFile=apps/gateway/src/controllers/forum/forum.controller.spec.ts --runInBand`

2. Complete every pre-E2E gate required by the current CI workflows and changed-path triggers before runtime: validate TypeORM migrations and setup/migration contracts; run E2E environment and image/manifest/readiness contracts; inspect the Authentication E2E Nx project; run focused and affected tests, lint and production builds for Forum, Authentication, constants and E2E; run API code generation (`get-openapi`, Orval, generated formatting and drift check) because CI runs it unconditionally; run docs-tooling Jest and the Nx Storybook build because these tracked docs change; and run workflow Go catalog/generator tests plus inventory generation and deployment/Compose parity validators. Record exit codes and logs, including advisory workflow checks. Do not alter unrelated advisory failures. No migration is expected because entity metadata does not change.
3. Run `pnpm run build:dev`, scoped formatting and `git diff --check`; freeze the complete source/config/compose/workflow/test/plan/README path set and verify protected WIP hashes. Obtain independent source review and CI-aligned pre-runtime GO before any private-stack E2E.
4. Only after those gates, run the fixture E2E on a fresh private stack: `E2E_DB_PORT=5439 docker compose -p ot-df007-b6-forum -f e2e/docker-compose.authentication-e2e.yaml up -d --build authentication profile permissions social forum`, then run `NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true CI=true ACCOUNT_EXPORT_E2E_DB_MARKER=auth-profile-forum-export-fixture-v1 ACCOUNT_EXPORT_E2E_DB_HOST=127.0.0.1 E2E_DB_PORT=5439 pnpm exec nx run authentication-e2e:e2e:ci --skip-nx-cache`. The CI manifest must resolve Forum before running Authentication E2E. Read back exact fixture rows in the same run, then tear down only that private project and prove no project containers, networks or volumes remain. Respect `SKIP_SETUP` and do not tear down shared services.

The focused preimplementation review was GO for this bounded, internal, always-partial preview; no owner/product decision or upstream contract blocked the planned scope. Final acceptance still requires the source review, complete CI-aligned pre-runtime gates, and isolated runtime evidence described above. Keep links, reports/moderation, media portability, the wider owner inventory, deletion and DF-007/RR-11 acceptance open after B6.

### Gateway cache diagnostic redaction

**Status (verified 2026-10-19):** The cache factory's debug diagnostic now uses an explicit non-secret allowlist (`provider`, `ttl`, `maxSize`); the configured Redis password still reaches the Redis client. A synthetic sentinel regression failed before the fix and passed afterward. All 29 independent verification commands passed. See the [finding](../release-readiness/findings/GATEWAY-CACHE-LOG-REDACTION.md) and [receipt](../release-readiness/evidence/df-007/gateway-cache-log-redaction.json). This is one source-level log-call repair, not evidence about production log levels, sinks, retention, deletion, or all application logs. No account-rights implementation or acceptance status changes; DF-007 and RR-11 remain open.

### J1 — Durable internal export-job foundation

**Status:** Locally verified; see [finding](../release-readiness/findings/DF-007-J1.md) and [receipt](../release-readiness/evidence/df-007/checkpoint-j1.json). Authentication persists authorized create/status/resume, stable idempotency, account-wide active-job serialization and fenced DB-clock leases around existing partial previews. Two new TCP cases passed; five prior cases were intentionally skipped. The generated ledger migration and production acknowledgement SQL have local PostgreSQL proof. No artifact, deletion or unattended worker is implemented. Complete per-owner orchestration, data coverage, media and shared UI next; include the ledger itself in account deletion and retention, without exceptions. Follow the [selected finish sequence](./2026-10-19-release-finish-sequence.md).

### J2 — Authentication database capture

[Finding](../release-readiness/findings/DF-007-J2.md) and [receipt](../release-readiness/evidence/df-007/checkpoint-j2.json): a separate eight-source, transaction-consistent DB reader is locally verified by 15 Models tests and nine Authentication tests, including one enabled real-PostgreSQL case. Source counts/hash preservation and independent cleanup passed. The job runner still uses previews; staging, owner integration, global inventory, portable files, deletion and shared controls remain. No download or deletion is enabled.

### J3 — Verified owner staging through jobs

[Finding](../release-readiness/findings/DF-007-J3.md) and [receipt](../release-readiness/evidence/df-007/checkpoint-j3.json): internal jobs now stage actual Authentication DB capture, renew a fenced lease, record only safe database-owner progress and close staging before acknowledging incomplete status. Fifteen Storage, 11 owner and seven job tests passed; two private TCP cases and three enabled PostgreSQL fence cases passed with their unselected cases recorded separately. No download or deletion is enabled. Complete Profile ownership capture and remaining owners/media/artifact/deletion/shared controls next.

### Remaining export coverage

- After B2, resolve full guardian attestation/lifecycle fields, unlinked-row ownership and history limitations. Keep counterpart redactions explicit. Session-history coverage remains unresolved because the current token table stores bearer tokens without useful history timestamps.
- Profile images can be inline data URLs, internal references, or arbitrary URLs. Checkpoint A omits them explicitly while its preview is incomplete. The complete exporter must support bounded, validated inline-image bytes and owned Assets media without fetching arbitrary URLs. Tests must use real image bytes when claiming MIME validation; a base64-encoded text string with an image MIME label is not a valid image fixture.
- Classify non-ORM stores as well: Gateway permission caches and OAuth state/grants, browser state, queues/search/file/object stores, logs, providers and backups. Credential-bearing values must never enter portable data. TTL or a process-local invalidation is not cross-replica deletion proof. The entity catalog is not exhaustive.
- Trace account, user, profile, owner/creator references and indirect/shared relationships across every owning service. Candidate services include Social, Forum, Chat Collector, Classifieds, Assets, Videos, Workspace, Permissions, App Configurator, Blogging, Civic, Finance, Learning, Payments, Project Planning, Store and Wellness; this list is not exhaustive.
- Implement explicit allowlists/pagination and ownership readback per participant. Authentication's basic identity snapshot is not its whole data inventory: guardian relationships/notices, provider linkage metadata and other user-facing records require classification too.
- Add portable decrypted media streaming with bounded resource use, filenames/MIME information and a manifest. Resolve source/playback/thumbnail/manifest assets and URL references.
- Add durable idempotent orchestration, concurrency/state rules, failure recovery and artifact access/expiry. Do not mark complete while any inventory, participant, media or provider/backup gate is open.

## Checkpoint C — Deletion and readback

- Implement idempotent owning-service deletion after explicit ownership/shared-content policy review.
- Revoke sessions and prevent races during deletion; preserve coordinator retryability until all participants and readbacks succeed. Delete account credentials/keys only in an order that cannot strand recoverable media or remaining work.
- Preserve others' content, conversation placeholders and referential integrity; remove the deleted account's content and stored media as required.
- Validate retry after each injected failure, repeated requests, concurrent writes, zero-row acknowledgements and final independent readback. Provider/backup deletion remains required.

## Checkpoint D — Shared UI and final acceptance

Reuse existing account/settings controls and reusable libraries. Explain that this is a shared-account operation and show its real scope. Require account-level authorization and appropriate confirmation; no public claim or successful export/delete flow before complete backend acceptance. Validate OT and Towne Square, accessibility, failure recovery, provider/backup behavior and production configuration before accepting DF-007.

## Pre-E2E gate at every implementation checkpoint

Source of truth: `.github/workflows/ci-cd.yml` (`validate`, `quality`, applicable `storybook`/package/build and image checks).

- Node 24, pnpm pinned by package manager; `pnpm install --frozen-lockfile`.
- `NX_DAEMON=false NX_ISOLATE_PLUGINS=false NX_NO_CLOUD=true CI=true` for local Nx checks.
- Migration governance: `pnpm run validate:typeorm-migrations` and `node --test scripts/tests/setup-and-migrate.test.mjs`.
- Exact workflow contracts: `node --test scripts/tests/e2e-environment-manifest.test.mjs scripts/tests/wait-for-e2e-readiness.test.mjs scripts/tests/resolve-e2e-images.test.mjs scripts/tests/ui-e2e-ci-contract.test.mjs`.
- Nx workspace graph; workflow Playwright config collection; scoped formatting and `git diff --check`.
- Explicit intended-file affected selection: `test -c ci`, lint (workflow excludes E2E projects; run changed E2E lint separately), production build. Exclude directory stubs without hiding real dependents. Record selected counts so zero-task runs cannot count as passes.
- Run API code generation (`get-openapi`, Orval, generated formatting and drift check) when the current workflow runs it unconditionally or a changed-path trigger applies; run workflow UI checks and Storybook tooling/build when their triggers apply. Documentation changes that trigger Storybook require both docs-tooling Jest and the Nx Storybook build. Run publishable-package checks when triggered.
- Run `tools/admin-env-wizard` Go catalog and generator tests, inventory generation, and deployment/Compose parity validation when triggered by the current workflow. Record advisory `continue-on-error` failures as advisory; do not modify unrelated baseline failures to manufacture a pass.
- Build and inspect the changed local images and actual service closure before runtime E2E. No image publishing or production deployment.
- After a cross-stack checkpoint, `pnpm run build:dev` must complete. Capture source identity, exact commands, exit codes, logs/hashes, skipped/not-run checks and independent review.

## Baseline

At source `6fc407676`, frozen installation, migration governance, migration setup contract, all 39 workflow E2E contracts and Nx project graph pass. Private logs: `.runtime-artifacts/account-rights/pre-e2e-baseline/`. These baseline checks do not validate future implementation.

### J4 — Current Profile entity capture and legacy inventory guard

[Finding](../release-readiness/findings/DF-007-J4.md) and [receipt](../release-readiness/evidence/df-007/checkpoint-j4.json): same-snapshot identity/current-entity capture, bounded full text, inline PNG/JPEG bytes and guardian role privacy have local PostgreSQL proof (ten enabled cases). The actual initial migration retains goal/project stores and timeline links absent the entity catalog; owned unsupported legacy data rejects capture. Legacy adapters and remote snapshot transport remain next, followed by other owners/media/artifact/deletion/shared controls. No Profile job route or download/deletion is enabled.
