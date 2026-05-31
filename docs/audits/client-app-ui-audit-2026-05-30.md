# Client App UI Audit - 2026-05-30

> **Update (post-audit):** Per-app hex/badge/layout counts captured at audit time are now mirrored in `tools/scripts/ui-heuristics-allowlist.json`. CI (`.github/workflows/lint.yml`) enforces the budgets via `pnpm run ui:heuristics:ci`. Per-app remediation PRs must lower the matching budget. See `tools/scripts/README.md` for usage.

## Methodology

Audited 18 Angular client apps identified by Angular application/dev-server executors. The pass inspected `apps/<name>/src` for shared component reuse, theme/personality wiring, light/dark legibility, personality distinctness, and layout/density risks. Personality recommendations use `libs/theme-lib/docs/PERSONALITY_SYSTEM.md` as the reference. Non-Angular Node services under `apps/` were excluded.

## Deployment Prerequisites

- `leads-app` now belongs in the client host port range at `8095`.
- `business-configurator` and `developer-portal` both have Dockerfiles and can be wired into compose.
- Container-internal `PORT=4000`, Angular dev-server ports, and debug `92xx` ports were intentionally left unchanged.

## Core Shells / Portals

### App: client-interface

**Context & purpose:** Primary Optimistic Tanuki social/community shell with feed, profiles, chat, notifications, groups, and onboarding.

**Findings (1-5):** Shared shell/component reuse is strong via `otui-app-bar`, `otui-nav-sidebar`, `search-global-search`, notifications, chat, social compose, and post components. Theme adoption is partial: `ThemeService` is injected in `apps/client-interface/src/app/app.component.ts`, and styles use tokens, but no explicit default personality is set. Light/dark risk remains in fixed `white` and fallback accent colors in `app.component.scss`, `styles.scss`, and landing variables. Landing personality is distinct and community-oriented, while the app shell remains generic. Layout is mostly reasonable, though fixed floating chat/notification controls can collide on small screens.

**Concrete changes:** Set an intentional default personality, likely `soft-touch` or `electric`, in the root component. Replace fixed white/fallback colors with semantic on-colors. Add responsive positioning rules for floating notification/chat controls.

**Effort estimate:** M

**Risks:** A global personality change can alter shared components and landing visuals across user states.

### App: owner-console

**Context & purpose:** Operator/admin console for workspaces, permissions, app config, theme management, store/social/forum operations.

**Findings (1-5):** Shared admin shell reuse is good through app bar/sidebar and AG Grid styling. `control-center` is set in the dashboard and fits the operator context, but global `:root` variables and theme-management inline styles duplicate or bypass ThemeService. Light/dark risk is concentrated in theme-management hardcoded light panels, magenta accents, and fixed button/input colors. Personality is coherent in the dashboard but less so in theme-management. Layout is dense but appropriate, with responsive collapse in the editor.

**Concrete changes:** Convert theme-management inline colors to ThemeService tokens. Keep one theme/personality control instead of duplicate app-bar and custom toggles. Scope `:root` fallback variables so generated theme values remain authoritative.

**Effort estimate:** M

**Risks:** Token migration may expose AG Grid contrast issues and requires visual checks in dense data tables.

### App: system-configurator

**Context & purpose:** HAI hardware configuration flow with landing, configure, review, and checkout surfaces.

**Findings (1-5):** Shared reuse is moderate, including HAI tag, registry navigation, and motion UI, but page primitives are mostly custom. Root sets `control-center`, matching the technical configurator purpose, yet app/page styles are dominated by hardcoded dark backgrounds, teal accents, and white text. Light theme behavior is effectively unsupported. Personality is strong and distinctive as a hardware build bench. Layout is effective, especially sticky summary and responsive configure grids, but inline page styles are large.

**Concrete changes:** Preserve the teal control-center identity while replacing fixed dark palettes with semantic theme tokens. Decide whether this app is intentionally dark-only; if not, add visible theme controls. Extract repeated card/button/eyebrow styles from inline components.

**Effort estimate:** L

**Risks:** Over-tokenizing could weaken the current HAI hardware aesthetic.

### App: local-hub

**Context & purpose:** Towne Square local community/commerce hub for discovery, communities, classifieds, messaging, and seller flows.

**Findings (1-5):** Shared shell reuse is good with app bar/sidebar/dev-info/message/HAI components and motion UI. ThemeService is injected but a custom `app-theme-toggle` manipulates `data-theme`, duplicating theme-lib behavior. Light/dark coverage is better than most through bespoke token sets, but fixed white text and undefined RGB token usage remain. The warm local marketplace identity is strong. Landing density is spacious and readable, with some very large vertical sections.

**Concrete changes:** Replace or rewire `app-theme-toggle` through `ThemeService`. Set a deliberate default personality such as `soft-touch`. Define or remove `--primary-rgb` usages. Convert hardcoded on-gradient white text to semantic on-colors.

**Effort estimate:** M

**Risks:** Migrating bespoke Towne Square variables can disrupt established brand warmth.

### App: developer-portal

**Context & purpose:** Public developer portal MVP for API docs, SDK onboarding, usage metrics, and platform proof points.

**Findings (1-5):** Component reuse is low; the app is a bespoke root component without shared navigation or theme controls. No theme/personality integration was observed, and styles hardcode a dark slate/cyan SaaS palette. Light/dark behavior is dark-only but legible. Personality maps best to `control-center` or `foundation` but is currently generic. Layout is simple and appropriate for docs onboarding.

**Concrete changes:** Add theme-lib integration and set `control-center` or `foundation`. Replace hardcoded palette values with semantic tokens. Consider shared app bar/HAI tag/registry navigation for consistency.

**Effort estimate:** S/M

**Risks:** Shared shell integration may push against tight bundle budgets; token migration can soften the current crisp dark docs look.

## Brand / Marketing Surfaces

### App: christopherrutherford-net

**Context & purpose:** Personal/editorial consulting site with portfolio, services, contact, and motion-backed hero.

**Findings (1-5):** Shared UI reuse is strong, but deep shared-component overrides increase coupling. Root initializes `dark`, `foundation`, and primary color, while About locally overrides personality and global fonts/colors remain hardcoded. Light/dark risk exists because theme toggle is hidden and many headings force white. The intended editorial feel conflicts with Foundation system-font clarity. Hero is polished, but project/services grids and About section use older fixed/flex layout patterns.

**Concrete changes:** Remove local ThemeService provider/personality override in About. Replace hardcoded heading colors and global font declarations with semantic/font tokens. Either expose theme controls or enforce dark-only consistently. Modernize project/services grids with CSS grid and tokenized gaps.

**Effort estimate:** M

**Risks:** Removing local overrides may materially alter the personal brand identity.

### App: business-site

**Context & purpose:** Configurable public business/trainer site shell with public pages and owner/client portals.

**Findings (1-5):** Route-level reuse of `business-public-ui` and `business-portal-ui` is strong. Theme/personality is dynamically driven by config, with `professional` as the default, but tests reference undocumented `bold-minimal`. Light/dark behavior is mostly tokenized; active nav `color-mix(... white)` needs contrast review. Professional personality fits the B2B context. Layout is compact at the topbar and delegates density to child libraries.

**Concrete changes:** Replace `bold-minimal` test/config fixtures with documented personality IDs. Audit active nav contrast in dark mode. Extract topbar auth/theme controls only if other configurable apps repeat the pattern.

**Effort estimate:** S

**Risks:** Legacy personality aliases may be hidden dependencies for tenant configs.

### App: forgeofwill

**Context & purpose:** Productivity/project-management branded experience with project/task/risk/change tooling and chat/persona integrations.

**Findings (1-5):** Domain component reuse is very strong across navigation, messaging, chat, profile, project, and task UI. Root sets `bold`, but comments imply fixed branding while app bar/settings expose theme controls. Global tokens are mostly good, but landing has intense fixed fallbacks, gradients, and white text. Brand is energetic, though fantasy typography pushes beyond documented Bold. Workspace layout is dense and appropriate but may become cramped in tile-heavy project details.

**Concrete changes:** Resolve whether users can customize personality or the brand is fixed. Replace `transition: all` and landing hardcoded fonts/colors with personality tokens. Add density/responsive refinements for project detail tables/tabs.

**Effort estimate:** M

**Risks:** Theme settings may be product functionality users rely on.

### App: digital-homestead

**Context & purpose:** Digital Grange/homesteading site with landing, blog/community/contact pages, and admin/editor features.

**Findings (1-5):** Shared component reuse is good, but section card/grid CSS is duplicated. Root sets `classic`, while global `:root` hardcodes a dark purple/serif visual system, bypassing ThemeService. Light/dark risk is high due to fixed white/black and legacy variables. The implementation feels more `soft-touch` or `elegant` than Classic. Layout has modern hero panels but older repeated section grids.

**Concrete changes:** Let ThemeService own core variables instead of redefining them globally. Switch default personality to `soft-touch` or `elegant`. Replace fixed heading/card colors with semantic tokens. Refactor repeated section card/grid styles.

**Effort estimate:** L

**Risks:** Removing hardcoded globals will noticeably change the site; blog-rendered content may depend on local fallback variables.

### App: hai

**Context & purpose:** HAI marketing/landing app for software house, personal cloud, and digital homesteading ecosystem.

**Findings (1-5):** Motion and HAI UI reuse is strong. Root sets `light`, `foundation`, and a green primary; landing styles use theme and personality tokens extensively. Light/dark handling is mostly good, but `color-scheme` depends on a `body.dark` class that may not match ThemeService. Foundation clarity is partially diluted by heavy motion layers. Layout is well structured with responsive grids, though a few inline styles remain.

**Concrete changes:** Tie `color-scheme` to the actual theme host/class. Move inline styles into classes. If Foundation clarity is the goal, reduce motion density or consider `minimal`.

**Effort estimate:** S

**Risks:** Motion effects are central to brand differentiation.

### App: marketing-generator

**Context & purpose:** Signal Foundry marketing/campaign generator with create/results flows, editor, templates, and generated asset previews.

**Findings (1-5):** UI is mostly app-specific, which is reasonable for generator/editor workflows. Root sets dark `control-center`, and styles use theme tokens extensively. Light/dark is intentionally dark-first, with generated asset/export CSS using hardcoded palettes that should remain isolated. Personality distinctness is strong and matches Control Center. Layout is dense and suitable for creation workflows, with responsive fallbacks.

**Concrete changes:** Document dark-only Control Center if customization is not intended. Keep generated asset/export styles clearly separated from app theme styles. Replace remaining fallback gradients/colors with named variables where possible.

**Effort estimate:** S/M

**Risks:** Over-tokenizing generated output can break export fidelity.

## Tool / Vertical Apps

### App: fin-commander

**Context & purpose:** Personal finance command center with onboarding, cash-flow, goals, scenarios, and imports.

**Findings (1-5):** Reuse of finance, auth, HAI, motion, and data-access libraries is good. ThemeService is used, but the app defaults to `classic` while defining parallel `--fc-*` shark personality tokens. Light/dark behavior is risky because global styles force `color-scheme: light` unless `body.dark` exists. Finance cockpit identity is strong but outside the documented personality system. Density is appropriate for financial workflows.

**Concrete changes:** Align `--fc-*` tokens with standard theme variables or promote the identity into a formal personality preset. Remove forced light-only scheme or ensure ThemeService applies the expected dark class reliably.

**Effort estimate:** M

**Risks:** Token migration can subtly alter finance contrast and spacing.

### App: leads-app

**Context & purpose:** Opportunity/lead discovery workspace with onboarding, topics, analytics, dashboard, auth, and profile flows.

**Findings (1-5):** Reuse of auth, notification, motion, HAI, lead feature/data libraries is good. Theme/personality usage is among the strongest, with `control-center` and app tokens layered over theme-lib variables. Remaining light/dark risks are hardcoded status/category colors and auth-card colors. Personality is distinct as an opportunity command center. Dashboard/topic density is good, while onboarding/interview grids may crowd on smaller screens.

**Concrete changes:** Replace hardcoded badge/source/status colors with semantic variables or `color-mix()` from app tokens. Convert login/register card colors to app/theme variables.

**Effort estimate:** M

**Risks:** Badge colors may encode business meaning and need semantic preservation.

### App: business-configurator

**Context & purpose:** Business setup/editor entrypoint currently delegating to `business-portal-ui` editor routes.

**Findings (1-5):** Route-level component reuse is excellent via `BusinessSiteEditorPageComponent`; local wizard components appear legacy or unused. Root sets `professional`, but global styles hardcode a dark body and system font. Light/dark risk is high because child components use theme variables while the app body forces dark defaults. Professional fits the B2B builder, but legacy “Hardware Portal” styling weakens consistency. Layout is largely delegated to shared editor components.

**Concrete changes:** Replace hardcoded global body/link styles with theme variables. Remove legacy "Hardware Portal" styling and route-test any local wizard components.

**Effort estimate:** S/M

**Risks:** Shared editor components may rely on current dark body defaults.

### App: configurable-client

**Context & purpose:** Multi-tenant configurable shell resolving app config and rendering landing/application sections.

**Findings (1-5):** Reuse of `configurable-client-ui`, app config models, HAI, and motion is good, but local section renderers duplicate patterns. Root sets `foundation`; resolver writes legacy `--primary-color`/`--text-color` instead of standard personality variables. Light/dark is mostly light-only and custom tenant CSS can override contrast. Neutral Foundation is appropriate, but tenant personality may not flow through ThemeService. Layout is spacious with room for responsive polish.

**Concrete changes:** Map tenant theme fields to standard variables such as `--primary`, `--background`, `--foreground`, and `--font-body`. Add guardrails for `theme.customCss`.

**Effort estimate:** M

**Risks:** Existing tenants may depend on legacy CSS variable names.

### App: store-client

**Context & purpose:** Commerce/customer shell for catalog, cart, donations, bookings, and forum route.

**Findings (1-5):** Catalog/cart/donations/forum reuse is good, but bookings is a large custom CSS-heavy page. Root sets dark `playful` with pink primary, while globals use legacy aliases and page styles hardcode light Bootstrap-like colors. Bookings creates major dark-mode risk with white cards and dark text. Personality expression is inconsistent because bookings uses blue/purple gradients rather than the storefront personality. Layout is practical but generic and dense.

**Concrete changes:** Tokenize bookings colors and statuses using semantic theme variables. Normalize global aliases to current theme-lib names, keeping legacy aliases only as fallbacks.

**Effort estimate:** M/L

**Risks:** Bookings has many hardcoded states and needs visual regression coverage.

### App: video-client

**Context & purpose:** Video platform for home feed, watch, channels, upload, profile/history/auth.

**Findings (1-5):** Shared reuse is strong across navigation, auth, video-ui, store-ui, motion, and HAI. ThemeService is used, but initialization relies on an older palette API (`Sunset Vibes`) and legacy RGB variables rather than documented personalities. Cinematic dark mode is coherent; light/personality switching may have contrast issues. Personality is highly distinct as a dark creator/video surface. Some account/channel components retain generic hardcoded Material-blue/light styles.

**Concrete changes:** Migrate default from palette API to a documented personality such as `electric` or `bold`, or create a formal video personality. Replace fixed RGB fallbacks with generated theme-aware RGB tokens or `color-mix()` from semantic variables.

**Effort estimate:** M

**Risks:** A generic personality migration could regress the strong cinematic design.

### App: d6

**Context & purpose:** Personal daily practice/self-reflection app with dashboard, daily four/six, feed, profile, and auth.

**Findings (1-5):** Reuse of common/auth/navigation/form/profile/motion/HAI libraries is good. Root sets light `soft-touch` and many styles use variables, but title bar/messages still hardcode white/pastel colors. Dark mode is fragile because root behavior is light-oriented. Soft Touch fits reflection/wellness well, but generic purple fallbacks dilute it. Daily four/six components duplicate layout and styles.

**Concrete changes:** Tokenize title bar and toast colors. Consolidate daily-four/daily-six layout and styles into a shared component or common styles.

**Effort estimate:** M

**Risks:** Daily practice flows may differ subtly; refactor incrementally with tests.

## Cross-Cutting Deliverables

### A. Shared Component Gap Report

- Page headers/heroes recur across `client-interface`, `digital-homestead`, `hai`, `christopherrutherford-net`, `local-hub`, and `developer-portal`; promote a configurable themed page-header/hero pattern in `common-ui` or domain UI libraries.
- Badge/chip/status pills recur in `leads-app`, `store-client`, `owner-console`, `client-interface`, and `video-client`; standardize on a themed badge component with semantic variants.
- Empty/loading/error states recur in dashboards and data tools; extract common state components for `common-ui` with tone/personality tokens.
- Stat/metric tiles recur in `developer-portal`, `leads-app`, `fin-commander`, `owner-console`, and `marketing-generator`; promote a theme-aware metric tile pattern.
- Theme/personality selectors are duplicated or inconsistent across `owner-console`, `local-hub`, `forgeofwill`, and shared app bars; centralize selector behavior in theme/navigation UI.

### B. Badge/Chip Refactor Task

Create a dedicated refactor PR to replace hardcoded badge/chip/pill colors with a themed badge component or semantic badge classes. Initial files to inspect:

- `apps/leads-app/src/app/leads.component.scss`
- `apps/store-client/src/app/pages/bookings/bookings.component.scss`
- `apps/owner-console/src/app/components/theme-management.component.ts`
- `apps/client-interface/src/app/app.component.scss`
- `apps/video-client/src/app/components/my-channel.component.ts`

### C. Personality Default Matrix

The committed matrix lives in `docs/app-personality-map.md`.

### D. Layout Heuristic Lint Rule

Added `tools/scripts/check-client-ui-heuristics.mjs`, exposed through `pnpm run ui:heuristics` for reporting and `pnpm run ui:heuristics:ci` for CI enforcement. It reports:

- Hex literals in `apps/**/*.scss` outside `:root` blocks and token/personality files.
- `max-width` values below `1280px` on selectors containing `shell` or `layout`.
- `color: white|black` on selectors containing `badge`, `chip`, or `pill`.
