# RR04-I02 Implementation Plan

> Execute within the current checkout using the existing delivery workflow; the operator authorizes implementation now. Repository instructions prohibit worktrees.

**Goal:** Close the scheduled ordinary audience, safe sharing, public-community intent and Following Feed gaps with real cookie-session and image evidence.

**Architecture:** Keep social's shared visibility predicate authoritative across reads/delivery. Expose audience through shared compose, preserve durable asset restrictions, and intersect share reads with current source access. Preserve accepted RR08 behavior.

**Tech Stack:** Angular shared UI, NestJS gateway/services, TypeORM, Nx/pnpm, Docker and checked-in Playwright/system Chrome.

---

The [slice design and acceptance map](../release-readiness/findings/RR-04-I02.md) defines normative decisions and evidence.

### Task 1: Write contracts and safety regressions before implementation

Modify/test `libs/models/src/lib/libs/social/*post*.ts`, `libs/social/contracts/src/lib/social-post.ts`, `apps/social/src/app/common/post-visibility.util{,.spec}.ts`, `apps/social/src/app/services/post.service{,.spec}.ts`, `apps/gateway/src/controllers/social/social.controller{,.test}.ts`. Add failing ordinary audience, omitted community default, invalid input, partial update and explicit-public/legacy-member tests. Run the resolved social/gateway Nx test targets and record expected failure assertions before the repair. Implement the smallest consistent policy; use profile AND account identity correctly.

### Task 2: Ordinary shared composer and pending media

Modify/test `libs/social-ui/src/lib/social-ui/compose/compose.component.{ts,html,spec.ts}`, OT `apps/client-interface/src/app/components/social/feed.component.{ts,html,spec.ts}`, and associated shared models. Add actual selection-event/payload tests before UI changes. Derive upload restrictions from selected audience; assess comment sanitizer and owning-service linkage. Extend existing asset JSONB restriction contracts/validation/read checks only where required. Preserve public TS assets and A02 durable audience behavior. Run the smallest affected social-ui/client/media tests, then their complete affected targets.

### Task 3: Generated schema gate if required

Modify `apps/social/src/entities/post.entity.ts` only after selecting explicit-intent representation. Generate through resolved `social:typeorm:migration:generate` against a disposable baseline schema, inspect only intended additive SQL, then run baseline/up/down/up and unchanged legacy-value checks. Use `pnpm run validate:typeorm-migrations`. Do not hand-create migrations or rewrite deployed timestamps.

### Task 4: Safe shares and Following Feed

Modify/test `apps/gateway/src/controllers/social/post-share/post-share.controller{,.spec}.ts`, `apps/social/src/app/services/post-share.service{,.spec}.ts`, owning social handlers, shared share DTO/UI consumers and `getCommunityFeed` in `apps/social/src/app/app.controller.ts`. First reproduce inaccessible-source/wider-share/read/delete ownership failures and profile-follow mismatch. Apply shared source policy and current viewer intersection, safe defaults and typed actor mapping. Preserve chronological order, suppressed authors and community access.

### Task 5: Exact cookie-session browser and media proof

Add a focused RR04-I02 opt-in spec under `apps/client-interface-e2e/src/`. Register controlled accounts through the running stack; exercise ordinary publishing and audience controls in the browser. Verify exact persisted markers/URLs and decoded images with owner/member/follower/outsider/anonymous negatives, readback and revocation. Validate source-aware shares and profile Following Feed. Use the resolved Nx E2E target, exact config `--list` and CLI separator where needed. Do not inject browser tokens or intercept API results. Preserve shared setup/teardown skip flags.

### Task 6: Independent closeout

Run affected Nx units/lint, migration gates and `pnpm run build:dev`; refresh affected mounted processes only after build completes. Run focused live cases then affected privacy/safety regressions. Delegate stable diff to independent reviewer/verifier; repair proven findings and repeat smallest failing gate. Clean exact fixtures with retained history, format only owned files, scan staged content and check whitespace. Commit only slice paths and synchronize master/queue/report; no PR/push/deployment is implied. RR04-I03 is next.
