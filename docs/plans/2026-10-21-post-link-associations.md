# J22 — Post/Link associations

J22 follows locally accepted J21 at `2a50327d57fddac94ac1c003a501aa2675010c11`. Post and Link declared a many-to-many relationship without an owning join table, Link creation ignored its required post ID, and list reads replaced links with an empty array.

## Decisions

Post owns an explicit `post_link` junction with UUID post IDs, integer link IDs and a composite primary key. Generate the migration through Social's Nx target, preserve its CLI timestamp, review its SQL and exclude unrelated pre-existing election drift. No historical associations or authorship are invented. Apply migrations to a fresh private PostgreSQL 15 database and verify the new migration's down/up behavior.

Internal link creation requires an explicit account/profile actor and a matching owned Post, with transactional association creation. Link URLs accept HTTP(S) without credentials. Shared Link rows are immutable through the service; arbitrary post `links` mass assignment is ignored. Visible post list reads load the relation without traversing inverse post content. The Link command now requires `{ dto, actor }`; there are no checked-in public Gateway Link callers.

The existing partial Social preview captures at most 1,000 associations selected only through proven-owned Post IDs in batches of 100. Validate returned membership, IDs, app scope, URLs and duplicates. Emit ordinary link URLs or opaque asset IDs with `referenceOnly: true`; no asset ownership, consent, downloadable bytes or storage location is implied. Standalone legacy Links and foreign Post content are excluded. The full authored-content capture remains J24-A.

## Ownership and verification

Flat Luna workers own implementation and focused coverage; root owns migration generation, SQL review, private PostgreSQL integration, final corrections and documentation. Preserve all 43 excluded Directory/root Compose/tsconfig paths. Work in the current checkout with no nested delegation or worktrees.

Run focused Social tests, production build/lint, migration validation and a real migrated-database case. The runtime fixture uses controlled Auth/Profile ownership replies to isolate the Social association boundary; it does not claim a live authentication or browser flow. Compare all public table counts before and after fixture cleanup, then remove private resources. Record failed attempts and limits before acceptance. J23 disposition follows J22; full Social capture, download artifacts and deletion remain later work.

## Local result

Locally verified: 66 focused tests, owning production gates, migration validation and one fresh PostgreSQL case passed. All 27 migrations applied and the new migration reverted/reapplied; 35 table counts matched after cleanup and private resources were zero. See the [finding](../release-readiness/findings/DF-007-J22.md) and [receipt](../release-readiness/evidence/df-007/checkpoint-j22.json). J23 follows.
