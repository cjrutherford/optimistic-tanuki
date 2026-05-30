# UI Audit Remediation Plans (2026-05-30)

Source audit: `docs/audits/client-app-ui-audit-2026-05-30.md`
Personality reference: `libs/theme-lib/docs/PERSONALITY_SYSTEM.md`
Per-app personality matrix: `docs/app-personality-map.md`
Lint script: `tools/scripts/check-client-ui-heuristics.mjs` (`pnpm run ui:heuristics[:ci]`)

## How to use

- Each plan is self-contained and parallelizable. Pick one, branch from `main`,
  finish, open a PR. No plan depends on another except where called out below.
- Every plan ends with a "Verification" section. The final command is always
  `pnpm exec nx build <app>` plus a fresh `pnpm run ui:heuristics` snapshot for
  that app's path.
- Cross-cutting plans (A-D) should land first when possible, because per-app
  plans reference the shared primitives they introduce. Per-app work can still
  proceed without them by keeping changes app-local and migrating to shared
  primitives once available.

## Plan index

### Cross-cutting (do first when possible)

| ID  | File                                                               | Title                                                             |
| --- | ------------------------------------------------------------------ | ----------------------------------------------------------------- |
| A   | [cross-A-shared-primitives.md](cross-A-shared-primitives.md)       | Promote shared page-header / metric-tile / empty-state primitives |
| B   | [cross-B-badge-component.md](cross-B-badge-component.md)           | Themed badge/chip/pill component + semantic variants              |
| C   | [cross-C-personality-defaults.md](cross-C-personality-defaults.md) | Apply personality default matrix across all 18 apps               |
| D   | [cross-D-heuristic-lint-ci.md](cross-D-heuristic-lint-ci.md)       | Enforce `ui:heuristics:ci` in CI on a per-app allowlist           |

### Per-app (parallelizable)

Ordered by lint-finding volume (highest first). Effort estimates come from the audit.

| App                       | Findings | Effort | Plan                                                                 |
| ------------------------- | -------: | ------ | -------------------------------------------------------------------- |
| owner-console             |      253 | M      | [app-owner-console.md](app-owner-console.md)                         |
| forgeofwill               |      104 | M      | [app-forgeofwill.md](app-forgeofwill.md)                             |
| store-client              |       78 | M/L    | [app-store-client.md](app-store-client.md)                           |
| local-hub                 |       69 | M      | [app-local-hub.md](app-local-hub.md)                                 |
| leads-app                 |       38 | M      | [app-leads-app.md](app-leads-app.md)                                 |
| client-interface          |       24 | M      | [app-client-interface.md](app-client-interface.md)                   |
| d6                        |       18 | M      | [app-d6.md](app-d6.md)                                               |
| video-client              |       16 | M      | [app-video-client.md](app-video-client.md)                           |
| developer-portal          |       13 | S/M    | [app-developer-portal.md](app-developer-portal.md)                   |
| system-configurator       |        9 | L      | [app-system-configurator.md](app-system-configurator.md)             |
| business-configurator     |        9 | S/M    | [app-business-configurator.md](app-business-configurator.md)         |
| fin-commander             |        8 | M      | [app-fin-commander.md](app-fin-commander.md)                         |
| digital-homestead         |        7 | L      | [app-digital-homestead.md](app-digital-homestead.md)                 |
| business-site             |        6 | S      | [app-business-site.md](app-business-site.md)                         |
| marketing-generator       |        5 | S/M    | [app-marketing-generator.md](app-marketing-generator.md)             |
| configurable-client       |        3 | M      | [app-configurable-client.md](app-configurable-client.md)             |
| christopherrutherford-net |        2 | M      | [app-christopherrutherford-net.md](app-christopherrutherford-net.md) |
| hai                       |        0 | S      | [app-hai.md](app-hai.md)                                             |

`apps/ui-playground` (17 findings) is intentionally excluded; it is a showcase
sandbox where literal hex colors are allowed.

## Conventions used in every plan

- "Tokens" means CSS custom properties produced by `ThemeService` (see
  `libs/theme-lib/src/lib/theme.service.ts`) and the documented personality
  variables in `libs/theme-lib/docs/PERSONALITY_SYSTEM.md`. Prefer semantic
  variables (`--background`, `--foreground`, `--primary`, `--surface`,
  `--on-primary`, `--border`, `--muted-foreground`) over personality-specific
  ones unless the rule is genuinely personality-conditional.
- "Replace hex" means: substitute with the nearest semantic token, or with
  `color-mix(in oklab, var(--token) <pct>%, transparent)` for translucent
  shades. Never invent a new top-level `--app-*` variable without first
  checking the personality map.
- "Set personality" means: in the app's root component constructor (or an
  `APP_INITIALIZER`), call
  `themeService.setTheme(<mode>); themeService.setPersonality(<id>);` once,
  matching the row in `docs/app-personality-map.md`.
- Every plan ends with the same gates: `pnpm exec nx lint <app>`,
  `pnpm exec nx build <app>`, and `pnpm run ui:heuristics` filtered to the
  app's path showing zero or a documented-allowlisted remainder.
