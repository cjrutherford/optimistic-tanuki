# S6: shared public directory UI inside every town

Status as of 2026-11-17, local stack. Plan: [2026-11-04-town-square-business-directory.md](../2026-11-04-town-square-business-directory.md) § S6. Contract: [S5-public-contract.md](S5-public-contract.md).

## What shipped

| Area                                                | Where                                                                                                                   |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Shared presentational components (no HTTP)          | `libs/directory-ui` (`@optimistic-tanuki/directory-ui`)                                                                 |
| Town directory, detail, report and receipt pages    | `apps/local-hub/src/app/pages/business-directory`, `business-detail`, `business-report`, `reports-status`               |
| Cursor data service and report calls                | `apps/local-hub/src/app/services/directory.service.ts`                                                                  |
| Report intake, receipt status, reviewer transitions | `apps/directory/src/listing-report.ts`, `apps/gateway/src/controllers/directory/directory-listing-report.controller.ts` |
| Reviewer queue                                      | Owner Console `dashboard/directory-listing-reports/:communityId` ("Listing Reports")                                    |
| Live evidence                                       | `apps/local-hub-e2e/src/s6-directory-evidence.spec.ts`, screenshots in [s6-evidence/](s6-evidence/)                     |

### Shared component API (`libs/directory-ui`)

| Selector                           | Inputs                                                                                                                            | Outputs         |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `otd-directory-list`               | `listings`, `loading`, `hasMore`, `heading`, `detailLinkFor`, `detailQueryParams`, `detailState`, `businessPageFor`, `cardExtras` | `loadMore`      |
| `otd-directory-card`               | `listing`, `detailLink`, `detailQueryParams`, `detailState`, `businessPage`, `extras`                                             | none            |
| `otd-directory-detail`             | `status`, `listing`, `freshness`, `coverage`, `businessPage`, `backLink`, `backLabel`, `reportLink`, `autoFocus`                  | none            |
| `otd-directory-state-panel`        | `status`, `coverage`, `listingsShown`, `filtersActive`, `headingLevel`, `autoFocus`                                               | `retry`         |
| `otd-directory-filter-bar`         | `value`, `categories`                                                                                                             | `filtersSubmit` |
| `otd-directory-source-attribution` | `attribution`, `notices`, `termsUrls`, `freshness`, `showLimitation`, `ariaLabel`                                                 | none            |
| `otd-directory-badge`              | `kind` (`business-page` or `directory-listing`)                                                                                   | none            |
| `otd-directory-nearby-towns`       | `towns`, `linkFor`                                                                                                                | none            |

Helpers: `describeDirectoryState`, `readCoverage`, `describeCoverage`, `readSourceFreshness`, `describeSourceFreshness`, `humanizeCategory`, `haversineMiles`, `nearestTowns`.

### Routes and URL state

| Route                                                | Notes                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `city/:slug/businesses?q=&category=&adult=1&cursor=` | Town comes from the route. Filters live in the URL; submitting clears `cursor`. Refresh, direct links and Back restore the view. "Load more" keeps loaded rows in an in-memory snapshot and writes the cursor with `replaceUrl`. A rejected cursor falls back to the first page. |
| `city/:slug/businesses/:reference`                   | Detail with attribution, notices, terms links, freshness and the coverage limitation. An expired reference shows "This listing link has expired" and a link back to the list.                                                                                                    |
| `city/:slug/businesses/:reference/report`            | Public report form.                                                                                                                                                                                                                                                              |
| `directory/reports/status`                           | Receipt lookup. The receipt is never put in the URL (it works like a password); the acknowledgement passes it through router state.                                                                                                                                              |

The new routes render on the client (`app.routes.server.ts`); the town directory page keeps its existing server render.

### Owner decisions applied

| Decision                               | Implementation                                                                                                                                                                                                                                |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous reporter plus optional email | No login, no paid page or ownership claim. Email is kept only as a keyed HMAC, purged when a report closes or after 180 days, and never returned by any endpoint or shown in the Owner Console.                                               |
| Abuse controls                         | Hidden honeypot field (a filled one gets an identical 201 with a dummy receipt and stores nothing); 5 reports per 10 minutes and 60 status lookups per 10 minutes per client; 4096-byte body cap; note at most 1000 characters.               |
| No auto-hide                           | Safety and rights-request reports are flagged priority and sorted first in the reviewer queue. A reviewer suppresses with "Open suppression", which calls the existing S5 suppression route and resolves the report with the `suppressionId`. |
| Receipt statuses                       | Received, Under review, Resolved, Declined. No timeframe is promised.                                                                                                                                                                         |
| Region                                 | Each town's directory lists the nearest database towns by distance with links. No hard-coded regions; a named corridor is deferred.                                                                                                           |
| Location                               | Only after "Use my location" is pressed. Denial or no support leaves the manual town selector. Nothing is stored.                                                                                                                             |
| Savannah and GA defaults               | Removed. The map frames the loaded towns, else the current town, else a world view. The state list comes from data.                                                                                                                           |
| Badges                                 | "Business page" for a linked business, "Directory listing (not claimed)" otherwise. Free listings are never hidden behind paid pages.                                                                                                         |
| "List Your Business"                   | Now "Create a business page". Same route and behaviour.                                                                                                                                                                                       |

## State copy

| State                               | Title                                         | Message                                                                   |
| ----------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------- |
| loading                             | Loading businesses…                           | none                                                                      |
| failed (any HTTP error)             | Business directory is temporarily unavailable | Please try again. (Try again button)                                      |
| empty                               | No businesses listed                          | No businesses are listed for this town yet.                               |
| acquiring                           | Gathering listings                            | Business listings for this town are being gathered.                       |
| partial                             | Listings still arriving                       | More listings are still being gathered. (listings shown)                  |
| blocked, town-ineligible            | Directory not available                       | The business directory isn't available for this town.                     |
| blocked, policy-withdrawn           | Listings withdrawn                            | Business listings for this town have been withdrawn.                      |
| unknown (also a newly created town) | Coverage unknown                              | We can't tell yet whether this town has listings.                         |
| unconfigured                        | Directory not available yet                   | The business directory isn't available for this town yet.                 |
| no match for a filter               | No results                                    | No businesses match your search. Try different words or clear the search. |
| withheld details note               | Some details are hidden.                      | Some business details are hidden until they're re-checked.                |

Every state keeps the page heading, the search bar and the source block, so the directory entry stays visible with zero listings. A failed request never turns into a coverage state, and no status code, host or service name reaches the page.

Report form errors: 429 "Too many reports from this connection. Please try again later."; 404 "This listing is no longer available to report."; anything else "We couldn't send your report. Please try again." Receipt not found: "We couldn't find a report with that code."

## Accessibility

- The result count is announced through `aria-live="polite"`, and the list carries `aria-busy` while loading. "Load more" moves focus to the first new card.
- The state panel uses `role="alert"` for failures and `role="status"` otherwise. Focus moves to the page heading on route and state changes.
- The filter bar is a labelled `role="search"` form with a label on every control.
- The report form: the reasons are a `fieldset` with a `legend`; invalid fields get `aria-invalid`; a focused error summary links to each field; the button is busy while sending; the acknowledgement heading takes focus. The status page announces results through `role="status"`.
- `prefers-reduced-motion: reduce` turns off transitions and animations in every new component.
- Styles use personality and theme tokens; `tools/personality-audit.mjs` passes.

## Live evidence

The evidence below was captured against the local Docker stack (gateway `:3000`, Local Hub `:8087`) by `S6_EVIDENCE=true E2E_DOCKER=true BASE_URL=http://127.0.0.1:8087 pnpm exec playwright test -c apps/local-hub-e2e/playwright.config.ts src/s6-directory-evidence.spec.ts`. Each state runs at desktop (1280×900) and mobile (390×844). Every run checks:

- axe WCAG 2 A/AA, scoped to `main`, with no serious or critical violations;
- the page does not scroll sideways.

| #   | State                                                              | Town                          | How                                              | Screenshot                                            |
| --- | ------------------------------------------------------------------ | ----------------------------- | ------------------------------------------------ | ----------------------------------------------------- |
| 01  | Populated                                                          | `valdosta-ga`                 | live                                             | `desktop-01-populated.jpg`, `mobile-01-populated.jpg` |
| 02  | Listing detail                                                     | `valdosta-ga`                 | live                                             | `*-02-detail.jpg`                                     |
| 03  | Zero results for a search                                          | `valdosta-ga?q=zzqqxxnomatch` | live                                             | `*-03-zero-results.jpg`                               |
| 04  | Town Directory has never scanned (what a newly created town shows) | `alexandria-va`               | live                                             | `*-04-new-town-unknown.jpg`                           |
| 05  | Blocked, town-ineligible                                           | `dev-review-0d056f5e`         | live                                             | `*-05-blocked-town-ineligible.jpg`                    |
| 06  | Acquiring, empty, partial, unconfigured, policy-withdrawn          | `valdosta-ga`                 | listings response intercepted; coverage replaced | `*-06-<state>.jpg`                                    |
| 07  | Failed infrastructure                                              | `valdosta-ga`                 | listings response replaced with 503              | `*-07-failed-infra.jpg`                               |
| 08  | Report form validation                                             | `valdosta-ga`                 | live                                             | `desktop-08-report-validation.jpg`                    |
| 09  | Report acknowledgement with receipt                                | `valdosta-ga`                 | live (real report stored)                        | `desktop-09-report-ack.jpg`                           |
| 10  | Receipt status "Received"                                          | live                          | live                                             | `desktop-10-receipt-status.jpg`                       |

The populated test also checks the keyboard and navigation path:

1. Type a search and press Enter. The URL gains `q=`.
2. Refresh. The search box keeps the value.
3. Press Back. The search clears.
4. Open the detail page. It shows the report link.

Coverage on the stack was surveyed across 200 towns: 65 available, 55 unknown, 80 blocked/town-ineligible. The stack has no town currently in empty, acquiring, partial, unconfigured or policy-withdrawn, and producing one would mean changing scans or policies on the live database, so those five are rendered with intercepted coverage. Everything else on those pages is live.

## Defects found by the live run and fixed

| Defect                                                                                                                                            | Fix                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Detail lookups by reference returned no stable `id`, so the report form always showed "link expired".                                             | Directory now attaches the id on detail lookups, as cursor pages already do (`register-pending-runtime.ts`).                                                                   |
| The report form looked listings up with `adult=1`, but a reference only resolves under the adult setting it was issued with.                      | The form tries the default lookup, then the adult one.                                                                                                                         |
| The "Local directory" kicker failed AA contrast (4.37:1) on the blocked page background.                                                          | Mixed more foreground into the kicker colour.                                                                                                                                  |
| On mobile the page was 26px wider than the viewport. The town selector's long town names set its natural width, and the page grid grew to fit it. | The select is capped at `max-width: 100%`, and the page grids use `minmax(0, 1fr)`. The evidence spec now fails on any horizontal overflow; it caught a first, incomplete fix. |
| Each unclaimed card showed a "Business page" button next to the "Directory listing (not claimed)" badge, which read as a contradiction.           | The button now reads "Check for a business page".                                                                                                                              |

## Verification

| Check                                                 | Result                                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `nx test directory-ui`                                | 12 suites, 60 tests                                                                               |
| `nx test local-hub`                                   | 52 suites, 513 tests                                                                              |
| `nx test owner-console`                               | 64 suites, 703 tests                                                                              |
| Gateway directory specs                               | 11 suites, 201 tests                                                                              |
| Directory node tests                                  | runtime suite 211 pass / 22 skipped; `register-pending-runtime` 30; `listing-report-runtime` 4    |
| Directory Postgres tests (scratch databases, dropped) | `listing-report` 1, `business-identity-read` 6, `public-withheld-rows` 1, `listing-suppression` 2 |
| Lint and production build                             | `nx lint directory-ui`, `nx lint local-hub`, `nx build local-hub -c production` pass              |
| Personality audit                                     | no new fixed values                                                                               |
| Live evidence spec                                    | 21 of 21 pass                                                                                     |

## Known limits and follow-ups

- The category select offers only the categories in loaded results plus the selected one. There is no categories endpoint.
- The "Business page" badge appears after the per-listing link check, not up front for every card.
- A detail page opened from a direct link fetches the first page to read freshness and coverage. If that fails, the generic limitation text is shown without freshness.
- The city page's directory teaser still uses offset mode. It works, but it has not moved to the cursor service.
- The report rate limiter is per gateway instance and in memory. The client key trusts `X-Forwarded-For` only from a private-network peer.
- A lost receipt cannot be recovered; only its hash is stored.
- The Owner Console report queue is covered by unit tests only. It was not captured in the browser, because that needs a reviewer session.
- Each evidence run files a real report on PINEVIEW GROCERY in the local `directory_listing_report` table. The receipt in `desktop-09-report-ack.jpg` is one of those, for a local test report only.
- Publication is still paused, so no new town can reach `available` through a fresh scan locally.
