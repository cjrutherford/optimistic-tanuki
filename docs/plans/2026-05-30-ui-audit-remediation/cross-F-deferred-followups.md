# Cross-Cutting F: Deferred Per-App Follow-Ups

**Goal:** Capture the heterogeneous follow-up items that were deliberately
deferred during the per-app slices (5–22) so they don't get lost. Each
sub-slice in this plan stands alone; pick them up individually as bandwidth
allows.

**Why last:** None of these items affect the UI heuristic budget (which is
now 0 workspace-wide). They are correctness, robustness, or polish items
surfaced while doing the tokenization work but that would have inflated
those slices past a reasonable review size.

## Sub-slices

Order is recommendation, not dependency — each sub-slice is independent.

### F1 — Per-app `currentPersonality` bootstrap specs

**Goal:** Verify every app actually applies its documented personality
(`docs/app-personality-map.md`) before first paint, with a unit/integration
test guarding the boot path.

**Files:**

- `apps/<app>/src/app/app.config.ts` (or equivalent bootstrap module).
- New `apps/<app>/src/app/app.bootstrap.spec.ts` per app that asserts
  `ThemeService.currentPersonality()` matches the documented value after
  bootstrap.

**Apps in scope:** Every app whose per-app slice landed without an
accompanying bootstrap spec (all 19 remediated apps). Skip apps that
already have a spec covering this — audit first.

**Verification:** `pnpm exec nx run-many -t test --projects=<comma-list>`
passes.

**Risk:** Some apps may bootstrap the personality via tenant config / async
load (configurable-client, business-site editor preview). For those, the
spec asserts the _default_ personality and a follow-up case asserts that a
tenant config override is honored.

---

### F2 — Remove residual local `ThemeService` overrides

**Goal:** After cross-C set documented personality defaults in
`PERSONALITY_DEFAULTS`, several apps still call
`themeService.setPersonality(...)` from their own bootstrap or shell
component. Those calls are now redundant and risk drifting from the
documented matrix.

**Files (suspected — audit first):**

- `apps/leads-app/src/app/app.component.ts`
- `apps/store-client/src/app/app.component.ts`
- `apps/local-hub/src/app/app.component.ts`
- `apps/forgeofwill/src/app/app.component.ts`
- `apps/client-interface/src/app/app.component.ts`
- `apps/d6/src/app/app.component.ts`

**Verification:** `pnpm exec nx run-many -t test,build --projects=<list>`;
visual smoke via Storybook personality previews.

**Risk:** Removing an override may unmask a missing/incorrect default in
`PERSONALITY_DEFAULTS`. F1 (bootstrap specs) should catch this — schedule
F1 first if you intend to do F2.

---

### F3 — `configurable-client` tenant-config token mapping

**Goal:** The dynamic per-tenant theme injection in
`apps/configurable-client` still uses an ad-hoc shape (raw CSS string in
some paths, custom properties dict in others). Standardize it on a single
typed shape that maps tenant brand colors → ThemeService palette tokens
(`primary`, `secondary`, `surface`, `border`, etc.).

**Files:**

- `apps/configurable-client/src/app/config/tenant-theme.service.ts` (or
  the equivalent — locate via grep on `tenant` + `theme`).
- `apps/configurable-client/src/app/config/tenant-theme.spec.ts`.
- `libs/theme-lib` may need to expose a typed `applyTenantOverrides(palette)`
  helper if one doesn't already exist.

**Verification:** Tenant config fixtures load into the dev server without
console warnings; primary/secondary swap on tenant change; `pnpm exec nx
test configurable-client` passes.

---

### F4 — `fin-commander` `color-scheme: light` review

**Goal:** `apps/fin-commander/src/styles.scss:3` hard-codes
`color-scheme: light` on `html`. Now that `--background`/`--foreground` are
ThemeService-driven, that hint may conflict with a dark-personality theme
(form controls render with native light chrome on a dark page).

**Files:**

- `apps/fin-commander/src/styles.scss`.
- Possibly `body.dark` rule (already present at line 32–34) needs to be
  the source of truth via `color-scheme: dark` instead of a class
  toggle.

**Action options:**

1. Remove the `color-scheme: light` on `html` and let ThemeService drive
   a `color-scheme` declaration based on personality contrast metadata.
2. Keep `light` but document explicitly why (e.g., the Shark personality
   is always light by design).

**Verification:** Toggle personalities via the personality picker (or
Storybook); native form controls render with the matching scheme; no
contrast warnings in the ThemeService console.

---

### F5 — Relax `leads-app` theme-sweep spec to whitespace-insensitive matching

**Goal:** The spec added during slice 8 (`leads-app`) asserts the rendered
output contains specific CSS substrings with exact whitespace. It will
break on any Prettier/formatter change.

**Files:**

- `apps/leads-app/src/app/<component-or-service>.spec.ts` (locate the
  spec added in commit `b255074f`).

**Change:** Normalize both expected and actual strings via
`.replace(/\s+/g, ' ').trim()` before comparison; or use a regex matcher.

**Verification:** Spec still fails when the underlying token usage
regresses; spec passes through `prettier --write` reformatting.

---

### F6 — `local-hub` floating notification + chat responsive stacking

**Goal:** The floating notification toast and the chat widget overlap at
narrow viewports (audit observation, not a heuristic finding). Stack them
or use a priority queue.

**Files:**

- `apps/local-hub/src/app/components/floating-notification/...`
- `apps/local-hub/src/app/components/chat-widget/...` (locate via grep).

**Verification:** Manual: resize to 360px / 768px and confirm no overlap;
add a Playwright visual test for both breakpoints.

---

### F7 — `d6` daily-four / daily-six layout extraction

**Goal:** `d6` defines two near-identical grid layouts (`daily-four` and
`daily-six`) inline in component SCSS. Extract to a shared mixin or
container component.

**Files:**

- `apps/d6/src/app/components/daily-four/*`
- `apps/d6/src/app/components/daily-six/*`
- New: `apps/d6/src/app/shared/daily-grid.mixin.scss` (or component).

**Verification:** Visual diff via Storybook stories for 4-cell and 6-cell
arrangements; `pnpm exec nx test d6` passes.

---

### F8 — `developer-portal` optional `otui-app-bar` + ThemeService bootstrap

**Goal:** `developer-portal` currently renders its own bespoke header.
Adopting `<otui-app-bar>` would align it with the rest of the workspace
and let ThemeService own the foundation personality bootstrap.

**Files:**

- `apps/developer-portal/src/app/app.component.html`
- `apps/developer-portal/src/app/app.component.ts` (inject ThemeService).
- `apps/developer-portal/src/app/app.config.ts`.

**Verification:** Personality switcher in the dev shell now affects the
header chrome; visual parity with the prior bespoke header (or
documented improvement); `pnpm exec nx test,build developer-portal`
passes.

---

## Tracking

When you start a sub-slice, add a `**Status:** ✅ Done` line to its
section above (mirroring the per-app plan convention). When all eight are
done, close out this plan with a final ✅ Done marker on the heading.

## Not in scope

- New audits or new findings — file those as a fresh plan under
  `docs/plans/<date>-…`.
- Performance work (bundle size, hydration) — separate effort.
- Storybook stories for the cross-A primitives — see
  `cross-E-primitive-stories-and-docs.md`.
