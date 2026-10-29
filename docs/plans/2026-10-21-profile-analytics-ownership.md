# J19 — ProfileView attribution and private analytics

J19 follows J18 in the explicit remaining-slice register. The Gateway currently trusts a browser-supplied viewer UUID, allows authenticated callers to query any profile's analytics, and exposes counterpart viewer identities through Social responses. The HAI privacy philosophy provides no basis for named-viewer disclosure; the product documentation promises view counts and analytics, not named viewers.

## Decisions

Record new views using the authenticated account UUID from `@User().userId`, overriding the legacy body `viewerId`. A person can record a view of another profile; recording does not require owning that target. Validate and canonicalize account and target UUIDs. Keep the legacy body field compatible but document that it is ignored.

Require actual account/profile ownership for both analytics GET routes through J18's narrow Profile ownership command. Do not equate account and selected-profile UUIDs, trust an old signed profile claim as current ownership, or invent an appScope alias rule. Bind the exact canonical response to the request, require `owned: true`, and bound the lookup to three seconds. Invalid principals fail with 401, invalid inputs with 400, foreign/missing profiles with 403, and unavailable or malformed ownership proof with 503, before querying Social.

Social returns aggregates and timestamp-only recent-view projections. It must not return viewer IDs, stored row IDs, target IDs or raw source strings in recent views. Keep the existing route names and timestamp shape; do not infer viewer consent. Source categories are limited to `direct`, `profile`, `search`, `feed` and `other`; map unknown new and legacy values to `other`. Keep existing count windows and the newest-100 source summary; do not advertise that source summary as all-time. Query only needed fields and deterministically bound recent-view lists to 1–100 rows (default 10). Canonical queries include legacy uppercase target UUID strings. A write returns an acknowledgement rather than the stored entity.

These are prospective attribution rules. Existing viewer UUIDs may be spoofed or profile/account ambiguous; do not rewrite them or treat them as proven account ownership. Their account-export disposition remains J23/J24. Internal TCP callers retain their existing trusted-service boundary. No schema, migration or UI component is added. Update the existing client wrapper's response types to match the reduced projection; generated clients remain untouched and legacy request bodies remain accepted.

## Ownership and checks

The Gateway worker owns the analytics controller and a focused controller spec. The Social worker owns the analytics service and a focused service spec. Root owns this plan, client wrapper types, private E2E/runtime and release findings. Use two flat Luna workers, the current checkout, and preserve the 43 protected Directory/configuration paths.

Run narrow regression tests and production builds/lints for Gateway and Social, then changed E2E lint and a client production build/lint for the wrapper type change. Use Node 24, pnpm and `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`. Do not rerun unchanged worker checks. A real private Auth/Profile/Social test must prove body spoof override, secondary-profile ownership across bearer/cookie sessions, foreign analytics denial, exact timestamp/source projection, legacy UUID handling, invalid limit denial and unchanged counterpart rows. Record exact cleanup readbacks and zero private resources. The HTTP harness hosts production Gateway controllers/guards; it does not qualify a full Gateway deployment or browser journey.

Record failures, skips, image/source identities and checks not run. Synchronize the finding, receipt, master audit, execution map, completion map and register only after runtime acceptance. J20 Presence audience is next; DF-007 and RR-11 stay open.

## Local result — 2026-10-21

J19 is locally verified at the bounded private runtime scope. The [finding](../release-readiness/findings/DF-007-J19.md) and [receipt](../release-readiness/evidence/df-007/checkpoint-j19.json) record 22 focused unit tests, production/client gates, the repaired attempt-1 timestamp fixture mismatch, one passing private Auth/Profile/Social Gateway case, exact source/image provenance, zero fixture readbacks and private teardown. J20 Presence audience binding is next; DF-007 and RR-11 remain open.
