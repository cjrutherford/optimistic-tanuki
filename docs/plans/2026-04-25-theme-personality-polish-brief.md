# Theme Personality Polish Brief

## Summary
This brief captures the intended theme-personality direction for the landing
surfaces in `forgeofwill`, `digital-homestead`, and
`christopherrutherford-net`. The goal is not a full reskin. The goal is to
make the shared personality system visible in layout, typography, surface
treatment, and motion so each app reads as intentional instead of merely
themed.

## Forge of Will
- Product signal: high-energy project execution, ambitious planning, forged
  momentum.
- Existing strength: already has a distinctive cinematic landing page and
  motion-heavy identity.
- Current gap: some global UI primitives still lean on app-local defaults
  instead of personality-derived radius, typography, and transition tokens.
- Desired personality read: bold, kinetic, sharp, and decisive.
- Motion guidance:
  use motion to reinforce momentum and “active forge” energy.
  keep animated backgrounds and staged reveals, but anchor shared UI states to
  personality variables so buttons, cards, and transitions feel like the same
  system.
- Messaging the page should reinforce:
  “this is where focused work becomes shippable progress.”

## Digital Homestead
- Product signal: digital independence, ownership, practical self-hosting, and
  neighborhood-scale community.
- Current gap: the app has strong content, but the landing experience feels
  sectioned and generic instead of like one cohesive personality-led brand
  environment.
- Desired personality read: warm, grounded, organic, and resilient.
- Motion guidance:
  subtle rise-ins, atmospheric depth, and calm panel transitions.
  avoid noisy motion; the page should feel alive but unhurried.
- Visual cues to emphasize:
  pill or softened radii, layered translucent panels, dark-earth contrast, and
  content blocks that feel like a curated digital homestead rather than a
  stock marketing page.
- Messaging the page should reinforce:
  “own the tools, own the relationship, grow with peers.”

## ChristopherRutherford.net
- Product signal: senior engineering judgment, self-hosted platforms,
  independent delivery, and community-oriented technical leadership.
- Current gap: the page structure is solid, but the hero and section wrappers
  feel closer to default component output than to a distinctive personal site.
- Desired personality read: editorial, assured, technical, and premium without
  being flashy.
- Motion guidance:
  restrained reveals, clear hierarchy shifts, and polished panel transitions.
  motion should communicate confidence and pacing, not spectacle.
- Visual cues to emphasize:
  crisp contrast, strong display typography, structured proof blocks, and
  section framing that makes each content band feel curated.
- Messaging the page should reinforce:
  “senior technical partner for durable software and ownership-friendly
  systems.”

## Implementation Notes
- Prefer shared personality variables over hardcoded colors, shadows, radii,
  and transition timings.
- Use `motion-ui` only where it supports a page-level mood already established
  by the product.
- Preserve `prefers-reduced-motion` behavior in all new animated shells.
- Keep section architecture stable; adjust shell, hierarchy, and presentation
  first.
