# S009 — Turn-Key Appliance Integration

## Status

Complete

## Objective

Add Private Cloud Appliance positioning to the existing appliance page.

## Why this slice exists

Private cloud should connect to existing hardware/appliance positioning.

## Dependencies

S008

## In scope

- Private Cloud Appliance category
- cross-links to private cloud pages
- capability-tier language

## Out of scope

- Publishing unfinalized hardware SKUs

## Required References

- ../03-INFORMATION-ARCHITECTURE.md
- ../04-CONTENT-AND-MESSAGING.md

## Implementation Requirements

- Work on the `/turn-key-appliances` route created in S002 (D011).
- Sell capabilities before specific sourcing-dependent models.

## Acceptance Criteria

- [x] Existing appliance content preserved
- [x] Private cloud category is discoverable
- [x] Links work

## Validation

- Build/test and visual check.

## Expected Files / Areas

- turn-key appliance page

## Completion Notes

Completed 2026-10-06.

`/turn-key-appliances`, top to bottom:

1. **Visible page intro** (replaces the S002 visually hidden `h1`): "Servers
   that stay in your office.", a summary that now mentions private cloud
   appliances, **Schedule a free audit** → `/contact` (D017), and two
   in-page links, Business appliances (`#appliances`) and Private cloud
   appliances (`#private-cloud-appliances`), so both families are
   discoverable from the top.
2. **Existing hardware catalog**, unchanged.
3. **Private cloud appliances** (`#private-cloud-appliances`, reusing
   `hai-audience-selector`): three capability tiers — Household, Team, and
   Expanded private cloud — described by who they serve and what they hold,
   with no models, specs, or prices. A note says hardware is chosen after the
   assessment and models and prices depend on availability.
4. **Cross-links:** each tier links to the home or organizations page, and a
   link row goes to `/private-cloud`, `/private-cloud/open-source-stack`, and
   `/private-cloud/assessment`.

`hai-audience-selector` gained `sectionId`, `eyebrow`, `heading`, `columns`,
and `note` inputs (defaults unchanged for `/private-cloud`); grids wider than
two columns stack below 960 px. `PageIntroLink` gained an optional
`fragment`. Copy lives in `content/private-cloud.ts` (`APPLIANCES_HERO`,
`PRIVATE_CLOUD_APPLIANCE_TIERS`, `PRIVATE_CLOUD_APPLIANCE_NOTE`).

Validation (all with `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`):

- `nx test hai`: pass, 147 tests. New
  `turn-key-appliances-page.component.spec.ts` covers the visible `h1` and
  audit action, the preserved catalog, both intro anchors, the three tiers
  and note, no prices or catalog model names in the private-cloud section,
  and every cross-link. `cta-conventions.spec.ts` now includes this page.
- `nx lint hai`, `tsc`, `nx build hai`: pass.
- Production build in Chromium at 375, 430, 768, 1024, 1440, 1920 px, light
  and dark: no overflow, no page errors. Tiers 1 / 1 / 1 / 3 / 3 / 3.
  Both intro anchors land below the sticky header; all six other links reach
  their routes at the top of the page. `/private-cloud` re-checked:
  unchanged.

Changed files:

- `apps/hai/src/app/pages/turn-key-appliances/turn-key-appliances-page.component{,.spec}.ts`
- `apps/hai/src/app/pages/offering-pages.spec.ts` (turn-key case moved to the
  page spec)
- `apps/hai/src/app/components/private-cloud/audience-selector.component.{ts,html,scss}`
- `apps/hai/src/app/components/page-intro/page-intro.component.{ts,html}`
- `apps/hai/src/app/content/private-cloud.ts`
- `apps/hai/src/app/cta-conventions.spec.ts`
- `docs/plans/hai-private-cloud/README.md`, this slice

## Deviations / Blockers

- **Owner review needed (pre-existing):** the hardware catalog publicly
  shows each tier's wholesale cost and margin ("Wholesale cost: $522.22 with
  35% margin"), plus specific SKUs and prices. This slice preserves existing
  appliance content, so it was left as-is; the owner should decide whether
  cost and margin belong on a public page.
- Three tier cards at 768 px wrapped nearly every word; selectors wider than
  two columns now stack below 960 px.
