# billing-data-access

`billing-data-access` contains the persistence-layer entities used by the billing service for accounts, usage events, and usage-block grants.

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
