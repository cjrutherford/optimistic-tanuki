# R5 Scoped Feature Delivery Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan slice-by-slice.

**Goal:** Turn Store, Blog, Forum, and Social from workspace-aware shells into genuinely scoped, owner-authorable product features with public parity and two-owner denial proof.

**Architecture:** Treat a resolved workspace as the only authority boundary. Gateway derives owner/profile/workspace context from the cookie session and validates all supplied selectors against it; feature services persist workspace identity where the domain needs it. Feature UI libraries own authoring controls and product data access, while Business Site configuration stores only selected, already-authorized resource references.

**Tech Stack:** Angular standalone components and signals, NestJS Gateway and microservices, TypeORM migrations through owning Nx targets, PostgreSQL, Jest/Nx, live Docker stack, agent-browser.

---

## Delivery slices

### R5.1 — Catalog persistence readiness

**Status:** Complete — Store and Blogging migration-run targets reported no pending migrations, `validate:typeorm-migrations` passed, and the shared runtime PostgreSQL contains both catalog tables.

**Purpose:** Make the existing Store and Blog catalog metadata usable in the live stack before exposing authoring.

**Files:**

- Verify: `apps/store/migrations/1787432181448-add-store-catalog.ts`
- Verify: `apps/blogging/migrations/1787432217599-add-blog-catalog.ts`
- Verify/modify only if generated metadata requires it: `apps/store/project.json`, `apps/blogging/project.json`

**Acceptance:** All earlier migrations have run; each owning migration target applies its generated catalog migration to a fresh DB; `pnpm run validate:typeorm-migrations` passes; live catalog tables exist. No hand-written migration files.

### R5.2 — Store product authority boundary

**Status:** In progress — authority routes and the Store authoring scope adapter are covered by focused tests; Business Site configuration binding and two-owner proof remain.

**Files:**

- Modify: `apps/gateway/src/controllers/store/store.controller.ts`
- Modify: `apps/store/src/products/products.controller.ts`
- Modify: `apps/store/src/products/products.service.ts`
- Test: corresponding Gateway and Store controller/service specs

**Acceptance:** list, read, create, update, and delete derive and validate workspace/owner scope; public reads require the selected catalog; foreign product/catalog reads and writes are denied.

### R5.3 — Blog post authority boundary

**Status:** In progress — workspace scope now propagates through Gateway and Blogging commands, and generated migration `1787611497663` persists `Post.workspaceId`; catalog association, public parity, and two-owner proof remain.

**Files:**

- Modify: `apps/gateway/src/controllers/blogging/blog.controller.ts`
- Modify: `apps/gateway/src/controllers/blogging/post.controller.ts`
- Modify: `apps/blogging/src/app/services/post.service.ts`
- Test: corresponding Gateway and Blogging specs

**Acceptance:** catalog and post CRUD use canonical workspace context; public posts are resolved only from the selected published catalog; foreign reads/writes are denied.

### R5.4 — Store authoring and Business Site binding

**Status: in progress.** The Configurator-hosted Business Site editor now loads only Store catalogs resolved for its business-site workspace, writes the selected catalog to the canonical `serviceCatalog.catalogId`, and the Gateway revalidates that ID against the trusted workspace before saving. Persistence/reload and public storefront proof remain.

**Files:**

- Create/modify: `libs/store-data-access/**`
- Modify: `libs/store-ui/src/lib/authoring/store-authoring-shell.component.ts`
- Modify: `libs/business-data-access/src/lib/business-site.config.ts`
- Modify: `libs/business-public-ui/src/lib/business-landing-page.component.ts`

**Acceptance:** owner creates/selects one catalog and a product from Configurator; selected catalog persists to the resolved Business Site configuration; public storefront renders only that catalog after reload.

### R5.5 — Blog authoring and Business Site binding

**Status: in progress.** The same editor now loads scoped Blog catalogs and writes the selected reference to `plugins.capabilities['blogging.posts'].resourceRef` with the public-content placement. The Gateway rejects foreign catalog IDs before persistence. Published landing/direct-route parity and two-owner proof remain.

**Boundary note:** generic `/api/app-config/:id` manifests still do not carry trusted workspace context, so catalog-backed Business Site references must remain writable through the Business Site save boundary until that general contract is extended and equivalently validated.

**Files:**

- Use: `libs/blogging-data-access/**`
- Modify: `libs/blogging-ui/src/lib/authoring/blog-authoring-shell.component.ts`
- Modify: `libs/business-data-access/src/lib/business-site.config.ts`
- Modify: `libs/business-public-ui/src/lib/business-blog-page.component.ts`

**Acceptance:** owner creates/selects a collection and publishes a post in Configurator; selection persists; landing placement and `/sites/:siteSlug/blog` agree after reload.

### R5.6 — Forum workspace model and authoring

**Files:**

- Modify entity metadata under `apps/forum/src/entities/`
- Generate migration via `pnpm exec nx run forum:typeorm:migration:generate` after applying prior migrations
- Modify: `apps/gateway/src/controllers/forum/forum.controller.ts`
- Modify: `libs/forum-ui/src/lib/forum-ui/authoring/**`

**Acceptance:** Forum topics/reads/writes carry workspace identity, an owner can enable one placement, and owner/member/anonymous behavior is enforced and tested.

### R5.7 — Social workspace feed and moderation action

**Files:**

- Modify: `apps/gateway/src/controllers/social/social.controller.ts`
- Modify: `apps/gateway/src/controllers/social/community/community.controller.ts`
- Modify: `libs/social-ui/src/lib/social-ui/authoring/**`

**Acceptance:** workspace-scoped social feed authoring is real; owner/moderator takes one scoped moderation action; post/comment cross-workspace routes are denied.

### R5.8 — Feature pilot and two-owner attack matrix

**Files:**

- Create/modify focused E2E specs under the owning product e2e projects
- Extend: `apps/gateway-e2e/src/gateway/workspace-governance.spec.ts`

**Acceptance:** for each product: owner A and owner B create separate scoped resources, public/direct routes have parity, and every cross-owner read/write/authoring route denies. This becomes the R5-to-R6 handoff.

## Execution order

`R5.1 → (R5.2 + R5.3) → (R5.4 + R5.5) → R5.6 → R5.7 → R5.8`

R5.2 and R5.3 can run in parallel after catalog persistence. R5.4 and R5.5 can run in parallel after their matching authority slice. Forum and Social remain separate because their persistence and permission models differ materially from catalog-backed products.
