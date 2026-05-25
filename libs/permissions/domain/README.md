# permissions-domain

`permissions-domain` contains server-side authorization policy models and app-scope policy registry logic.

## Documentation

- architecture: [`../../../docs/libs/permissions-domain/architecture.md`](../../../docs/libs/permissions-domain/architecture.md)
- usage: [`../../../docs/libs/permissions-domain/usage.md`](../../../docs/libs/permissions-domain/usage.md)
- dependency diagram: [`../../../docs/libs/permissions-domain/dependency-diagram.md`](../../../docs/libs/permissions-domain/dependency-diagram.md)
- policy flow: [`../../../docs/libs/permissions-domain/policy-flow.md`](../../../docs/libs/permissions-domain/policy-flow.md)

## Public API

- policy model types
- `AppScopePolicy`
- `AppScopePolicyRegistry`

## Nx Commands

```bash
pnpm exec nx test permissions-domain
pnpm exec nx lint permissions-domain
```
