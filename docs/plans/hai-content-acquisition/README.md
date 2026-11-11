# HAI content and acquisition update

## Purpose

This packet tracks the HAI website content update described in the
owner-provided handoff "HAI Website — Unified Content & Acquisition Update"
(revised draft v3, 2026-11-11). The update adds practical technical support and
training to the marketing site, sharpens the contact path, and keeps the
existing private-cloud and professional-services content intact. It is an
incremental content and journey change in `apps/hai`, not a redesign. Decisions
that settle open questions in the handoff are recorded in
`01-DECISION-LOG.md` (C001–C011).

## Background: audit findings

- The HAI logo exists only as webp/png assets, so a theme-aware logo needs an
  SVG source from the owner (C008).
- The contact subject is a free string in the backend
  (`libs/blogging/contracts/src/lib/contact.ts`), so old subject values need no
  compatibility work.
- `lib-contact-form` had no initial-subject input; R1 adds one.
- There is no footer and no `hai-e2e` project (C011).
- Analytics event names are a closed list in
  `apps/hai/src/app/services/analytics.service.ts` and
  `apps/gateway/src/analytics/site-analytics.service.ts`. New journeys use the
  existing `cta_click` / `audience_interest` events with detail values.
- `seo-coverage` requires routes, `PAGE_SEO` and `public/sitemap.xml` to match
  exactly, with unique descriptions of 70–170 characters.

## Milestones

| Milestone | Scope                                                                                                                  | Depends on |
| --------- | ---------------------------------------------------------------------------------------------------------------------- | ---------- |
| R0        | Decision record.                                                                                                       | none       |
| R1        | Contact intent: new subjects, initial-subject input, `?subject=` handoff, contact H1/intro copy, acknowledgement kept. | R0         |
| R2        | The `/technical-support` page.                                                                                         | R1         |
| R3        | The `/training` page.                                                                                                  | R1         |
| R4        | Homepage lead, CTAs, pathway cards, banner; Support & Migration links to `/technical-support`.                         | R2, R3     |
| R5        | Cross-links and ecosystem status wording.                                                                              | R4         |
| R6        | Theme-aware logo (blocked on the SVG).                                                                                 | none       |
| R7        | Closing review: journeys, accessibility, analytics detail values, smoke run.                                           | R1–R6      |

## Status

| Milestone | Status      |
| --------- | ----------- |
| R0        | Done        |
| R1        | In progress |
| R2–R7     | Not started |
