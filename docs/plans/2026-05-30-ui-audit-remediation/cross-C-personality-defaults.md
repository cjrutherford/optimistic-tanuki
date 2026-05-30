# Cross-Cutting C: Apply Personality Default Matrix

**Goal:** Ensure every Angular client app sets exactly one intentional default personality at bootstrap, matching `docs/app-personality-map.md`.

**Why it matters:** Several audit findings call out apps either missing an explicit personality (`client-interface`, `developer-portal`), conflicting with their content (`digital-homestead` set `classic` but reads `soft-touch`), or using legacy palette APIs (`video-client`). A single PR per app is overkill; this plan delivers the change as one focused PR.

## Scope

Touch every app's root component (or `APP_INITIALIZER`) to call `ThemeService` once with the documented mode + personality. **Do not** touch any per-app SCSS in this plan; appearance changes belong to the per-app plans.

## Files (one block per app)

For each app in `docs/app-personality-map.md`, modify the root component file. Confirmed entry points:

- `apps/client-interface/src/app/app.component.ts`
- `apps/owner-console/src/app/...` (root)
- `apps/system-configurator/src/app/app.component.ts`
- `apps/local-hub/src/app/app.component.ts`
- `apps/developer-portal/src/app/app.component.ts`
- `apps/christopherrutherford-net/src/app/app.component.ts`
- `apps/business-site/src/app/app.component.ts`
- `apps/forgeofwill/src/app/app.component.ts`
- `apps/digital-homestead/src/app/app.component.ts`
- `apps/hai/src/app/app.component.ts`
- `apps/marketing-generator/src/app/app.component.ts`
- `apps/fin-commander/src/app/app.component.ts`
- `apps/leads-app/src/app/app.component.ts`
- `apps/business-configurator/src/app/app.component.ts`
- `apps/configurable-client/src/app/app.component.ts`
- `apps/store-client/src/app/app.component.ts`
- `apps/video-client/src/app/app.component.ts`
- `apps/d6/src/app/app.component.ts`

## Tasks

1. For each app, locate the existing ThemeService bootstrap (if any) and replace it with a single `setTheme()` + `setPersonality()` pair matching `docs/app-personality-map.md`.
2. Remove any local `ThemeService` provider overrides (notably `christopherrutherford-net` About page and `digital-homestead` admin shells per the audit).
3. Remove or rewire bespoke theme toggles that bypass `ThemeService` (`local-hub` `app-theme-toggle`, custom DOM `data-theme` manipulation).
4. For `configurable-client`, ensure tenant config writes map onto `--primary`, `--background`, `--foreground`, `--font-body` rather than legacy `--primary-color`/`--text-color`.
5. For `video-client`, migrate the `Sunset Vibes` palette API call to `setPersonality('electric')` (or `'bold'`, decision to make in the per-app PR review).
6. For `fin-commander`, drop the forced `color-scheme: light` until `ThemeService` reliably applies the dark class — track follow-up in the per-app plan.
7. Add one spec per app verifying `ThemeService.currentPersonality` after bootstrap.

## Verification

- `pnpm exec nx run-many -t test -p $(ls apps | xargs)` (or scoped to the touched apps) passes.
- Manual smoke: run each app dev server, confirm the documented personality applies on first paint with no flash of unstyled / wrong-personality content.
- No new entries appear in `pnpm run ui:heuristics`.

## Risks

- Changing default personality alters product appearance for end users; coordinate with product before merging for `forgeofwill`, `digital-homestead`, `christopherrutherford-net`, `video-client`.
- Removing local overrides may regress branded surfaces; capture before/after screenshots in the PR.
