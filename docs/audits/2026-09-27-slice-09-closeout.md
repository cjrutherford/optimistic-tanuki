# Slice 09: portfolio grid and identity

Date: 2026-09-27. Branch: `develop/site-copy-review`. Changes remain uncommitted in the current checkout.

The PDF names `apps/portfolio`; the corresponding Nx application is `apps/christopherrutherford-net`. Slice 09 is implemented there. Christopher Rutherford’s systems architect identity now leads the hero, document title, description, and app bar. The app bar uses an existing brand asset. The user chose to retain the illustrated systems background. Portfolio entries and six-app showcase curation belong to Slice 10 and were not changed.

The project collection now wraps cards so an incomplete three-column row expands across the available width. A capped single-card row is centered even when the actual breakpoint fits only two cards. Keyboard focus and reduced-motion behavior were also improved for the affected links.

Evidence: `christopherrutherford-net` Jest passed 11 suites and 28 tests; production build and lint passed. `christopherrutherford-net-e2e` lint passed. Four focused system-Chrome E2E checks passed against the built local site: title/metadata/brand asset, mobile overflow, the desktop 3+3+2 card arrangement with a wider final row, and a simulated five-card tablet 2+2+1 arrangement with the last card centered. `git diff --check` passed. Independent review found and then confirmed the two-column orphan-card issue was fixed.

Next: Slice 10 should curate the six active applications and Systems Lab architecture story separately. No production deployment was performed for Slice 09.
