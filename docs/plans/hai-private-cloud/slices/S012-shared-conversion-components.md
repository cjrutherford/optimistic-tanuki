# S012 — Shared Conversion Components

## Status

Complete

## Objective

Extract repeated conversion/UI patterns into reusable components.

## Why this slice exists

Abstractions should come from proven repetition across implemented pages.

## Dependencies

S011

## In scope

- How It Works
- Freedom Guarantee
- CTA panel
- contact strip
- audience selector

## Out of scope

- New page content

## Required References

- ../05-TECHNICAL-CONSTRAINTS.md
- ../02-BRAND-AND-DESIGN-CONSTRAINTS.md

## Implementation Requirements

- Refactor without changing approved appearance or copy.

## Acceptance Criteria

- [x] Repeated patterns are shared
- [x] Pages remain visually equivalent
- [x] Tests pass

## Validation

- Build/test/lint.

## Expected Files / Areas

- shared components
- affected pages

## Completion Notes

Completed 2026-10-06.

- **Shared components:** How It Works, Freedom Guarantee, CTA panel, audience
  selector, and capability grid were already built as input-driven
  components in S005–S009; they moved from `components/private-cloud/` to
  `components/shared/`, since the CTA panel, audience selector, and grid are
  used outside private cloud. Topic-specific components (architecture
  diagram, stack list, stack summary) stay in `private-cloud/`.
- **Contact strip (new):** `hai-contact-strip` shows the required phone
  (`tel:`), email (`mailto:`), contact form link, and website from
  `content/contact-details.ts` at the foot of every page (in the app shell).
  The long email wraps instead of overflowing. These details had never
  appeared on the site.
- **Homepage closing panel** now uses `hai-cta-panel` with the same copy.
- **Section styles:** seven homepage-era sections (contact, ecosystem,
  manifesto, offerings, infrastructure, private-cloud, services) plus the
  catalog and matrix now use `styles/_section.scss` for eyebrows and
  headings, where their values already matched. Engagement and partners keep
  their deliberately larger headings.
- **Calculator** styles moved to a stylesheet on the shared partial (panel,
  eyebrow, heading, lede); radii now come from the personality.
- **Cleanup:** removed the stray `#comparison` and `#stacks` anchors, the
  dead `body.dark` rule, and the last two colour literals. The HAI app now
  has no hard-coded colours; D008 is complete.

Visual equivalence, measured: every route rendered at 375 and 1440 px with
reduced motion before and after, compared above the new footer. Pixel
identical: `/`, `/private-cloud` and its sub-pages, `/turn-key-appliances`,
`/software-stacks`, `/partners`, `/contact` (desktop). Expected changes:
`/cost-comparison` (calculator restyle) and every page's new contact strip.
`/how-we-work` differs by anti-aliasing only. `/custom-software` changed for
the better: the removed `#stacks` div had occupied the first cell of the
services grid since S002, pushing the panel into the right column and
leaving the left empty; the intended two-column layout now renders.

Validation (all with `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`):

- `nx test hai`: pass, 182 tests (new: contact strip links and details;
  strip present in the app shell).
- `nx lint hai`, `tsc`, `nx build hai`: pass. Initial total 843.63 kB.
- Full-element overflow sweep of all 13 routes at 375, 430, 768, 1024,
  1440, 1920 px: no overflow, no page errors.

## Deviations / Blockers

- The contact page's form banner comes from the shared contact form's
  default `https://picsum.photos/1200/300`, a random external stock photo
  that changes on every load. Pre-existing; needs an owner decision
  (supply an image or remove it) and fits S017.
