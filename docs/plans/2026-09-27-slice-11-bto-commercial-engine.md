# Slice 11 BTO commercial engine implementation plan

**Goal:** Turn the existing HAI Computer configurator into an auditable build-to-order quoting and proposal portal for the three commercial appliance tiers.

**Architecture:** Keep the existing customer configurator and TCP Gateway route. The system-configurator API owns supplier offers, quote calculations, expiry, and generated artifacts. The Gateway exposes only customer-safe quote data publicly and requires an Owner Console owner role for wholesale views, adjustments, and lead commits. The Angular portal presents tier quotes and an operator mode. Live licensed distributor APIs are the required sourcing path; structured feed imports may support recovery but do not satisfy source acceptance alone.

**Tech stack:** Angular SSR, NestJS, TypeORM/PostgreSQL, Gateway TCP contracts, Nx/Jest/Playwright, Docker Compose/Kubernetes.

## Existing foundation

- URL `?preset=tier1|tier2|tier3` handling and browser-only storage guards exist in `apps/system-configurator`.
- `apps/system-configurator-api` has a catalog, component configuration and checkout, plus three static commercial tiers.
- Gateway hardware routes, Docker Compose services, and Kubernetes manifests exist. Their presence is not evidence that the target public host is deployed.

## Task 1: Commercial contracts and pricing

- Add typed quote request/result and supplier offer contracts under `libs/models/src/lib/libs/system-configurator/`, plus shared TCP command constants under `libs/constants`.
- Add focused, pure API pricing functions in `apps/system-configurator-api/src/hardware/` with tests for the customer price formula `raw source cost × 1.08 × 1.35`, a separate internal 10% sourcing reserve, 24/36-month amortization at 9.5% APR, 15% annual maintenance reserve, and the 70% recurring retainer margin guard.
- Quote responses must include the itemized inputs, source attribution, calculation version, issue timestamp and 30-calendar-day expiration; never recalculate an accepted quote from mutable live offers.

## Task 2: Distributor sourcing and quote persistence

- Add a normalized offer model for CDW, Newegg Business, Amazon Business and Dell OEM, with SKU, amount/currency, availability, observed time and source ID. Use the owning service's Nx `typeorm:migration:generate` target for schema changes, review SQL, verify a fresh DB migration and run `pnpm run validate:typeorm-migrations`.
- Add live authenticated adapters for CDW, Newegg Business, Amazon Business and Dell OEM, with provider-specific contract tests, bounded sync and idempotent upsert. A structured feed importer can be retained as a fallback, but it is not acceptance for live sourcing. Keep the current PCPartPicker experiment opt-in and outside commercial quoting.
- Store immutable quote snapshots and expiry. Reject stale offers or mark a quote unavailable instead of silently substituting prices.

## Task 3: Secure API and operator workflow

- Add API message handlers, Gateway routes and shared DTOs for public quote retrieval and owner-only wholesale/import/adjustment/commit actions. Do not return `wholesaleCost` or `marginAmount` from public tier routes.
- Reuse Owner Console owner-role authorization. Commit an accepted operator proposal into Lead Tracker through a typed message pattern, with idempotency and an auditable reference.
- Test role inclusion/exclusion, partial updates, retry safety and Gateway-to-handler wiring.

## Task 4: Proposal and deployment artifact compiler

- Generate customer proposal Markdown, `docker-compose.client.yml` and production `.env` from an accepted quote/configuration. Generate 256-bit random salts on the server for each package; never commit or log generated secrets.
- Validate every interpolated value and export an archive/download with a manifest of artifact names and quote ID. Test the output parses and contains required service variables, while sensitive wholesale data stays in operator-only artifacts.

## Task 5: Portal and deployment proof

- Show three commercial tier presets with current sourced quote, 30-day expiry, explicit outright and 24/36-month lease amounts, and a disabled quote action when sourcing is unavailable. Keep SSR browser access guarded.
- Add an authenticated operator mode for wholesale review, component adjustments, proposal generation and Lead Tracker commit.
- Build/test/lint the touched Nx projects, run focused browser E2E, validate Compose artifact syntax and fresh migrations, then verify the deployed host and API path before calling the public deployment complete.

## Working product assumptions

- Live vendor APIs are required now. Access depends on each distributor's account, contract and credentials; file import remains only a fallback.
- No HAI vendor API accounts are currently configured. CDW, Amazon Business and Dell Premier require vendor-approved buyer access; the public Newegg API documentation covers Marketplace sellers, so a separate Newegg buyer feed/API entitlement is required. Local adapter contract tests cannot establish live supplier acceptance.
- The final owner clarification supersedes the earlier contingency placement choice: the 10% contingency is an internal sourcing reserve within the 35% markup. Customer price remains `raw cost × 1.08 × 1.35` as printed in the PDF.
- Owner Console owners may adjust and commit proposals. Configurable monthly cloud/SMS/network costs and lease deposit/residual remain explicit quote inputs until authoritative values are supplied.
- Firm 30-day quotes are owner-issued from selected, current distributor offers. Public tier presets can collect an inquiry before a firm quote exists; they must not present unsourced static numbers as a guaranteed quote.
