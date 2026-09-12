# Store and Blogging Catalog Context Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add first-class, authenticated catalog contexts for Store products and Blogging blogs so configurable features can safely select tenant-owned resources.

**Architecture:** Each service gains a small `Catalog` aggregate with `ownerId`, `workspaceId`, and `appScope`, a title and optional description. Existing `ProductEntity` and `Blog` records gain nullable `catalogId` references; no legacy record is copied or backfilled. Gateway endpoints require a business-site workspace slug and derive the canonical owner/profile, workspace and app scope through `WorkspaceContextGuard`, then send that trusted context to the owning service. The existing broad product/blog routes remain compatibility surfaces but are not used for configuration selection.

**Tech Stack:** NestJS microservices, TypeORM/PostgreSQL, shared DTO and command libraries, Nx/Jest.

---

## Implementation status — 2026-08-22

Completed:

- Store catalog persistence and `Product.catalogId`, generated as `1787432181448-add-store-catalog.ts` and applied after the existing Store migration history.
- Blogging catalog persistence and `Blog.catalogId`, generated as `1787432217599-add-blog-catalog.ts` and applied after the existing Blogging migration history. This migration also reconciles previously un-migrated `appScope` columns and the existing `blog_components` constraint/index naming drift.
- Deterministic Store and Blogging migration-generation targets: the full TypeORM argument string is placed before `-d`, and each target pins its owning database.
- Trusted Store and Blogging catalog create/list routes, shared command exports, and catalog-aware public Store product filtering.
- Store Client supports `/catalog?catalogId=<id>` while retaining unfiltered product browsing for compatibility.

Verified:

- `pnpm run db:setup` applied both migrations successfully.
- `pnpm run validate:typeorm-migrations` passed.
- `nx test store` passed (16 suites, 71 tests), `nx test store-client` passed, and `nx test gateway --runInBand` passed (62 suites, 661 tests).

Completed consumer work:

- Owner Console product management loads the workspace-scoped Store catalog list, persists the selected `catalogId`, and sends the workspace slug with catalog-bound writes; the Gateway verifies the catalog belongs to that resolved workspace.
- Business Site persists a Gateway-verified Store catalog ID and scopes its public landing and product-detail queries to it.
- App Configurator loads workspace-owned Blog catalogs and persists `blogging.posts` as a `blog-catalog` resource reference with a `catalogId` policy. The shared-canvas adapter preserves that manifest through section edits.
- Blog queries now accept `catalogId`. There is no public Blog feature shell in the Business Site surface yet; rendering that saved resource reference belongs to the Slice 13 runtime pilot rather than an invented parallel UI.

---

### Task 1: Define catalog contracts and metadata

**Files:**

- Create: `libs/models/src/lib/libs/store/catalog.dto.ts`
- Create: `libs/models/src/lib/libs/blog/catalog.ts`
- Modify: `libs/models/src/lib/libs/store/index.ts`
- Modify: `libs/models/src/lib/libs/blog/index.ts`
- Modify: `libs/constants/src/lib/libs/store.ts`
- Modify: `libs/constants/src/lib/libs/blog.ts`
- Modify: `libs/configurable-plugin-contracts/src/lib/configurable-plugin-contracts.ts`
- Test: `libs/configurable-plugin-contracts/src/lib/configurable-plugin-contracts.spec.ts`

**Step 1: Write failing contract tests.**

Assert `store.catalog` requires a `catalogId` policy and refers to `store-catalog`; assert `blogging.posts` refers to `blog-catalog` and the manifest validator accepts those declared resource types.

**Step 2: Run the focused contract test.**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run configurable-plugin-contracts:test`

Expected: FAIL because the catalog context contract does not yet exist.

**Step 3: Add the DTOs and commands.**

Expose `CreateStoreCatalogDto`, `StoreCatalogDto`, `FindStoreCatalogsDto`, `CreateBlogCatalogDto`, `BlogCatalogDto`, and `FindBlogCatalogsDto`. Both find DTOs carry trusted `ownerId`, `workspaceId`, and `appScope`; the browser never supplies these through a public gateway route.

**Step 4: Run the focused contract test.**

Expected: PASS.

### Task 2: Add Store catalog persistence and scoped list handler

**Files:**

- Create: `apps/store/src/catalog/entities/catalog.entity.ts`
- Create: `apps/store/src/catalog/catalog.service.ts`
- Create: `apps/store/src/catalog/catalog.controller.ts`
- Create: `apps/store/src/catalog/catalog.service.spec.ts`
- Modify: `apps/store/src/products/entities/product.entity.ts`
- Modify: `apps/store/src/app/app.module.ts`
- Modify: `apps/store/src/app/staticDatabase.ts`

**Step 1: Write failing service tests.**

Assert the finder only returns catalogs with matching `ownerId`, `workspaceId`, and `appScope`; assert a created catalog receives the trusted scope tuple.

**Step 2: Run the test to verify it fails.**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run store:test --testPathPattern=catalog.service.spec.ts`

Expected: FAIL because Store has no catalog handler.

**Step 3: Implement the entity, handler and registration.**

Use a `store_catalogs` table. Add nullable `catalogId` to `ProductEntity`; do not alter existing product ownership behavior.

**Step 4: Generate the migration with the service target.**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run store:typeorm:migration:generate --args='migrations/add-store-catalog'`

Review the generated SQL before applying it.

**Step 5: Run focused Store tests.**

Expected: PASS.

### Task 3: Add Blogging catalog persistence and scoped list handler

**Files:**

- Create: `apps/blogging/src/app/entities/blog-catalog.entity.ts`
- Create: `apps/blogging/src/app/services/blog-catalog.service.ts`
- Create: `apps/blogging/src/app/controllers/blog-catalog.controller.ts`
- Create: `apps/blogging/src/app/services/blog-catalog.service.spec.ts`
- Modify: `apps/blogging/src/app/entities/blog.entity.ts`
- Modify: `apps/blogging/src/app/entities/index.ts`
- Modify: `apps/blogging/src/app/controllers/index.ts`
- Modify: `apps/blogging/src/app/services/index.ts`
- Modify: `apps/blogging/src/app/app.module.ts`
- Modify: `apps/blogging/src/app/staticDatabase.ts`

**Step 1: Write failing service tests.**

Assert the list uses all three trusted scope fields and cannot return another tenant's catalog.

**Step 2: Run the test to verify it fails.**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run blogging:test --testPathPattern=blog-catalog.service.spec.ts`

Expected: FAIL because Blogging has no catalog handler.

**Step 3: Implement the aggregate and link.**

Use a `blog_catalogs` table and a nullable `catalogId` relation on `Blog`. Existing `Blog.ownerId` and `Blog.appScope` stay intact to preserve direct blogging behavior.

**Step 4: Generate the migration with the service target.**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run blogging:typeorm:migration:generate --args='migrations/add-blog-catalog'`

Review the generated SQL before applying it.

**Step 5: Run focused Blogging tests.**

Expected: PASS.

### Task 4: Expose trusted gateway selection routes

**Files:**

- Modify: `apps/gateway/src/controllers/store/store.controller.ts`
- Modify: `apps/gateway/src/controllers/store/store.controller.spec.ts`
- Modify: `apps/gateway/src/controllers/blogging/blog.controller.ts`
- Modify: `apps/gateway/src/controllers/blogging/blog.controller.spec.ts`

**Step 1: Write failing gateway tests.**

Assert `GET /store/catalogs/mine?workspaceSlug=...` and `GET /blog/catalogs/mine?workspaceSlug=...` require authentication, a resolved business-site workspace, and catalog-view permissions. Assert they send `{ ownerId: workspace.ownerProfileId, workspaceId: workspace.workspaceId, appScope: workspace.appScope }` to their services. Assert no query/body supplied owner id changes that payload.

**Step 2: Run the focused gateway tests.**

Expected: FAIL because the routes do not exist.

**Step 3: Implement minimal guarded routes.**

Use `AuthGuard`, `WorkspaceContextGuard`, `PermissionsGuard`, and the resolver-provided workspace identity; reject an absent/mismatched workspace scope rather than silently falling back to a global scope. Add guarded create routes with the same context.

**Step 4: Run gateway and service targets.**

Expected: PASS.

### Task 5: Verify migration and package closure

**Files:**

- Modify: `docs/reports/configurable-platform-program/index.html`

**Step 1: Run migration validation against fresh databases.**

Run: `pnpm run validate:typeorm-migrations`

Expected: generated Store and Blogging migrations are valid and reversible.

**Step 2: Build affected services.**

Run: `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx run-many -t build -p store,blogging,gateway,configurable-plugin-contracts`

Expected: PASS.

**Step 3: Update the tracker.**

Record the catalog capability, migration IDs, trusted-route behavior, and verification status in Slice 10. Mark it complete only after focused tests, builds, and migration validation pass.

### Task 6: Make product applications catalog-aware

**Implementation status — 2026-08-23:** Completed. The Owner Console Business Site catalog-governance screen, product management catalog assignment, Business Site public Store queries, and Store Client all use the selected Store catalog. Catalog-bound product writes carry the workspace slug and are rejected unless the Store catalog is owned by the resolved owner/workspace/app scope. App Configurator selects workspace-owned Blog catalogs, persists `blogging.posts` as a versioned `blog-catalog` resource reference with `catalogId` policy, and retains that manifest during canvas edits. Blog queries accept `catalogId`; public Blog rendering is explicitly deferred to Slice 13 because no existing Business Site Blog shell exists.

**Files:**

- Modify: `apps/owner-console/src/app/services/store.service.ts`
- Modify: `apps/owner-console/src/app/components/product-management.component.ts`
- Modify: `apps/owner-console/src/app/components/product-management.component.html`
- Modify: `apps/owner-console/src/app/components/product-management.component.spec.ts`
- Modify: `apps/store-client/src/app/services/store.service.ts`
- Modify: `apps/store-client/src/app/pages/catalog/catalog.component.ts`
- Modify: `apps/store-client/src/app/pages/catalog/catalog.component.spec.ts`
- Modify: `apps/business-site/src/app/...` (the existing configurable feature-shell consumer)

**Step 1: Write failing consumer tests.**

Assert owner product management loads the workspace-scoped catalog list and saves a selected `catalogId`; assert public catalog rendering receives a configured catalog reference and does not use an arbitrary owner id.

**Step 2: Implement typed clients and UI state.**

Add typed `listMyCatalogs(workspaceSlug)` calls for the owner/configurator surface, a catalog picker to product management, and a catalog-aware public product query. Retain the ungrouped-products view as an explicit compatibility/default option.

**Step 3: Run Store client and owner-console tests.**

Expected: PASS.

### Task 7: Make blogging applications catalog-aware

**Files:**

- Modify: the existing blog authoring/configurator consumer when located during Task 6
- Modify: `apps/owner-console/src/app/components/app-config-designer/app-config-designer.component.ts`
- Modify: `apps/owner-console/src/app/components/app-config-designer/app-config-designer.component.html`
- Modify: corresponding component specs
- Modify: the public business-site blogging feature shell when located during Task 6

**Step 1: Write failing consumer tests.**

Assert configuring `blogging.posts` selects a `blog-catalog` reference returned by the workspace-scoped API, and persisted manifest settings use `catalogId` rather than the removed `collectionId`/unscoped blog selector.

**Step 2: Implement the picker and rendering query.**

Keep direct blog authoring and legacy public routes intact; the new catalog context only becomes required for the configurable feature flow.

**Step 3: Run affected application tests and focused browser validation.**

Expected: PASS.
