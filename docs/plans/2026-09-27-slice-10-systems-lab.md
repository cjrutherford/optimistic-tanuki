# Slice 10 Systems Lab implementation plan

**Goal:** Show the Optimistic Tanuki application portfolio and explain the shared monorepo architecture on christopherrutherford.net.

**Architecture:** Keep the portfolio-specific presentation in `apps/christopherrutherford-net`. Use the app registry response as the source of which web apps to display, with the checked-in registry as the existing client fallback. Keep public product cards distinct from architecture details and avoid treating a configured URL as proof that an app is live. Exclude the portfolio itself from the catalog. Leave registry records unchanged.

**Tech stack:** Angular, shared `common-ui` components and theme tokens, Nx, Jest, Playwright.

## Task 1: Systems Lab section

- Add a semantic Systems Lab section under `apps/christopherrutherford-net/src/landing/` and compose it into the landing page with a navigation anchor.
- Explain the repository-supported relationship among Angular applications, shared UI/theme/contract libraries, Gateway and NestJS services, and build/deployment tooling. Use accessible text and CSS rather than a static diagram image.
- Add a focused component test for the architecture content, section landmark, and navigation anchor.

## Task 2: Complete application catalog

- Include only registered web apps other than `christopherrutherford-net`, including public experiences and internal consoles. The checked-in registry currently contains 18 such apps. Keep backend services and unregistered projects off the page. A Systems Lab card should represent every in-scope web app.
- Preserve registry metadata. Never label a configured localhost URL as a live deployment.
- Render every in-scope app except this portfolio, with a repository destination and a live link only when the registry supplies a qualifying public HTTPS URL. Provide readable categories and a responsive layout.
- Add tests that compare the checked-in catalog against the checked-in app registry and verify runtime registry additions, removals, visibility changes, portfolio exclusion, and aliases such as `store` → `store-client` and `video-platform` → `video-client`.

## Task 3: Browser and build proof

- Run focused portfolio component tests, then Nx test/build/lint for `christopherrutherford-net` and lint for its E2E project.
- Use system Chrome against the built app to check the Systems Lab anchor, catalog coverage, keyboard access, and mobile overflow. Run `git diff --check`.
- Keep the existing dirty Slice 07–09 changes and do not create a worktree.
