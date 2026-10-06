# Decision Log

## D001 — Private cloud is additive

Private-cloud marketing extends the existing HAI offering rather than replacing software, appliance, or consulting positioning.

## D002 — Ownership is the primary differentiator

Lead with ownership, portability, local support, and practical control rather than privacy ideology alone.

## D003 — Mature OSS is preferred for commodity services

HAI should not rebuild file sync, photo management, media streaming, or similar commodity services when mature open-source products exist.

## D004 — Faith groups terminology

Use `Faith groups`, not `Churches`.

## D005 — Brand mark

Use the HAI favicon-style mark without the `dev` suffix.

## D006 — No cross imagery

Public private-cloud marketing should remain broadly applicable and use no cross-specific imagery.

## D007 — QR destination follows production

Final print QR destinations should be updated after production routes are confirmed, then tested with campaign parameters.

## D008 — Colour comes from the theme, not literals

The palette described in `02-BRAND-AND-DESIGN-CONSTRAINTS.md` (deep teal /
charcoal, cyan, orange) is not hard-coded. The user's theme supplies colour
and the personality shapes how it is applied. New and touched styles use theme
and personality variables (`var(--token, fallback)`); existing colour literals
in the HAI app are replaced with variables as their files are touched.

## D009 — QR and campaign URLs are validated on the dev server with the owner

Campaign URLs and QR destinations are checked together with the owner against
a locally running dev server. Production verification is part of the owner's
manual deployment.

## D010 — The release deliverable is a pull request

Deployment is a manual owner step and there is no Kubernetes cluster yet. S018
delivers a green PR, rollback notes, and `scripts/smoke-test-hai.sh`, which the
owner runs against the deployed host. The agent does not merge or deploy. S018
moves after S019 so the PR includes the validated campaign URLs.

## D011 — Overview homepage, one route per offering

The homepage carries headlines only: one short pitch and a link per offering.
Each business offering (private cloud, turn-key appliances, software stacks,
cost comparison, custom software, partners, how we work, contact) has its own
route with the detail. This replaces the current single-page layout.

## D012 — Keep the `foundation` personality as the HAI default

HAI keeps `foundation` (square, borderless panels). Visitors choose any
personality, light or dark mode, and their own palette from the Appearance
menu at any time, so pages must look right under every personality, not just
the default. Rounded or outlined panels are never hard-coded.

## D013 — Owner supplies the `dev`-free mark

The owner will produce the HAI mark without `dev`. Brand-mark slices wait for
that asset rather than editing the existing PNGs.

## D014 — Independent infrastructure folds into private cloud

The independent-infrastructure section (VPS and on-premises mini-servers) is
private-cloud content. It moves to `/private-cloud` rather than getting its
own route.

## D015 — Navigation uses the `navigation-ui` drawer

The full page tree, including a Solutions group, lives in the shared
`otui-nav-sidebar` drawer from `libs/navigation-ui`, available at every
width. The header keeps only a few direct links.

## D016 — Freedom commitments confirmed

The owner confirmed the three commitments shown with the freedom principle:
open-source software so data stays in formats other tools can read; accounts
and admin access in the customer's name; documentation handed over so another
qualified provider can take over. They live in `FREEDOM_COMMITMENTS`
(`apps/hai/src/app/content/private-cloud.ts`) and may be reused on any page.

## D017 — "Free audit" means the contact form; "assessment" means the assessment form

A free audit is a call to action to fill out the contact form, so every
"Schedule a free audit" link goes to `/contact`. "Start an assessment" goes
to `/private-cloud/assessment`, which S013 builds as a dedicated
private-cloud assessment form. `apps/hai/src/app/cta-conventions.spec.ts`
enforces this on the header, homepage, and private-cloud pages.

## D018 — Pass-through pricing replaces the 35% markup

Hardware is billed at the actual price HAI pays, with no markup. This
replaces the Slice 11 `raw cost × 1.08 × 1.35` customer price. Freight and
tax are passed through at the actual amounts on the order, not a flat 8%
allowance. The backend pricing engine, quotes, proposals, and Appliance Portal
were moved to this model on 2026-10-06 (`11-PRICING-ASSESSMENT.md` section 8).
The rate is stated in three places (website, quote engine, portal) and
`apps/hai/src/app/labor-rate-sync.spec.ts` keeps them equal.

## D019 — A published hourly labor rate

Labor (setup, migration, support) is billed at a published hourly rate. The
rate targets roughly $30–40/hour for the technician plus capital accrual for
HAI, and can be adjusted. **$65/hour**, confirmed by the owner on 2026-10-06 (derivation in
`11-PRICING-ASSESSMENT.md`). It lives in one constant,
`LABOR_RATE_PER_HOUR`. The owner also confirmed the promise that customers
see the receipts for hardware they are billed for.

## D020 — Leasing is available on request through a third-party lender

HAI has no leasing in place. The site says leasing is available on request;
a lender would buy the hardware at cost and set its own lease terms, which
the customer sees before committing. No lease prices are published. Finding
a lender is separate work.

## D021 — Support and software fees are labor

Ongoing support and monthly plans are billed at the labor rate for an agreed
number of hours, plus any service costs (cloud, SMS, network) passed through
at actual amounts. The Slice 11 70% retainer margin floor no longer applies.
Existing fixed monthly figures ($50 software, $300–$849 retainers) are
withdrawn until re-derived on this basis.

## D022 — Honest pricing everywhere

Show an actual price only where it can be stated confidently; always explain
the pricing structure; and say plainly when something is quoted per job
because no fixed price exists. Static or unsourced figures are not presented
as prices.
