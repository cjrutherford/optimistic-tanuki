# fin-commander-data-access

`fin-commander-data-access` contains Fin Commander plan models plus a scope-aware plan store and API facade.

## Documentation

- architecture: [`../../docs/libs/fin-commander-data-access/architecture.md`](../../docs/libs/fin-commander-data-access/architecture.md)
- usage: [`../../docs/libs/fin-commander-data-access/usage.md`](../../docs/libs/fin-commander-data-access/usage.md)
- dependency diagram: [`../../docs/libs/fin-commander-data-access/dependency-diagram.md`](../../docs/libs/fin-commander-data-access/dependency-diagram.md)
- data flow: [`../../docs/libs/fin-commander-data-access/data-flow.md`](../../docs/libs/fin-commander-data-access/data-flow.md)
- scope persistence: [`../../docs/libs/fin-commander-data-access/scope-persistence.md`](../../docs/libs/fin-commander-data-access/scope-persistence.md)

## Public API

- Fin Commander models and scope types
- `FinCommanderPlanApiService`
- `FinCommanderPlanStore`

## Nx Commands

```bash
pnpm exec nx test fin-commander-data-access
pnpm exec nx lint fin-commander-data-access
```
