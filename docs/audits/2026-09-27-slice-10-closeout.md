# Slice 10 closeout — 2026-09-27

Slice 10 adds the Systems Lab to the portfolio and represents web apps returned by the app registry except the portfolio itself. The registry records were not changed. This is an implementation and local acceptance record, not a production deployment claim.

## Delivered

- The landing page now links to a Systems Lab section that explains how the application experiences, shared UI and contracts, Gateway and services, data/security concerns, and Nx/Docker tooling fit together.
- With the checked-in registry, the Work grid has 18 detailed web-app cards and the Systems Lab has 18 compact application cards, grouped as 14 public apps and 4 internal web tools. The catalog excludes `christopherrutherford-net`; backend services and unregistered apps are not displayed. The rendered set follows registry updates at runtime.
- The catalog carries repository roots and category/context metadata. Detailed cards use app-registry metadata, including registry aliases, and show a visit link only for a public HTTPS destination. Local and private development URLs are not presented as live sites.
- The application count is derived from the displayed registry set. Tests check the checked-in mapping and runtime additions, removals, and visibility changes.

## Verification

- The checked-in registry has 19 app IDs including the portfolio. The catalog maps the other 18 to repository roots, including aliases such as `store` to `store-client`.
- Portfolio Jest tests: 13 suites and 37 tests passed. Portfolio production build and lint, E2E lint, and `git diff --check` passed.
- System Chrome E2E against the final local static build: 14 passed, covering catalog scope, navigation, disclosure keyboard use, desktop and mobile layout, and overflow checks.
- Desktop and mobile screenshot review found the final layout readable, with no horizontal overflow or broken local images. The static preview has no registry API, so its `/api/registry/apps` request returns 404; the registry service falls back to bundled metadata and the catalog still renders.

Screenshots: [desktop Systems Lab](screenshots/slice-10/final-desktop-systems-lab.png), [mobile Systems Lab](screenshots/slice-10/final-mobile-systems-lab.png), [desktop expanded catalog](screenshots/slice-10/final-desktop-index-expanded.png), and [mobile expanded catalog](screenshots/slice-10/final-mobile-index-expanded.png).

## Remaining boundary

The cards establish registry-backed web-app coverage. A live destination is shown only when the registry provides a qualifying public URL; this check does not verify that each external deployment is available. Production deployment and a live-stack acceptance check remain outside this local closeout.

The mobile page is long when every catalog group is expanded. The groups start collapsed so visitors can open only the category they need.
