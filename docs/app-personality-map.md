# App Personality Map

Every Angular client app ships with a default personality, mode, and primary
colour. The source of truth is `PRODUCT_THEME_DEFAULTS` in
`libs/theme-models/src/lib/product-personalities.ts`; this table mirrors it.
Personality definitions are described in
`libs/theme-lib/docs/PERSONALITY_SYSTEM.md`.

Apps apply their row with `provideProductTheme('<app>')` in `app.config.ts`.
The default shows until the user saves a theme of their own (theme toggle,
personality selector, or theme designer); after that the user's choice wins.
Apps do not call `setPersonality()` at startup.

| App                       | Personality      | Mode       | Primary   | Rationale                                                                                |
| ------------------------- | ---------------- | ---------- | --------- | ---------------------------------------------------------------------------------------- |
| client-interface          | `soft-touch`     | light      | `#3f51b5` | Community/social surfaces benefit from warm, approachable visuals.                       |
| owner-console             | `control-center` | light      | `#2dd4bf` | Operator dashboards need technical density, grid structure, and clear controls.          |
| system-configurator       | `control-center` | light      | `#2dd4bf` | Hardware configuration is technical and benefits from precise dashboard affordances.     |
| setup-console             | `foundation`     | light      | `#3f51b5` | First-run setup is a guided, practical flow that should stay neutral and clear.          |
| local-hub                 | `soft-touch`     | light      | `#3f51b5` | Local community/commerce should feel warm, organic, and approachable.                    |
| developer-portal          | `foundation`     | light      | `#3f51b5` | Documentation and API onboarding should prioritize clarity and neutral layout.           |
| christopherrutherford-net | `elegant`        | dark       | `#006064` | Personal/editorial consulting content benefits from refined typography and premium tone. |
| business-site             | `professional`   | light      | `#3f51b5` | B2B public and portal flows need trustworthy enterprise defaults.                        |
| forgeofwill               | `bold`           | light      | `#0EA5E9` | Branded productivity experience needs energetic contrast and strong accents.             |
| digital-homestead         | `soft-touch`     | dark       | `#3f51b5` | Homesteading/community content aligns with organic warmth and pill-shaped softness.      |
| hai                       | `foundation`     | light      | `#204434` | Owned-computing messaging should remain clear, practical, and minimal.                   |
| marketing-generator       | `control-center` | dark       | `#d97706` | Generator/editor workflows benefit from technical dashboard density.                     |
| fin-commander             | `professional`   | light      | `#0d5f73` | Finance workflows need conservative, trustworthy defaults.                               |
| leads-app                 | `control-center` | light      | `#3f51b5` | Lead discovery and analytics are command-center workflows.                               |
| business-configurator     | `professional`   | light      | `#1f7a63` | Business setup should feel stable, guided, and enterprise-ready.                         |
| configurable-client       | `foundation`     | light      | `#356c91` | Tenant shells need a neutral baseline that can accept tenant branding.                   |
| store-client              | `playful`        | dark       | `#c2185b` | Commerce/customer surfaces benefit from friendly energy and approachable interactions.   |
| video-client              | `electric`       | light      | `#3f51b5` | Video discovery and creator surfaces need kinetic, vibrant personality.                  |
| d6                        | `soft-touch`     | light      | `#6b8f8a` | Reflection/wellness practice needs calm, gentle visuals.                                 |
| learning                  | `architect`      | follows OS | `#0d7a66` | A lesson console: raw, structural, monospace.                                            |

`business-site` hosted tenant routes (`/sites/<slug>`) and `configurable-client`
tenants replace the default with the theme configured for that tenant.
