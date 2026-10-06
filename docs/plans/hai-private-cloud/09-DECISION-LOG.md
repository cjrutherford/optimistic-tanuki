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
