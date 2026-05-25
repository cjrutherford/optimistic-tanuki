# app-registry-backend

`app-registry-backend` is an internal contract library for application registry and navigation-link seed data used by backend and admin-facing consumers.

## Documentation

- architecture: [`../../docs/libs/app-registry-backend/architecture.md`](../../docs/libs/app-registry-backend/architecture.md)
- usage: [`../../docs/libs/app-registry-backend/usage.md`](../../docs/libs/app-registry-backend/usage.md)
- dependency diagram: [`../../docs/libs/app-registry-backend/dependency-diagram.md`](../../docs/libs/app-registry-backend/dependency-diagram.md)
- export map: [`../../docs/libs/app-registry-backend/export-map.md`](../../docs/libs/app-registry-backend/export-map.md)

## Public API

The library exports app-registry contracts, navigation-link contracts, and default seed data for app registry and navigation generation.

## Nx Commands

```bash
pnpm exec nx test app-registry-backend
pnpm exec nx lint app-registry-backend
```
