# S006 — Home Private-Cloud Page

## Status

Complete

## Objective

Build `/private-cloud/home` using the approved household messaging.

## Why this slice exists

Household customers need an outcome-focused page without technical overload.

## Dependencies

S005

## In scope

- Storage
- photos
- media
- remote access
- backups
- home use cases
- example architecture
- assessment CTA

## Out of scope

- Organization messaging
- hardware SKU catalog

## Required References

- ../04-CONTENT-AND-MESSAGING.md
- ../02-BRAND-AND-DESIGN-CONSTRAINTS.md

## Implementation Requirements

- Lead with outcomes, not product names.

## Acceptance Criteria

- [x] Route loads
- [x] Home messaging is accurate
- [x] CTA works
- [x] No text overflow

## Validation

- Build/test and responsive checks.

## Expected Files / Areas

- home private-cloud page

## Completion Notes

Completed 2026-10-05.

`/private-cloud/home` replaces its S002 placeholder, top to bottom:

1. **Hero:** `h1` "Photos, files, media, and backups — set up for you." with
   the rest of the approved household line ("supported by real people") in
   the summary; **Start an assessment** is the one primary action.
2. **What you get** (six outcomes): room for everything (storage), every
   photo in one place, your own media library, reach it away from home
   (remote access), backups you never think about, a space for each person;
   followed by the shared configuration qualifier.
3. **Why families start** (home use cases): full phones, files in four
   places, family photos on an old laptop.
4. **How it fits together** (example architecture, new
   `hai-architecture-diagram`): devices → home network → private cloud →
   a second copy, with an "example only" caption. Built as an ordered list in
   a `figure`, so it reads correctly without the visual arrows.
5. **Freedom guarantee** teaser (D016 commitments), linking to the
   open-source stack.
6. **Closing panel:** Start an assessment, with "Running an organization
   instead?" linking to `/private-cloud/organizations`.

No product names appear (outcomes first, per the slice). Copy lives in
`content/private-cloud.ts` (`HOME_*`). `hai-capability-grid` gained
`sectionId`, `eyebrow`, and `heading` inputs so one component serves both
outcome and use-case grids, and a `three-up` modifier that keeps
three-item grids on one row down to 640 px instead of orphaning a card.

Validation (all with `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`):

- `nx test hai`: pass, 118 tests. New
  `private-cloud-home-page.component.spec.ts` covers the household message,
  both primary actions targeting the assessment, the five required outcome
  areas, no product names, use cases and the `three-up` modifier, the
  architecture tiers and caption, the freedom principle, the organizations
  link, and prohibited claims.
- `nx lint hai`, `tsc`, `nx build hai`: pass.
- Production build in Chromium at 375, 430, 768, 1024, 1440, 1920 px, light
  and dark: no overflow, no page errors. Outcomes 1 / 1 / 2 / 3 / 3 / 3,
  use cases 1 / 1 / 3 / 3 / 3 / 3, diagram vertical below 1200 px and four
  across above. All links reach their routes at the top of the page.
  `/private-cloud` re-checked after the shared grid change: unchanged.

Changed files:

- `apps/hai/src/app/pages/private-cloud-home/` (new page and spec)
- `apps/hai/src/app/components/private-cloud/architecture-diagram.component.{ts,html,scss}` (new)
- `apps/hai/src/app/components/private-cloud/capability-grid.component.{ts,html,scss}`
- `apps/hai/src/app/content/private-cloud.ts`
- `apps/hai/src/app/app.routes.ts`
- `docs/plans/hai-private-cloud/09-DECISION-LOG.md` (D016), `README.md`, this
  slice

## Deviations / Blockers

- The diagram went four-across first at 1024 px and wrapped every word or
  two; it now stacks vertically below 1200 px.
- A specificity bug in the first `three-up` attempt put the six-outcome grid
  in two columns on phones; caught by the rendered check and fixed before
  completion.
- The approved household line is split across the `h1` and the summary,
  because the whole sentence ran to five lines as a heading on phones.
