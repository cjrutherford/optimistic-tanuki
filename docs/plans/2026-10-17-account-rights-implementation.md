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

This is not a complete Social/account inventory, portable export/download or deletion implementation. No schema, public route, new participant/configuration entry, UI, or provider operation was added. Keep remaining stores, other participants, portable media, durable orchestration, providers/backups, deletion and account-wide readback in the broader DF-007 work. The next baseline fix is target-scoped `cache: false` for Authentication E2E, addressing the demonstrated Nx cached-output/live-database mismatch.

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
- OpenAPI/Orval drift check for API/model changes; workflow UI heuristics/personality checks; Storybook tooling/build and publishable-package checks when their workflow triggers apply.
- Build and inspect the changed local images and actual service closure before runtime E2E. No image publishing or production deployment.
- After a cross-stack checkpoint, `pnpm run build:dev` must complete. Capture source identity, exact commands, exit codes, logs/hashes, skipped/not-run checks and independent review.

## Baseline

At source `6fc407676`, frozen installation, migration governance, migration setup contract, all 39 workflow E2E contracts and Nx project graph pass. Private logs: `.runtime-artifacts/account-rights/pre-e2e-baseline/`. These baseline checks do not validate future implementation.
