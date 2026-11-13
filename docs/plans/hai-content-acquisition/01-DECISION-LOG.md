# Decision Log

## C001 — The "48-Hour Rapid Onboarding" banner is hidden

The homepage banner claims 48-hour onboarding, and its scope has not been
defined. The claim is removed from the homepage until the owner defines what it
covers. The local on-site wording stays. Date: 2026-11-11.

## C002 — The contact acknowledgement stays

"Within one business hour, Monday–Friday, 9 a.m.–5 p.m. Eastern" is an approved,
published promise and stays exactly as written, even though the handoff
discourages fixed response times. Date: 2026-11-11.

## C003 — Service-area wording

Use "On-site in Savannah and South Georgia; remote where the work allows." wherever
the service area is stated. Date: 2026-11-11.

## C004 — Support and training pricing wording

Technical support cites the existing $65/hour labour rate (D019). Training says
"quoted before work begins" and states no price. Date: 2026-11-11.

## C005 — Training modes

One-on-one instruction is "Available now". Group sessions and online resources
are "Planned" and are not linked. Date: 2026-11-11.

## C006 — Old copy branch ignored; route names

The old branch `update-hai-site-copy` is ignored. The training route is
`/training`. `/web-design` and `/hardware-support-and-repair` are not added.
Date: 2026-11-11.

## C007 — Navigation

Training and Support are added to the drawer. In the header they replace
"Cost Comparison", which stays in the drawer. Date: 2026-11-11.

## C008 — Logo source and colour

The owner is converting the `dev`-free mark to SVG. R6 is blocked until it
arrives. The mark's colour follows the theme `--primary` (it renders `#33cc88`
under the default palette), consistent with the rule that personality never
chooses colour. Date: 2026-11-11.

## C009 — No component extraction in this packet

Nothing moves to `common-ui` in this packet. Pages reuse the existing app-local
components `hai-audience-selector`, `hai-cta-panel`, `hai-how-it-works` and
`hai-page-intro`. Date: 2026-11-11.

## C010 — Call-to-action wording

The hero primary CTA becomes "Tell us what you need". The header button and the
closing panel keep "Schedule Free Audit" (D017). Date: 2026-11-11.

## C011 — No e2e project for now

The site is website-first, so no e2e project is added. Evidence is the unit
specs, `seo-coverage`, `scripts/smoke-test-hai.sh` and manual browser
screenshots. Revisit later. Date: 2026-11-11.

## C012 — Copy beyond the handoff approved

The owner approved all the copy written in R1–R5 beyond the handoff text:
support limits, training "Planned" labels, pathway and offerings headings,
cross-link prompts, and the ecosystem independence sentence. Date: 2026-11-12.

## C013 — Support & Migration stays

The "Support & Migration" offering stays alongside the "Get Help" pathway card.
The two are not the same thing. Date: 2026-11-12.

## C014 — Ecosystem additions

Homestead and Statocyst are added to the ecosystem. They live in separate
repositories. Jellyfin Harbor and PXE are not listed; they are in development
but paused. Date: 2026-11-12.

Homestead is a private cloud management tool used to set up private clouds for
clients. Statocyst is a Jellyfin-powered music player and podcast client for
desktop, Android and iOS, with Android Auto and Apple CarPlay. Neither has a
public link yet, so the cards stay unlinked.

## C015 — Training and Technical Support in the offerings grid

The homepage offerings grid gets Training and Technical Support blocks.
Date: 2026-11-12.

## C016 — Traced logo SVG as a stand-in

While the designer works on the new logo, the header uses an SVG traced from
`haidev-logo.png` (`assets/haidev-logo.svg`). Its two blues read
`--hai-logo-deep` and `--hai-logo-bright`, falling back to the original colours.
The designer's SVG replaces it in R6. The PNG and WebP files stay for the app
registry and icons. Date: 2026-11-13.
