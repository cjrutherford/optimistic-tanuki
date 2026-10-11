# S015 — SEO and Social Metadata

## Status

Complete

## Objective

Add complete metadata for all private-cloud routes.

## Why this slice exists

New pages need discoverability and correct social previews.

## Dependencies

S014

## In scope

- titles
- descriptions
- canonical URLs
- OpenGraph
- sitemap
- schema where appropriate

## Out of scope

- Content redesign

## Required References

- ../06-SEO-ANALYTICS-ACCESSIBILITY.md

## Implementation Requirements

- Follow current framework metadata conventions.

## Acceptance Criteria

- [x] Unique metadata exists
- [x] Canonical URLs correct
- [x] Sitemap updated

## Validation

- Build and metadata inspection.

## Expected Files / Areas

- route/page metadata
- sitemap

## Completion Notes

Completed 2026-10-07.

- **Metadata for all 13 routes** in `content/seo.ts`: unique titles
  (including the four suggested in `06-SEO-ANALYTICS-ACCESSIBILITY.md`,
  verbatim) and descriptions of 70–170 characters.
- **`SeoTitleStrategy`** (Angular `TitleStrategy`, the framework's metadata
  hook; tags via `Meta`/`Title` as in local-hub) runs on every navigation,
  including the server render. It sets title, description, canonical URL
  (`https://hopefulaspirationsindustries.com/<path>`, query and fragment
  stripped so campaign links do not split rankings), OpenGraph (type, site
  name, locale, title, description, URL, image with size and alt) and
  Twitter `summary_large_image` tags, updating in place.
- **Structured data** (JSON-LD): `ProfessionalService` on every page (name,
  URL, phone, email, Savannah/South Georgia service area, topics), plus a
  `Service` for private cloud on `/private-cloud/*`. Facts only; no prices,
  ratings, or claims.
- **`sitemap.xml`** listing the 13 page routes and **`robots.txt`** (allow
  all; disallow `/oauth/` and `/api/`; points to the sitemap) in
  `apps/hai/public/`.
- **Social image:** interim `assets/social-card.jpg` (928×486, 1.91:1),
  cropped from the HAI contact photograph.

Validation:

- `nx test hai`: pass, 215 tests. New: strategy (all tags, canonical
  without query, in-place updates with no duplicates, schema per page,
  fallback) and `seo-coverage.spec.ts` (metadata for exactly the page
  routes, unique titles and descriptions within length, sitemap equals the
  routes on the canonical host, robots.txt content).
- `nx lint hai`, `nx build hai`: pass.
- Server-rendered HTML for all 13 routes, requested with
  `?utm_source=print`: unique title, exactly one description, canonical and
  `og:url` equal to the clean canonical URL, expected JSON-LD types. Sitemap,
  robots.txt, and the social image served with correct content types.

## Deviations / Blockers

- The social preview image is an interim crop below the recommended
  1200×630. Replace it with a purpose-made card once the `dev`-free logo
  exists (D013); only `SOCIAL_IMAGE` in `content/seo.ts` changes.
- The sitemap is static. `seo-coverage.spec.ts` fails if routes and sitemap
  drift apart.
