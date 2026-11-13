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

## C017 — The About tag moves into the page flow on small screens

The floating "HAI · About this app" tag covered body text at 375 px even in its
collapsed form. `hai-about-tag` gets a third placement, `inline-compact`: it
floats at the bottom left on wide screens and, at 640 px and below, sits in the
flow after the page content in its full form, so it reserves its own space and
covers nothing. HAI uses it. The other apps keep `fixed`. Date: 2026-11-13.

## C018 — Secondary action is an outline in the brand text colour

The hero's "Explore training" button used a near-transparent surface fill and a
70%-transparent border, which read as a faint white box. The secondary action
now has a solid surface fill, a 2px solid border and text in `--primary-text`.
The border style is fixed to `solid` rather than `--personality-border-style`,
because a personality that draws no borders would leave the button borderless.
Date: 2026-11-13.

## C019 — Training and Technical Support links count as audience interest

Links to `/training` and `/technical-support` fire `audience_interest` with
those details, beside `home` and `organization`. Contact links with
`?subject=` already fired `cta_click: contact`, because the service matches on
the path. No new event names, and the gateway's detail pattern accepts the
values. Date: 2026-11-13.

## C020 — Left alone in R7

- The header logo's `alt` repeats the visible brand text at 1440 px (axe
  `image-redundant-alt`, minor). The logo is in R6's scope, so it waits for the
  designer's file.
- The hardware catalogue's configurator links fall back to
  `http://localhost:8091` when the app registry has no URL. That predates this
  work and is outside the HAI content scope.
- There is no `<footer>` landmark. The contact strip ends the page content.
  Not an axe violation; noted for a later pass.
  Date: 2026-11-13.

## C021 — The header logo is an inline, theme-aware SVG (stand-in artwork)

`hai-logo` (`components/logo/`) draws the traced logo inline, so theme variables
reach it. Deep parts fill with `--hai-logo-deep`, then `--primary-text`, then
`--primary`; bright parts with `--hai-logo-bright`, then `--primary`. No colour
is hard-coded. `--primary-text` is the theme's readable primary: it darkens in
light mode and lightens in dark mode until it holds contrast against the page.
Measured against the header, the deep fill is 5.9:1 or better in all six
seed/mode combinations. In dark mode the "deep" overlay is therefore lighter
than the "bright" shape; the two tones stay distinct but the shading inverts.
Clip ids are unique per instance. The SVG is `aria-hidden` inside the labelled
home link and takes an optional `label` for standalone use, which also closes
the C020 `image-redundant-alt` note. Path data lives only in `logo-paths.ts`;
the designer's SVG replaces those strings. The PNG, WebP, registry `iconUrl`s
and favicons are untouched. Date: 2026-11-13.

## C022 — `hai-logo` lives in hai-ui; the About tag and modal use it

The logo component moved from `apps/hai` to `libs/hai-ui` (`hai-logo/`, exported
from `@optimistic-tanuki/hai-ui`) so the shared "HAI · About this app" tag shows
the mark in every app. It replaces the tracked-out "HAI" text in a green square,
which clipped on the right. The logo sits straight on the tag surface with no
filled box: its fills follow the theme (C021), so a box would only add a second
colour decision. The tag keeps its `aria-label`; the logo is `aria-hidden`.
The modal header drops its gradient square for the logo too, and the unused
`--local-hai-mark-*` variables went with it. Path data is still only in
`hai-logo-paths.ts`. Date: 2026-11-13.

## C023 — In dark mode the logo's deep and bright shades swap

C021 left the shading inverted in dark mode: `--primary-text` is the lighter
colour there, so the "deep" overlay came out lighter than the "bright" shape,
and the bright fill (`--primary`) was only 2.2 to 2.6:1 on the dark header.
`hai-logo` now keys off `html[data-theme='dark']` (the attribute ThemeService
sets) with `:host-context`. Dark mode: bright parts take `--primary-text`; deep
parts take `--primary` eased 25% toward `--primary-text` with `color-mix`. The
plain swap left the blue seed's deep fill at 2.63:1, under the 3:1 target; the
mix clears it for all three seeds and the deep parts stay darker than the
bright ones. Light mode is unchanged. `--hai-logo-deep` and `--hai-logo-bright`
still win in both modes, and no colour is hard-coded. Measured against the
rendered header pixels behind the logo (seeds #204434, #1f4e8c, #b4532a), the
deep fill is 3.1:1 or better in all six seed/mode cases. Date: 2026-11-13.
