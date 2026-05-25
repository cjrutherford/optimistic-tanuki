# business-data-access Architecture

`business-data-access` is an Angular-oriented library that centralizes business-site API access, scoped authentication, automatic request interception, and business-site configuration state.

## Main Building Blocks

- `BusinessApiService`: typed HTTP client for business-site endpoints
- `BusinessAuthService`: owner and client auth flows, token exchange, and local session storage
- `businessHttpInterceptor`: automatic scope and token propagation for `/api/*` calls
- `BusinessSiteConfigStore`: cached site-config state built on signals and API fetches
- `business-site.config.ts`: config schema and merge helpers
- `business-site-blocks.ts`: config-document conversion helpers

## Design Intent

The library keeps business-specific HTTP concerns out of consuming components. Components should depend on the store, auth service, and API methods instead of hand-writing route paths or token headers.

## Authentication Model

The library manages two related but distinct auth contexts:

- owner auth
- client auth

Both flows begin through `/api/authentication/login`, then optionally exchange into `business-site` app scope. Tokens are persisted separately in browser local storage.

## Endpoint Model

The library currently spans:

- `/api/business/*`
- `/api/store/products`
- `/api/asset`
- `/api/authentication/*`

That breadth makes diagrams and an explicit API surface doc important for maintainability.
