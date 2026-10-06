# S005 — Private-Cloud Landing Page

## Status

Complete

## Objective

Build `/private-cloud` as the primary marketing landing page and print/QR destination.

## Why this slice exists

This is the main conversion page for the new service.

## Dependencies

S004

## In scope

- Hero
- capability overview
- Home vs Organizations selector
- Freedom Guarantee teaser
- How It Works summary
- assessment CTA

## Out of scope

- Home-specific details
- Organization-specific details
- assessment form implementation

## Required References

- ../04-CONTENT-AND-MESSAGING.md
- ../02-BRAND-AND-DESIGN-CONSTRAINTS.md
- ../03-INFORMATION-ARCHITECTURE.md

## Implementation Requirements

- Use approved messaging hierarchy.
- One obvious primary CTA.

## Acceptance Criteria

- [x] Route loads
- [x] Home/Organizations links work
- [x] CTA targets assessment
- [x] No overflow at target breakpoints

## Validation

- Build/test plus responsive checks.

## Expected Files / Areas

- private-cloud landing page
- shared sections

## Completion Notes

Completed 2026-10-05.

`/private-cloud` is now the full landing page, top to bottom:

1. **Hero** (`hai-page-intro`, which gained an optional primary `action`):
   "A cloud you control.", one-sentence summary, **Start an assessment** →
   `/private-cloud/assessment`. This is the page's one primary action.
2. **Capabilities** (`hai-capability-grid`): files and sharing, photos,
   media, documents and passwords, backups, remote access — capability-level,
   no product names (those are S008) — with the qualifier "Every setup is
   different… nobody gets everything by default."
3. **Home vs Organizations selector** (`hai-audience-selector`): approved
   home and organization messages and audience lists from
   `04-CONTENT-AND-MESSAGING.md`, linking to `/private-cloud/home` and
   `/private-cloud/organizations`. Uses "Faith groups".
4. **How it works** (`hai-how-it-works`): Assessment → Plan → Install and
   migrate → Support, linking to `/how-we-work`.
5. **Freedom guarantee teaser** (`hai-freedom-teaser`): the freedom principle
   as the heading, three commitments (open-source formats; accounts and admin
   access in the customer's name; documentation handed over), linking to
   `/private-cloud/open-source-stack`. Commitments restate what the existing
   site already promises; none guarantees savings, uptime, or security.
6. **Independent infrastructure** (existing section, D014).
7. **Closing panel** (`hai-cta-panel`): Start an assessment again, with
   "Prefer to talk first? Contact us" as the secondary route.

Copy lives in `content/private-cloud.ts`. The new components live in
`components/private-cloud/` and take all content as inputs, so S006–S008 and
S012 can reuse them. They share a new partial,
`apps/hai/src/app/styles/_section.scss` (eyebrow, headings, body copy, panel,
primary action, lift with reduced-motion handling), which stops further
copies of the section styles; S012 can move the older sections onto it.

Validation (all with `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`):

- `nx test hai`: pass, 110 tests. New `private-cloud-page.component.spec.ts`
  covers the single `h1`, both primary actions targeting the assessment, the
  capabilities and qualifier, both audience links and Faith groups wording,
  the steps and process link, the freedom principle and stack link, the
  infrastructure section, the contact fallback, and prohibited claims.
- `nx lint hai`, `tsc`, `nx build hai`: pass. New stylesheets 0.7–2.3 kB.
- Production build in Chromium at 375, 430, 768, 1024, 1440, 1920 px, light
  and dark: no overflow, no page errors. Capabilities 1 / 1 / 2 / 3 / 3 / 3
  columns, audience cards 1 / 1 / 2 / 2 / 2 / 2, steps 1 / 1 / 2 / 4 / 4 / 4.
  All seven links reach their routes and settle at the top of the page.

Changed files:

- `apps/hai/src/app/pages/private-cloud/private-cloud-page.component{,.spec}.ts`
- `apps/hai/src/app/pages/offering-pages.spec.ts` (old private-cloud test
  replaced by the page spec)
- `apps/hai/src/app/components/private-cloud/` (new: capability grid,
  audience selector, how it works, freedom teaser, CTA panel)
- `apps/hai/src/app/components/page-intro/page-intro.component.{ts,html,scss}`
- `apps/hai/src/app/content/private-cloud.ts` (new)
- `apps/hai/src/app/styles/_section.scss` (new)
- `docs/plans/hai-private-cloud/README.md`, this slice

## Deviations / Blockers

- Seven capabilities left orphan rows at wide widths; Documents and
  Passwords were merged so the grid is a clean 3 / 2 / 1.
- After any route change the page animates back to the top, because
  `styles.scss` sets `scroll-behavior: smooth` on `html` without a
  reduced-motion exception. Pre-existing; flagged for S016.
- The independent-infrastructure section keeps its own, larger heading style
  and the stray `#comparison` anchor; both go when that section moves onto
  the shared partial (S012).
- The Freedom guarantee teaser has no dedicated page to link to yet; it
  points at the open-source stack page, which explains the portability.
