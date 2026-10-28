# O09 — Classifieds account-data policy for OT and Towne Square

The exact delivery is **O09-P → O09-C → O09-I**. This work covers only Optimistic Tanuki (`client-interface`) and Towne Square (`local-hub`). Towne Square's city/community listing pages and forms call the shared `classified-ui` service, `/api/classifieds`, the authenticated Gateway producer, and Classifieds storage. No Classifieds consumer in the OT client has been established; allowing its explicit scope does not claim that UI exists. Other products and other owner IDs are outside this delivery.

## Ownership and product boundary

The Gateway create producer binds `userId` to the authenticated account, `profileId` to the selected profile, and `appScope` to the resolved request scope. The account and profile identity domains are distinct. Capture selects only rows whose recorded account matches the authenticated account **and** whose stored scope is exactly `client-interface` or `local-hub`. It never selects another product's rows, even when the account owns them.

Every candidate must have a profile identity in the captured current Profile snapshot. A scoped account-owned row with an unproven profile binding fails capture; it is not silently omitted or counted as empty complete coverage. Foreign-account rows are excluded even if their profile field matches a captured profile. Seed placeholders do not establish ownership. Current matching proves eligibility for this capture, not historical authorship, consent, current community membership or sole ownership of shared content.

## Field and store disposition

`ClassifiedAdEntity` has eighteen mapped columns and no ORM relations. The safe projection contains the listing ID, recorded subject account/profile IDs, allowed app scope, inert title and description, price as a bounded exact decimal string, currency, category, condition, recorded status, promotion flag and timestamps, and optional expiry. All historical statuses are retained. Optional community IDs are opaque references: no community, member, buyer, seller enrichment, transaction or moderation record is fetched.

Raw `imageUrls` are excluded from capture SQL and output. A row carries an explicit `excluded-unverified-image-references` media disposition. URL possession and listing association do not prove asset ownership or authorize image bytes. The Assets owner is separately responsible for proven owned media; this slice does not close portable-media coverage.

Text and numeric values are bounded before buffering and validated before output. Malformed or over-limit values fail capture rather than producing a truncated success. PostgreSQL timestamp microseconds and timezone instants must survive projection. Each receipt carries `attribution: recorded-unverified` and `consent: not-inferred`.

The machine inventory must reconcile the actual registered entity and every migrated physical column, plus migration bookkeeping. Migration bookkeeping and configuration/credentials are excluded. Account-identifiable process output is excluded from ordinary snapshots, with log sinks and retention left explicit under N04. No queue, search index, buyer store or object store is invented without producer/storage evidence.

## Acceptance and limits

O09-P needs matching offline ORM metadata and a read-only fresh migrated catalog. O09-C needs real paged, bounded reads proving both allowed scopes, exclusion of other applications and foreign accounts, profile-binding failure, scalar/media exclusions and integrity. O09-I needs Profile-bound leased capture in the job, failure-prefix/retry, session and lease denial, restart invalidation and independent data/resource cleanup.

Policy and unit tests alone do not accept O09. The overall export remains incomplete, with no downloadable artifact or deletion promise. This read-only capture does not implement Classifieds deletion or change listing CRUD, visibility or UI.

## D16 local erasure qualification

Erasure requires the authenticated deletion account, frozen current profile binding and explicit client-interface/local-hub scope. Counterpart and out-of-release listings are preserved. Image pointers do not authorize deleting media in another owner. The operational fence is excluded from portability. See [the owner finding](./findings/DF-007-D16.md) for real database/TCP evidence and its limits. Full-account coordination remains later work.
