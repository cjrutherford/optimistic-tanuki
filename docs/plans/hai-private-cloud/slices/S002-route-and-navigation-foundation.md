# S002 — Route and Navigation Foundation

## Status

Complete

## Objective

Add a route for every offering in `03-INFORMATION-ARCHITECTURE.md`, move each
existing homepage section onto its route unchanged, and add the private-cloud
route hierarchy and navigation, without writing final page content (D011).

## Why this slice exists

Establish stable structure before content implementation.

## Dependencies

S001

## In scope

- /private-cloud
- /private-cloud/home
- /private-cloud/organizations
- /private-cloud/open-source-stack
- /private-cloud/assessment
- /turn-key-appliances, /software-stacks, /cost-comparison, /custom-software,
  /partners, /how-we-work, /contact, each hosting its existing section
  component(s) unchanged
- `/private-cloud` hosts the independent-infrastructure section (D014)
- navigation updates (routes instead of hash anchors) using the
  `navigation-ui` drawer at every width (D015)

## Out of scope

- Final page copy
- Reducing the homepage to headlines (S003); the homepage keeps its sections
  until then so nothing disappears
- assessment form behavior
- analytics

## Required References

- ../03-INFORMATION-ARCHITECTURE.md
- ../05-TECHNICAL-CONSTRAINTS.md
- ../01-CURRENT-STATE.md
- ../10-DESIGN-SYSTEM-INVENTORY.md

## Implementation Requirements

- Use existing routing and navigation patterns.
- Safe placeholders are acceptable.
- Move the `--hai-*` tokens out of `.landing-shell` to a scope every route
  shares, so placeholder pages inherit them (`10-DESIGN-SYSTEM-INVENTORY.md`).

## Acceptance Criteria

- [x] All routes resolve
- [x] Every existing section is reachable on its own route
- [x] Existing navigation still works
- [x] Mobile nav still works

## Validation

- Run route tests/build/lint.

## Expected Files / Areas

- route config
- navigation component
- placeholder pages

## Completion Notes

Completed 2026-10-05.

What changed:

- **Routes** (`apps/hai/src/app/app.routes.ts`): `/private-cloud` and its
  four sub-routes, `/turn-key-appliances`, `/software-stacks`,
  `/cost-comparison`, `/custom-software`, `/partners`, `/how-we-work`,
  `/contact`. Each offering page hosts its existing section component(s)
  unchanged; `/private-cloud` hosts the independent-infrastructure section
  (D014) under a page intro with the approved headline and freedom principle,
  linking to its four sub-pages. The sub-pages are placeholders driven by
  route `data`. The homepage is unchanged and keeps all its sections until
  S003.
- **Shared content and behaviour:** homepage copy moved to
  `content/site-content.ts`; contact submission and the calculator-to-contact
  prefill moved to `services/contact-request.service.ts`; reduced-motion
  detection to `services/reduced-motion.ts`. The homepage uses all three,
  with identical output. The calculator on `/cost-comparison` carries its
  comparison to `/contact`.
- **Tokens:** the `--hai-*` tokens, page gutter, and page background moved
  from `.landing-shell` to a `<main class="page">` in the app shell, so every
  route inherits them.
- **Navigation (D015):** the full tree, with a Solutions group, is in the
  `navigation-ui` drawer, opened by a Menu button at every width
  (`content/navigation.ts`). The desktop header links Private Cloud, Cost
  Comparison, How We Work, and Contact with `aria-current` on the active page;
  Schedule Free Audit and the brand link are router links. Hash-anchor
  scrolling was removed from the title bar. The router now scrolls to the top
  on navigation and honours fragments.
- **New shared component:** `components/page-intro` (eyebrow, `h1`, summary,
  onward links). Pages that host a moved section have a visually hidden `h1`
  (`.visually-hidden` in `styles.scss`) so each page has exactly one.

Validation (all with `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`):

- `nx test hai`: pass, 99 tests (66 before). New coverage: every route loads
  a component, every nav entry has a route, drawer tree and active state,
  header links, contact service, each page's `h1` and section, the
  calculator-to-contact flow, placeholder data.
- `nx lint hai`: pass. `tsc -p apps/hai/tsconfig.app.json`: pass.
- `nx build hai`: pass. Initial total 847.24 kB raw / 189.30 kB transfer
  (was 835.93 / 182.74).
- Production build served locally: all 13 routes return 200 with
  server-rendered HTML and the expected `h1`. Playwright at 375 and 1440 px,
  light and dark: no horizontal overflow, no page errors. Drawer navigation
  works at both widths and lands at the top of the new page; header links set
  `aria-current`; Schedule Free Audit reaches `/contact`. Homepage pixel diff
  against the S001 capture shows only the animated hero rings changing.

Changed files:

- `apps/hai/src/app/app.component.{html,scss}`, `app.config.ts`,
  `app.routes.ts`, `app.routes.spec.ts`
- `apps/hai/src/app/components/landing/landing.component.{ts,html,scss}`
- `apps/hai/src/app/components/title-bar/title-bar.component.{ts,html,scss,spec.ts}`
- `apps/hai/src/app/components/page-intro/` (new)
- `apps/hai/src/app/content/site-content.ts`, `content/navigation.ts` (new)
- `apps/hai/src/app/pages/` (new: nine page components and
  `offering-pages.spec.ts`)
- `apps/hai/src/app/services/contact-request.service{,.spec}.ts`,
  `services/reduced-motion.ts` (new)
- `apps/hai/src/styles.scss`
- `docs/plans/hai-private-cloud/03-INFORMATION-ARCHITECTURE.md`,
  `09-DECISION-LOG.md` (D014, D015), `README.md`, this slice

## Deviations / Blockers

- The Solutions group in the drawer is a button with no destination, because
  the shared `otui-nav-sidebar` renders every node as a button. It does
  nothing when pressed. Fixing that belongs in `navigation-ui`, outside this
  slice.
- `personal-cloud-section` still carries the stray `id="comparison"` anchor,
  now on `/private-cloud`. Sections were moved unchanged by design; it can go
  when the section is next edited.
- No not-found route exists; unknown paths behave as before.
- Moved-section pages have no visible page intro yet. S009–S011 and the
  content slices add one.
