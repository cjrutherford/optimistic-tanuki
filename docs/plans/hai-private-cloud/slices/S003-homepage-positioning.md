# S003 — Homepage Positioning

## Status

Complete

## Objective

Update homepage positioning so the company-level story includes private cloud without replacing current offerings.

## Why this slice exists

The homepage must explain the broader ownership proposition.

## Dependencies

S002

## In scope

- Hero/supporting copy
- Ownership-oriented company positioning
- Reduce the homepage to an overview: a headline, one sentence, and a link per
  offering route (D011); detail sections leave the homepage

## Out of scope

- New private-cloud section
- Dedicated landing pages
- New copy on the offering routes

## Required References

- ../03-INFORMATION-ARCHITECTURE.md
- ../00-PROJECT-CHARTER.md
- ../04-CONTENT-AND-MESSAGING.md
- ../02-BRAND-AND-DESIGN-CONSTRAINTS.md

## Implementation Requirements

- Preserve existing business capabilities.
- Do not turn homepage into a private-cloud-only page.

## Acceptance Criteria

- [x] Homepage still represents appliances, stacks, and custom software
- [x] Messaging matches source of truth
- [x] No layout regressions

## Validation

- Build/test plus target breakpoint visual check.

## Expected Files / Areas

- homepage template/component
- homepage styles

## Completion Notes

Completed 2026-10-05.

The homepage is now an overview (D011), top to bottom:

1. Operational banner (unchanged).
2. Hero: "Technology you own." (company-level idea from
   `04-CONTENT-AND-MESSAGING.md`) with a lede naming private cloud,
   appliances, open-source software, and custom tools for homes,
   organizations, and businesses. Audience list now covers families, Faith
   groups / nonprofits / community groups, small businesses, and technology
   partners. The freedom principle stays in the hero card. Actions: Schedule
   Free Audit (`/contact`) and See What We Offer (`/#offerings`). The old
   "Stop paying monthly rent on your data" line was dropped as an implied
   savings claim.
3. Offerings (`#offerings`, new `offerings-section` component): one card per
   offering with a name, headline, one sentence, and a link to its route —
   Private Cloud, Turn-key Appliances, Software Stacks, Custom Software,
   Support & Migration (`/how-we-work`), Partners. Copy lives in `OFFERINGS`
   in `content/site-content.ts`. A neutral line links to `/cost-comparison`.
4. Delivery proof (ecosystem section, unchanged; stays per IA).
5. Closing panel with a single Schedule Free Audit action.

The hardware catalog, ROI calculator, industry stacks, services, manifesto,
infrastructure, engagement, partner, and contact sections left the homepage;
each lives on its S002 route. `LandingComponent` lost its contact and
calculator wiring accordingly.

Also fixed: router anchor scrolling ignored `scroll-margin-top`, so
`/#offerings` landed under the sticky header. `AppComponent` now gives
`ViewportScroller` an offset of the header height + 16 px; a test covers it
and fails without the offset. The hero `h1` uses `text-wrap: balance`.

Validation (all with `NX_DAEMON=false NX_ISOLATE_PLUGINS=false`):

- `nx test hai`: pass, 99 tests (landing spec rewritten for the overview:
  positioning, audiences, Faith groups, hero actions, every offering card,
  appliances/stacks/custom software present, no savings language, detail
  sections absent, single closing action).
- `nx lint hai`, `tsc`, `nx build hai`: pass. Initial total 847.39 kB.
- Production build in Chromium at 375, 430, 768, 1024, 1440, and 1920 px,
  light and dark: no horizontal overflow, no page errors; offerings grid is
  1 / 1 / 2 / 3 / 3 / 3 columns. "See What We Offer" lands the section 93 px
  from the top; offering cards and the comparison link reach their routes at
  the top of the page.

Changed files:

- `apps/hai/src/app/components/landing/landing.component.{ts,html,scss,spec.ts}`
- `apps/hai/src/app/components/landing/offerings-section.component.{ts,html,scss}` (new)
- `apps/hai/src/app/content/site-content.ts` (`OFFERINGS`)
- `apps/hai/src/app/app.component.ts`, `app.component.spec.ts`
- `docs/plans/hai-private-cloud/README.md`, this slice

## Deviations / Blockers

- The Delivery Proof section (nine product cards) is now the largest block
  on the homepage. It stays because `03-INFORMATION-ARCHITECTURE.md` keeps it
  there; the owner may want it trimmed or moved for a simpler page.
- Existing claims kept as-is and worth an owner review against
  `04-CONTENT-AND-MESSAGING.md`: the "48-Hour Rapid Onboarding" banner
  (labelled "Operational guarantee") and the "within one business hour"
  acknowledgement promise on the contact form.
- S004 should place its private-cloud section directly after the offerings
  grid; the Private Cloud card already links to `/private-cloud`.
