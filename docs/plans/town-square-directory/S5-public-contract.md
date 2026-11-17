# S5 directory API and business-page linkage

Status: in progress, local evaluation only. The local endpoint is an interim contract, not a public-release approval. The user authorized tailnet access for local evaluation; unverified town assignments, screened source records and required notices retain their existing restrictions.

## First increment

`GET /api/directory/towns/:townId/local-evaluation-listings` accepts `offset`, text query `q`, explicit visitor opt-in `adult=1`, and an optional exact `category` identifier. The category is a lowercase source identifier made of letters, digits and underscores, limited to 100 characters. Invalid or repeated internal parameters are rejected; omitting category includes all permitted categories. Existing authority, town eligibility, source-policy, withdrawal, assignment-token and adult filters remain in force before pagination.

The response contains up to 25 permitted listings and `hasMore`. Coordinates are returned only for listings with a reviewed business address. This endpoint does not grant ownership, identify an owner or link to a business page. Offset pagination remains available for the current town UI.

An optional `pagination=cursor` mode returns `nextCursor` (or `null` at the end); the next request supplies that value as `cursor` with the same town, search, category and adult choice. Cursor mode cannot be combined with a nonzero offset. Tokens are encrypted and authenticated, expire after 15 minutes, bind the current Social town change token and query filters, and use immutable source-row keys rather than the mutable reviewed-first order. Rights and withdrawal checks run again for each page. This is keyset pagination, not a frozen snapshot: a newly inserted row ordered before the current cursor may only appear after restarting from the first page. Production policy-generation binding and full concurrent-update qualification remain open.

Cursor-mode entries include an opaque `reference` usable for 15 minutes at `GET /api/directory/towns/:townId/local-evaluation-listings/:reference`. It is encrypted, bound to the town, Social change token and visitor adult choice, and is neither a canonical business identifier nor an ownership claim. Detail rechecks current town eligibility, policy, scan and row withdrawal, assignment token and field projection. Missing, revoked, tampered, expired or wrong-town references return 404; operational failures remain 503. A rolled-back local PostgreSQL check verified a valid detail, wrong-town rejection and row-withdrawal hiding. Stable canonical identities and owner-managed page linkage remain open.

Cursor requests may include `bounds=west,south,east,north` in WGS84 decimal degrees. Each non-wrapping axis may span at most two degrees. Bounds are tied to the cursor, and only entries with a valid reviewed business address can match; rights, visitor choice and town authority are rechecked. Pagination and `hasMore` are calculated after address validation and spatial filtering, so unreviewed locations cannot be inferred from the result. Candidates come from a reviewed-address spatial projection (`directory_reviewed_spatial`, a candidate index only): every rule is re-checked against the live binding, lease, policy, revocation, content digest and assignment in the same statement, so a stale or extra projection row cannot disclose a location and a missing one only hides it. There is no candidate cap and no candidate count is returned or logged; each page is one statement under a 2 s timeout, and a timeout is a 503, never a short page. While the projection is not ready (no completed rebuild, a validator-version mismatch, or an active reviewed binding without a row) bounds requests answer 503 and non-bounds listings are unaffected. Non-snapshot cursor semantics apply: between pages a withdrawn row disappears, a newly confirmed row ordered after the cursor appears, and one ordered before it appears only on a restart; `hasMore=true` may be followed by an empty last page with `nextCursor=null`. Live tailnet checks returned one reviewed Valdosta location, zero in a distant area and HTTP 400 for invalid bounds.

The local listing and page shapes are shared through `@optimistic-tanuki/social-contracts` and used by the gateway and Local Hub. The town page distinguishes a failed request from an empty result and offers retry, including when loading a later page. A browser-only simulated network failure showed the error and retry restored 25 listings. This does not yet establish acquiring, partial, stale or policy-blocked source states.

Cursor results also include a stable random `id` for the exact town and imported source row. The mapping is persisted in Directory; `GET .../local-evaluation-listings/:id` resolves it only after the current eligibility, source-policy, withdrawal and visitor-choice checks. The ID is not evidence of ownership. When a business is carried to a later source release (an equal keyed upstream id in the same town, unambiguous, run as an operator step before the old release is revoked), the listing `id` becomes the stable business id, an `id` issued earlier for a row of that business keeps resolving to the new row and returns the canonical id in the body, and merges, splits and retirement are reviewer-only. Every other row keeps a row-scoped `id`; clients cannot tell the two apart. An id that is retired, absent, unresolved, ambiguous, unknown or in another town returns the same 404, with no redirect and no reason. Reviewed fields are served only through the resolved row's own active binding, so an id never surfaces fields reviewed for a previous release. Cursors and references remain short-lived and row-keyed, and are bound to a serving generation (the set of live policies), so any issued before a release cutover are rejected and the client restarts. Two live reads returned the same ID, detail returned HTTP 200, and a different eligible town returned HTTP 404. The new migration was generated by the Directory Nx target, applied to a fresh disposable database and the local stack, and validated with the repository migration checker.

## Remaining S5 work

- Production-qualified shared contracts and projection, including rights notices. Source freshness shipped as a label (below); rights notices remain.
- Production spatial indexing and map integration; cross-release canonical business identities and cursor pagination with full concurrent-update tests.
- Explicit empty, acquiring, partial, blocked and failure states, with a policy-aware cache and withdrawal/correction invalidation. (Staleness is now the `sourceFreshness` label below; it is label-only and never hides listings.)
- Explicit linkage to owner-managed business pages without inferring ownership from a source identifier; preserve existing commerce authorization and routes.
- Cross-town and privacy/scope tests, real service and gateway requests, and compatibility/security review. Public exposure still requires the agreed boundary, source authority and quality controls.

## Business-page linkage implementation in progress

The local link path records an authenticated page owner's request, a separate owner-console review decision and owner revocation with an audit event for each transition. A unique active-listing constraint prevents two approved pages for one listing. Before request and review, the gateway checks the current Payments owner and Social page visibility. A public link read rechecks both and projects only the public community ID, slug and name; owner and subscription fields are not returned. Directory rechecks listing visibility and visitor choice. A dedicated secret keeps the internal link transport separate from listing reads.

The additive migration and link path are enabled in the local stack. A synthetic, temporary real-service exercise passed owner request, authorized reviewer approval, public allowlisted projection, owner revocation and audit checks; a non-reviewer received HTTP 403. Synthetic records were removed afterward. Local Hub offers owners a request and withdrawal flow; Owner Console provides a paginated town review queue and comparison screen. Focused UI, gateway, Directory and PostgreSQL tests passed. Authenticated Tailscale browser verification also passed owner request, reviewer comparison and approval, visible link, owner removal and three audit actions using temporary synthetic records, which were removed. The two app-scoped sessions were exercised in separate browser profiles because cookies are shared across ports on the same hostname. Withdrawal races, deletion/export lifecycle integration and production qualification remain open.

## Business-page linkage investigation

Payments identifies an owner-managed `BusinessPage` by its Social community ID and stores an `ownerId` and subscription-related fields on the entity. Its existing public `GET /api/payments/business/:communityId` gateway route can return or spread the Payments entity, so S5 must not forward that object wholesale into a directory listing. A source name, URL, provider ID or geographic match is not proof that a person owns a business page. The local association verifies platform page ownership, requires an independently recorded review action, supports audited owner revocation and returns a public allowlist. Existing commerce routes and permissions remain in place; the owner and reviewer may still be the same person if they possess both roles.

## 2026-11-15 safety continuation

The five known wrong-town reviewed addresses and map entries were withdrawn from
the local stack with retained audit evidence. The remaining published sample has
not passed the full-frame quality review. Publication is paused: town containment,
precision review and unresolved candidate identities remain open. Published-row
revocation and an atomic publication transaction have focused database tests;
the reviewer UI still needs an authenticated live browser exercise. The current
local stack uses incrementally updated images, not a clean Dockerfile build.

The local two-reviewer full-frame gate was subsequently waived by the user for
local evaluation only; this does not establish a measured quality pass or permit
public release. The 23 unresolved historical address candidates were archived
with their audit history and remain unanchored. Publication still remains paused
while precision and source/serving integration are incomplete.

The publisher now checks current review policy and official-evidence age,
requires its contact fields to match the reviewed candidate, and validates both
the geocoded address and source map point against a current verified town
boundary or an explicitly pinned local Census place candidate. Verified boundary
records are locked and rechecked in the publication transaction; new reviewed
rows carry the checked town-assignment token. Contact-stage lookup also rejects
ambiguous keys and revoked source records. These are local safety controls, not
proof of cross-release identity, snapshot pagination, production freshness, or
account lifecycle coverage.

## Reviewed fields require an active source binding (2026-11-15)

A listing's reviewed address, website, phone, attribution, notices and coordinates,
and its place in bounds results, are served only while it has a binding in state
`active` whose lease is current (`verifiedUntil > now()`). The test is made in
SQL before pagination, so `hasMore` and cursors are computed after it, and the
listing, detail and identity routes share it. A row that carries `reviewed` data
without a qualifying binding is returned as an unreviewed listing: no address,
phone, website or reviewed coordinates, and not in bounds results. A binding
that is suspended, expired, retired, still pending, or a legacy record with no
recorded provenance is treated the same way.

A binding is created `pending` when a publication commits. A confirmation step
reads the contact stage again and only then makes it `active` with a lease. A
revalidation sweep extends the lease while the stage still holds the same
content. It retires the binding and removes the reviewed fields when the stage
withdraws the scan, row or policy or the live row is withdrawn, and suspends it
when the row is missing, its content changed, a newer scan changed it, or the
live reviewed fields no longer match. If the stage cannot be read the sweep
changes nothing and does not extend the lease, so reviewed fields disappear on
their own at expiry. Corrected values are never copied across; a suspended
binding is resolved by re-review, or retired after the suspension timeout.
Publications from a plain source file are recorded but never become active.
The 48 publications that predate bindings are recorded as `unknown_legacy`,
suspended, and therefore hidden until re-reviewed. `/health/ready` reports the
binding counts (expired leases, suspended, pending, active) without failing on
them. See [the design](S5-item4-source-binding-design.md).

## Source freshness label (shipped, publication still paused)

Local listing pages carry an optional `sourceFreshness` object: `{state, releaseId, sourcePublishedAt, acquiredAt, thresholds:{freshDays:90, staleDays:120}}`.

- `state` is `fresh` (under 90 days), `due` (90 to 120 days inclusive), `stale` (over 120 days) or `unknown`. It is computed at read time from the upstream `Last-Modified` of an ETag-verified response and is never stored.
- Worst wins across the completed, policy-active scans serving the town, and `unknown` dominates. Scans with no evidence, a hash mismatch, a null or future date read `unknown`; `releaseId`, `sourcePublishedAt` and `acquiredAt` are null in that case.
- The label never filters, reorders or empties a page, and detail lookups carry `unknown`. `/health/ready` reports counts under `sourceFreshness` and its status is unaffected.
