# billing-data-access

`billing-data-access` contains the persistence-layer entities used by the billing service for accounts, usage events, and usage-block grants.

> Naming note (T4): despite the `*-data-access` suffix, this is **backend
> persistence** (`platform:server`, imported only by `apps/billing`) — not a
> UI gateway client like `business-data-access` or `finance-data-access`.
> The path stays as-is to avoid churn; the generated UI client for billing
> lives in `billing-sdk/src/generated/` (orval output, Track A pilot O15) —
> a separate `billing-ui-data-access` lib was scaffolded and then folded
> into the SDK because a `visibility:internal` lib cannot be depended on by
> the `visibility:publishable` SDK (boundary rule).

## Documentation

- architecture: [`../../../docs/libs/billing-data-access/architecture.md`](../../../docs/libs/billing-data-access/architecture.md)
- usage: [`../../../docs/libs/billing-data-access/usage.md`](../../../docs/libs/billing-data-access/usage.md)
- dependency diagram: [`../../../docs/libs/billing-data-access/dependency-diagram.md`](../../../docs/libs/billing-data-access/dependency-diagram.md)
- entity relationship diagram: [`../../../docs/libs/billing-data-access/entity-relationship.md`](../../../docs/libs/billing-data-access/entity-relationship.md)
- write path: [`../../../docs/libs/billing-data-access/write-path.md`](../../../docs/libs/billing-data-access/write-path.md)

## Public API

- `BillingAccountEntity`
- `UsageBlockGrantEntity`
- `UsageEventEntity`

## Nx Commands

```bash
pnpm exec nx test billing-data-access
pnpm exec nx lint billing-data-access
```
