# S007 — Organization Private-Cloud Page

## Status

Complete

## Objective

Build `/private-cloud/organizations` for faith groups, nonprofits, community groups, and small businesses.

## Why this slice exists

Organizations need different buying language and collaboration/support messaging.

## Dependencies

S006

## In scope

- Shared files
- reliable backups
- setup/support
- audience section
- Freedom Guarantee
- audit CTA

## Out of scope

- Church-specific branding
- hardware catalog

## Required References

- ../04-CONTENT-AND-MESSAGING.md
- ../02-BRAND-AND-DESIGN-CONSTRAINTS.md

## Implementation Requirements

- Use `Faith groups`.
- No cross imagery.

## Acceptance Criteria

- [x] No use of `Churches` as audience label
- [x] No cross imagery
- [x] Route loads
- [x] Audit CTA works

## Validation

- Build/test and responsive checks.

## Expected Files / Areas

- organization private-cloud page

## Completion Notes

Completed 2026-10-05.

`/private-cloud/organizations` replaces its S002 placeholder, top to bottom:

1. **Hero:** `h1` "Shared files, secure backups, and local support." with
   "Without vendor lock-in." leading the summary (the approved organization
   line, split as on the home page). **Schedule a free audit** is the one
   primary action.
2. **Who we work with** (audience section): Faith groups, Nonprofits,
   Community groups, Small businesses, each with one line on what they keep.
3. **What you get:** shared files, reliable backups, setup and support, with
   the configuration qualifier.
4. **Questions boards and owners ask:** who owns the data, what if HAI is no
   longer around, what will it cost — answered from D016 commitments, with
   no prices ("the audit ends with a written estimate").
5. **Freedom guarantee** teaser.
6. **Closing panel:** Schedule a free audit, with "Prefer to talk first?
   Contact us".

The audit CTA targets `/private-cloud/assessment`, satisfying both this
slice's "audit CTA" and the IA rule that every private-cloud page links to
the assessment. Copy lives in `content/private-cloud.ts` (`ORGANIZATION_*`).
`hai-capability-grid` gained a `columns` input (default 3) for the
four-audience row; it still drops to two columns at 960 px and one at
640 px. No images or icons on the page, so no cross imagery.

Validation (all with `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`):

- `nx test hai`: pass, 125 tests. New
  `private-cloud-organizations-page.component.spec.ts` covers the approved
  message, both audit actions targeting the assessment and the contact
  fallback, the four audiences with Faith groups and no "church", the three
  required outcomes, the questions with no prices, the freedom principle,
  no images or cross characters, and prohibited claims.
- `nx lint hai`, `tsc`, `nx build hai`: pass.
- Production build in Chromium at 375, 430, 768, 1024, 1440, 1920 px, light
  and dark: no overflow, no page errors. Audiences 1 / 1 / 2 / 4 / 4 / 4;
  three-item grids 1 / 1 / 3 / 3 / 3 / 3. `/private-cloud` and
  `/private-cloud/home` re-checked after the grid change: unchanged. All
  links reach their routes at the top of the page.

Changed files:

- `apps/hai/src/app/pages/private-cloud-organizations/` (new page and spec)
- `apps/hai/src/app/components/private-cloud/capability-grid.component.{ts,html,scss}`
- `apps/hai/src/app/content/private-cloud.ts`
- `apps/hai/src/app/app.routes.ts`
- `docs/plans/hai-private-cloud/README.md`, this slice

## Deviations / Blockers

- Revised 2026-10-06 per D017. The page first labelled its primary button
  "Schedule a free audit" and pointed it at the assessment. A free audit is
  the contact form, so the primary action is now **Start an assessment**
  (`/private-cloud/assessment`) and the audit CTA is the closing panel's
  secondary link, **Schedule a free audit** → `/contact`. The cost answer
  now says "You get a written estimate" rather than tying it to the audit.
  `cta-conventions.spec.ts` enforces the rule site-wide and fails on the old
  wiring. Tests: 141 passing.
