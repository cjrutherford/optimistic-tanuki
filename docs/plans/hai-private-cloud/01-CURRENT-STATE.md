# Current State

Audited in S000 on 2026-10-05 against `main` at `efef92fec`. Every fact below
cites the file it came from. The live site could not be reached from the audit
environment (port 443 refused), so this describes the repository, not what
production is serving today.

## Corrections to the planning assumptions

The packet was written against a description of the site that does not match
the repository. Later slices must plan against these facts:

1. **The site is a single page.** There is one content route (`''`). Turn-key
   appliances, software stacks, cost comparison, and contact are _sections_ on
   that page reached by hash anchors, not routes. `/turn-key-appliances`,
   `/software-stacks`, `/cost-comparison`, `/custom-software`, and `/contact`
   do not exist. Custom software has no section or anchor of its own; it lives
   inside the Services section. D011 splits these into routes.
2. **The theme is not dark-mode-first teal/cyan/orange.** The product theme
   defaults to the `foundation` personality, **light** mode, primary
   `#204434` (deep green). Colour comes from the theme service and the user's
   saved theme, not from HAI-specific literals. See D008 in
   `09-DECISION-LOG.md`.
3. **Every logo asset carries `dev`.** There is no `dev`-free mark and no SVG.
4. **No phone number or email address appears anywhere on the site.** The only
   contact path is the form.
5. **The homepage already uses the freedom principle** ("You should be able to
   leave any vendor, including us, with your data intact.") in the hero card.

## Framework and project

| Item                  | Fact                                                                                                                                                                                                                                                                                                                     | Source                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Framework             | Angular 20.3 (`@angular/core` 20.3.32, `@angular/ssr` 20.3.37) standalone components, SSR on Express 4                                                                                                                                                                                                                   | `package.json`, `apps/hai/src/server.ts` |
| Nx project            | `hai`, prefix `hai`, tag `type:app`                                                                                                                                                                                                                                                                                      | `apps/hai/project.json`                  |
| Location              | `apps/hai/`                                                                                                                                                                                                                                                                                                              | —                                        |
| Builder               | `@angular-devkit/build-angular:application`, `outputMode: "server"`                                                                                                                                                                                                                                                      | `apps/hai/project.json`                  |
| Global styles         | `libs/theme-styles/src/lib/base.scss`, then `apps/hai/src/styles.scss`                                                                                                                                                                                                                                                   | `apps/hai/project.json`                  |
| Change detection      | Zone.js with event coalescing                                                                                                                                                                                                                                                                                            | `apps/hai/src/app/app.config.ts`         |
| Shared libraries used | `common-ui` (card, badge, tabs), `navigation-ui` (nav sidebar), `theme-lib`, `theme-ui` (theme toggle, personality backdrop), `motion-ui` (scene backgrounds), `hai-ui` (about tag, app directory), `blogging-ui` (contact form), `blogging-data-access` (contact API), `app-registry`, `auth-ui` (OAuth callback route) | component imports                        |

## Routes

`apps/hai/src/app/app.routes.ts`:

| Path             | Target                                                                            |
| ---------------- | --------------------------------------------------------------------------------- |
| `oauth/callback` | shared OAuth popup callback (`oauthCallbackRoutes`, `@optimistic-tanuki/auth-ui`) |
| `''`             | `LandingComponent` (lazy)                                                         |

There is no wildcard or not-found route. Server routes
(`app.routes.server.ts`) render `**` with `RenderMode.Server`, so new routes are
server-rendered without further configuration.

`app.routes.spec.ts` asserts that the OAuth callback stays registered ahead of
the landing route; new routes must keep that order.

### Homepage sections, in render order

`apps/hai/src/app/components/landing/landing.component.html`

| Section                                                                  | Component                                                       | Anchor id                              |
| ------------------------------------------------------------------------ | --------------------------------------------------------------- | -------------------------------------- |
| Operational banner ("48-Hour Rapid Onboarding…")                         | inline                                                          | —                                      |
| Hero ("Software you own. Servers that stay in your office.")             | inline                                                          | —                                      |
| Turn-key hardware appliances                                             | `hardware-catalog/`                                             | `appliances`                           |
| Five-year ROI calculator ("Turnkey appliance or cloud SaaS?")            | `landing/roi-calculator-section.component.ts` (inline template) | none (`aria-labelledby="roi-heading"`) |
| Turn-key industry stacks                                                 | `solutions-matrix/`                                             | `stacks`                               |
| Services (custom portals, independent infrastructure, tailored software) | `landing/services-section`                                      | `services`, **and a second `stacks`**  |
| Manifesto / approach                                                     | `landing/manifesto-section`                                     | `approach`                             |
| Independent infrastructure                                               | `landing/personal-cloud-section`                                | `infrastructure`, `comparison`         |
| Engagement model                                                         | `landing/engagement-section`                                    | `engagement`                           |
| Partners (white-label)                                                   | `landing/partner-section`                                       | `partners`                             |
| Ecosystem (app directory)                                                | `landing/ecosystem-section`                                     | `ecosystem`                            |
| Contact form                                                             | `landing/contact-section`                                       | `contact`                              |

Defects found (not fixed; out of scope for S000):

- `id="stacks"` appears twice (solutions matrix and services). Duplicate ids
  are invalid HTML; `getElementById` resolves to the solutions matrix because
  it comes first.
- The **Cost Comparison** nav item targets `#comparison`, which sits on the
  Independent Infrastructure section, not the ROI calculator. The calculator
  has no anchor.

## Navigation

`apps/hai/src/app/components/title-bar/`

- Desktop: a flat list of anchor links (`navLinks`): Home, Turn-key
  Appliances, Software Stacks, Cost Comparison, Contact. **No dropdown.**
- Mobile: hamburger button opens `otui-nav-sidebar` from `navigation-ui` with
  the same five items as `navItems` (action callbacks).
- Every link calls `jump()`: if the router is not on `/` it navigates to `/`
  first, then scrolls to the anchor and sets `location.hash`. The structure
  already supports items that live on other routes, but there is no
  `routerLink` usage yet.
- Header actions: "Schedule Free Audit" (→ `#contact`) and `lib-theme-toggle`.
- Brand link: `assets/haidev-logo.png` (44×47) plus the text "HOPEFUL
  ASPIRATIONS INDUSTRIES".

## Theme implementation

| Item                    | Fact                                                                                                                                                                  | Source                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Provider                | `provideProductTheme('hai')`                                                                                                                                          | `apps/hai/src/app/app.config.ts`                                |
| HAI defaults            | personality `foundation`, mode `light`, primary `#204434`                                                                                                             | `libs/theme-models/src/lib/product-personalities.ts:168`        |
| Precedence              | defaults apply only until the user saves a theme; user choice wins                                                                                                    | `libs/theme-lib/src/lib/theme-lib/theme-defaults.ts`            |
| Mode switching          | `lib-theme-toggle` in the header; `body.dark` sets `color-scheme: dark`                                                                                               | `title-bar.component.html`, `apps/hai/src/styles.scss`          |
| Personality scene       | `provideScenePersonality` drives `otui-personality-scene` (fixed, 50% opacity, browser-only) and section motion (`topographic-drift`, `pulse-rings`, `aurora-ribbon`) | `app.config.ts`, `app.component.html`, `landing.component.html` |
| Tokens used by app SCSS | `--foreground`, `--background`, `--surface`, `--primary`, `--secondary`, `--font-body`, `--personality-font-family`, with `color-mix()` for tints                     | `apps/hai/src/styles.scss`, component SCSS                      |
| Component tone API      | `tone`, `emphasis`, `size` inputs on `otui-card` / `otui-badge`; `data-tone`, `data-emphasis`, `data-size`, `data-theme-surface` attributes on plain elements         | landing templates                                               |
| Fonts                   | Google Fonts: Cormorant Garamond (500–700), Manrope (400–800)                                                                                                         | `apps/hai/src/index.html`                                       |

Hard-coded colour literals in app SCSS (13; to be replaced with theme or
personality variables per D008):

- `hardware-catalog.component.scss:193, 242, 247`
- `solutions-matrix.component.scss:60, 69, 70, 75, 78, 153, 374, 378`
  (most are `rgba(45, 212, 191, …)`, a teal that ignores the theme)
- `title-bar.component.scss:24`
- `landing.component.scss:13`

Responsive breakpoints in app SCSS (all `max-width`, no shared scale): 420,
480, 640 (7 uses), 700, 760, 800, 960 (5), 1024 (2), 1100 px. Three
`prefers-reduced-motion: reduce` blocks; `LandingComponent.reducedMotion` also
gates motion components and smooth scrolling.

## Brand mark, favicon, logo

All in `apps/hai/public/`. Every one shows the "HAI" + arrow mark **with
`dev`** beneath it.

| File                                                       | Size                                         | Used by                                                                                       |
| ---------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `assets/haidev-logo.png`                                   | 315×340 PNG                                  | header brand link; app-registry `iconUrl` (`libs/app-registry/src/lib/default-registry.json`) |
| `favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`    | —                                            | browser default (not linked from `index.html`)                                                |
| `apple-touch-icon.png`                                     | 180×180                                      | not linked from `index.html`                                                                  |
| `android-chrome-192x192.png`, `android-chrome-512x512.png` | —                                            | `site.webmanifest`                                                                            |
| `site.webmanifest`                                         | empty `name`/`short_name`, `#ffffff` colours | not linked from `index.html`                                                                  |

No SVG version of the mark exists in the repository. A `dev`-free mark needs a
source asset from the owner.

## Forms and form handling

- One form: `lib-contact-form` (`libs/blogging-ui/src/lib/contact-form/`)
  inside `contact-section`, with subjects Custom Portal & Workflow
  Automation, Independent Infrastructure, Tailored Software, Partner Inquiry.
- Submission: `LandingComponent.submitContactForm` →
  `OptomisitcTanukiAPIService.contactControllerCreateContact` → `POST
/api/contact` with `appScope: 'hai'`, `sourcePage: '/#contact'`,
  `sourceLabel: 'HAI'` (`libs/blogging-data-access/src/generated/blogging.ts:377`).
- `/api` is proxied by the SSR server to `GATEWAY_URL` (default
  `http://gateway:3000`) in `apps/hai/src/server.ts`; in Kubernetes the
  ingress also routes `/api` straight to the gateway.
- The ROI calculator's "email this comparison" output pre-fills the contact
  message and scrolls to `#contact`.
- Status copy promises acknowledgement "within one business hour,
  Monday–Friday, 9 a.m.–5 p.m. Eastern" (`landing.component.ts`,
  `contact-section.component.html`).

## Analytics

- **No marketing analytics.** No gtag, Plausible, Umami, Matomo, or event
  tracking exists.
- Real-user performance monitoring only: `startPerformanceMonitoring({ appId:
'hai' })` in `main.ts` beacons Web Vitals to `/api/performance/rum`
  (`libs/common-ui/src/lib/common-ui/performance-monitor.ts`), handled by
  `apps/gateway/src/performance/performance-telemetry.controller.ts`.
- Server side: `startNodeRuntimeMonitoring` with optional
  `OTEL_EXPORTER_OTLP_ENDPOINT` (`server.ts`).
- No UTM parameter handling.

## SEO metadata

- Static only, in `apps/hai/src/index.html`: one `<title>` ("Hopeful
  Aspirations Industries | Custom Software & Infrastructure") and one meta
  description.
- No `Meta`/`Title` service usage, no per-route titles, no canonical links, no
  OpenGraph or Twitter tags, no sitemap or `robots.txt` in `public/`.

## Image pipeline

- Static files in `apps/hai/public/`, copied as-is by the build's `assets`
  glob. No image optimisation step, no `NgOptimizedImage`, no AVIF/WebP. The
  only raster content image is the header logo; visual interest comes from
  `motion-ui` canvas scenes.

## Commands

All Nx commands need `NX_DAEMON=false NX_ISOLATE_PLUGINS=false pnpm exec nx …`.

| Purpose     | Command                                                | Baseline (2026-10-05)                                                                                                                                                                    |
| ----------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build       | `nx build hai` (production default)                    | Pass. Initial total 835.93 kB raw / 182.74 kB transfer. Warnings only: 9 shared-library component stylesheets exceed the 8 kB budget, NG8113 in `NavSidebarComponent`, Sass deprecations |
| Dev server  | `nx serve hai` (development config)                    | not run                                                                                                                                                                                  |
| SSR locally | `node dist/apps/hai/server/server.mjs` (port 4000)     | not run                                                                                                                                                                                  |
| Unit tests  | `nx test hai` (Jest, `jest-preset-angular`)            | Pass, 66 tests                                                                                                                                                                           |
| Coverage    | `nx test hai -c ci` → `coverage/apps/hai`              | not run                                                                                                                                                                                  |
| Lint        | `nx lint hai`                                          | Pass                                                                                                                                                                                     |
| Typecheck   | `pnpm exec tsc -p apps/hai/tsconfig.app.json --noEmit` | Pass                                                                                                                                                                                     |
| E2E         | none; there is no `hai-e2e` project                    | —                                                                                                                                                                                        |

The 8 kB component-style budget is a warning at 8 kB and an error at 16 kB
(`project.json`). New page components must stay under 16 kB.

## Deployment

**There is no Kubernetes cluster yet** (owner, 2026-10-05). The manifests and
the Deploy Production workflow below exist in the repository but have no live
target, and the domain did not answer on 443 during the audit. Deployment is a
manual owner step; see D010.

1. **Image:** `apps/hai/Dockerfile` (two-stage, `node:24-alpine`, pnpm
   11.0.9) builds `nx build hai --configuration=production` and runs
   `node /app/dist/apps/hai/server/server.mjs` on port 4000. Image
   `cjrutherford/optimistic_tanuki_hai`.
2. **Compose:** service `hai` in `docker-compose.yaml:194`, host port
   `${HAI_PORT:-8088}` → 4000.
3. **CI:** `.github/workflows/ci-cd.yml` runs on PRs and pushes to `main`,
   `develop`, `mvp-polish`. `scripts/docker-plan-services.mjs` decides which
   compose images changed and builds/pushes them.
4. **Production:** `.github/workflows/deploy.yml` is `workflow_dispatch`
   only. It rewrites image tags in `k8s/overlays/production/kustomization.yaml`
   (`scripts/update-k8s-overlay-images.mjs`), commits that, and applies the
   Argo CD application. Deployment is a manual owner action.
5. **Kubernetes:** `k8s/base/clients/hai.yaml` (Deployment, 2 replicas, TCP
   probes on 4000; Service `hai` 8088 → 4000). `k8s/base/ingress.yaml`
   routes `hopefulaspirationsindustries.com` `/api` → `gateway:3000` and `/` →
   `hai:8088`.
6. **Rollback (once Kubernetes exists):** re-run Deploy Production with the
   previous image tag, or revert the overlay commit and let Argo CD sync.

## Existing content relevant to private cloud

- Hero lede already sells "deploy open-source business tools" and
  "on-premises server appliances"; primary CTA "Schedule Free Audit".
- Hardware tiers come from `services/hardware-catalog.service.ts`; the ROI
  calculator reuses them (`services/roi-calculator.service.ts`).
- Industry stacks pair a hardware tier with "white-box" client apps
  (`solutions-matrix`), not with Nextcloud/Immich-style OSS.
- `personal-cloud-section` is titled "Independent Infrastructure" and covers
  VPS/on-prem mini-servers; it is the closest existing private-cloud content.
- No mention of Faith groups, churches, Nextcloud, Immich, Jellyfin,
  Paperless-ngx, Vaultwarden, WireGuard, or Restic.
