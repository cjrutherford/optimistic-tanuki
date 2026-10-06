# S010 — Software-Stack Integration

## Status

Complete

## Objective

Add a Private Cloud Stack entry to the existing software-stacks page.

## Why this slice exists

The private-cloud OSS stack should connect naturally to existing software-stack marketing.

## Dependencies

S009

## In scope

- Private Cloud Stack summary
- links to full OSS page

## Out of scope

- Rewriting unrelated stack content

## Required References

- ../04-CONTENT-AND-MESSAGING.md

## Implementation Requirements

- Work on the `/software-stacks` route created in S002 (D011).
- Keep existing stacks intact.

## Acceptance Criteria

- [x] New stack entry exists
- [x] Links resolve
- [x] Existing content unchanged except necessary layout adjustments

## Validation

- Build/test.

## Expected Files / Areas

- software-stacks page

## Completion Notes

Completed 2026-10-06.

`/software-stacks`, top to bottom:

1. **Visible page intro** (replaces the S002 visually hidden `h1`): "Tools
   matched to your trade.", a summary that now mentions the private cloud
   stack, **Schedule a free audit** → `/contact` (D017), and in-page links to
   Industry stacks (`#stacks`) and Private cloud stack
   (`#private-cloud-stack`).
2. **Existing industry stacks** (`hai-solutions-matrix`), content unchanged.
3. **Private cloud stack entry** (new `hai-stack-summary`,
   `#private-cloud-stack`): one-sentence summary; the five core services as
   project and role; the named platform projects; the "varies by customer"
   qualifier; links to `/private-cloud/open-source-stack` (full detail),
   `/private-cloud`, and `/private-cloud/assessment`.

The entry is a separate block, not a new matrix tab: matrix verticals need a
hardware tier, white-box apps, and commercial terms, which would mean
inventing pricing for private cloud. It reads from the same
`CORE_SERVICES` / `PLATFORM_COMPONENTS` / `STACK_QUALIFIER` as the full OSS
page, so the two cannot drift.

Layout adjustment to existing content: at 375 and 430 px the matrix's
industry badge ("Electrical, plumbing, HVAC, roofing, and general trade
contractors") ran past the viewport and was clipped, because the shared
badge sets `white-space: nowrap`. The matrix now lets that badge wrap
(`solutions-matrix.component.scss`, following its existing `:host ::ng-deep`
pattern); no content changed. The shared badge component was not touched.

Validation (all with `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`):

- `nx test hai`: pass, 153 tests. New
  `software-stacks-page.component.spec.ts` covers the visible `h1` and audit
  action, the preserved matrix, both intro anchors, the entry's core
  services, qualifier and no prices, the named platform projects, and the
  three links. `cta-conventions.spec.ts` now includes this page.
- `nx lint hai`, `tsc`, `nx build hai`: pass. Matrix stylesheet 7.98 kB,
  under the 8 kB warning budget.
- Production build in Chromium at 375, 430, 768, 1024, 1440, 1920 px, light
  and dark: no overflow (badge clipping fixed), no page errors. Both anchors
  land below the sticky header; all four links reach their routes at the top
  of the page.

Changed files:

- `apps/hai/src/app/pages/software-stacks/software-stacks-page.component{,.spec}.ts`
- `apps/hai/src/app/pages/offering-pages.spec.ts` (case moved to the page
  spec)
- `apps/hai/src/app/components/private-cloud/stack-summary.component.{ts,html,scss}` (new)
- `apps/hai/src/app/components/solutions-matrix/solutions-matrix.component.scss`
- `apps/hai/src/app/content/private-cloud.ts`
- `apps/hai/src/app/cta-conventions.spec.ts`
- `docs/plans/hai-private-cloud/README.md`, this slice

## Deviations / Blockers

- The matrix stylesheet is now 209 bytes under the 8 kB warning budget;
  further matrix styling should move to the shared section partial (S012).
- The badge clip was missed earlier because `/software-stacks` was last
  rendered in S002, whose overflow check measured only headings,
  paragraphs, links, and list items. Checks from S005 on measure every
  element in `main`. To close the gap, the remaining routes not re-checked
  since S002/S003 (`/`, `/cost-comparison`, `/custom-software`, `/partners`,
  `/how-we-work`, `/contact`, `/private-cloud/assessment`) were swept at all
  six widths with the full-element check: no overflow, no page errors.
