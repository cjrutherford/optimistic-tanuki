# S004 — Homepage Private-Cloud Section

## Status

Complete

## Objective

Add a concise private-cloud introduction to the homepage with Home and Organizations paths.

## Why this slice exists

Visitors need a discoverable path into the new service.

## Dependencies

S003

## In scope

- Private-cloud intro
- three capability cards
- Home/Organizations links
- CTA to /private-cloud

## Out of scope

- Dedicated private-cloud page implementation

## Required References

- ../02-BRAND-AND-DESIGN-CONSTRAINTS.md
- ../04-CONTENT-AND-MESSAGING.md

## Implementation Requirements

- Reuse current section/card components where possible.

## Acceptance Criteria

- [x] Section appears in logical homepage position
- [x] Links work
- [x] No overflow
- [x] Matches existing visual language

## Validation

- Build/test and responsive check.

## Expected Files / Areas

- homepage
- shared cards/buttons

## Completion Notes

Completed 2026-10-05.

A private-cloud section (`#private-cloud`, new
`landing/private-cloud-section` component) sits directly after the offerings
grid:

- Intro: eyebrow "Private cloud", `h2` "A cloud you control." (approved
  headline), one sentence on owned hardware, open-source software, and local
  support.
- Three capability cards on the existing `otui-card` (`neutral`/`soft`, as in
  the services section): Files and photos, Media and backups, Support
  without lock-in.
- Audience paths: For your home → `/private-cloud/home`, For organizations
  (Faith groups, nonprofits, community groups, small businesses) →
  `/private-cloud/organizations`.
- "Explore private cloud" → `/private-cloud`, styled as a secondary action so
  Schedule Free Audit remains the homepage's one primary action.

Copy lives in `PRIVATE_CLOUD_INTRO`, `PRIVATE_CLOUD_CAPABILITIES`, and
`PRIVATE_CLOUD_PATHS` in `content/site-content.ts`. To keep the approved
headline from appearing twice, the Private Cloud offering card's headline
changed from "A cloud you control." to "Your files, on your hardware."

Layout: capability cards 3 columns, 1 at ≤640 px; audience links 2 columns,
1 at ≤640 px; Explore link beside them on wide screens, below them at
≤960 px, full width at ≤640 px.

Validation (all with `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`):

- `nx test hai`: pass, 102 tests (new: section follows offerings, approved
  headline and three cards, the three links and their routes, headline used
  once).
- `nx lint hai`, `tsc`, `nx build hai`: pass. Section stylesheet 3.4 kB.
- Production build in Chromium at 375, 430, 768, 1024, 1440, 1920 px, light
  and dark: no overflow inside the section or on the page, no page errors.
  All three links reach their routes at the top of the page.

Changed files:

- `apps/hai/src/app/components/landing/private-cloud-section.component.{ts,html,scss}` (new)
- `apps/hai/src/app/components/landing/landing.component.{ts,html,spec.ts}`
- `apps/hai/src/app/content/site-content.ts`
- `docs/plans/hai-private-cloud/README.md`, this slice

## Deviations / Blockers

- Under the default `foundation` personality the path and Explore links are
  borderless, so their boxes are faint. That follows D012 (shape comes from
  the personality); outlined personalities render them as pills.
