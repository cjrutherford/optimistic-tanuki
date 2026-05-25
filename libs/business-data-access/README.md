# business-data-access

`business-data-access` is a shared data-access library for business-facing applications. It packages API clients, authentication helpers, request interception, site configuration state, and reusable business-site configuration types.

## Documentation

- architecture: [`../../docs/libs/business-data-access/architecture.md`](../../docs/libs/business-data-access/architecture.md)
- usage: [`../../docs/libs/business-data-access/usage.md`](../../docs/libs/business-data-access/usage.md)
- dependency diagram: [`../../docs/libs/business-data-access/dependency-diagram.md`](../../docs/libs/business-data-access/dependency-diagram.md)
- api surface: [`../../docs/libs/business-data-access/api-surface.md`](../../docs/libs/business-data-access/api-surface.md)
- auth flow: [`../../docs/libs/business-data-access/auth-flow.md`](../../docs/libs/business-data-access/auth-flow.md)
- config store flow: [`../../docs/libs/business-data-access/config-store-flow.md`](../../docs/libs/business-data-access/config-store-flow.md)

## Public API

The library exports:

- `BusinessApiService`
- `BusinessAuthService`
- `businessHttpInterceptor`
- `BusinessSiteConfigStore`
- `BusinessSiteConfig` and related config helpers
- business-site block helpers and related business-domain types

## Runtime Notes

- the library is Angular-oriented and depends on `HttpClient`
- API calls are rooted at `/api/business`, `/api/store`, `/api/asset`, and `/api/authentication`
- auth state is stored in browser local storage for both owner and client scopes
- the interceptor automatically applies `x-ot-appscope: business-site` and preferred tokens for API calls

## Nx Commands

```bash
pnpm exec nx test business-data-access
pnpm exec nx lint business-data-access
```
