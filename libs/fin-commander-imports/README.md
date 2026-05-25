# fin-commander-imports

`fin-commander-imports` contains the Fin Commander import workbench UI plus the import-provider registry used to preview and commit normalized transactions.

## Documentation

- architecture: [`../../docs/libs/fin-commander-imports/architecture.md`](../../docs/libs/fin-commander-imports/architecture.md)
- usage: [`../../docs/libs/fin-commander-imports/usage.md`](../../docs/libs/fin-commander-imports/usage.md)
- dependency diagram: [`../../docs/libs/fin-commander-imports/dependency-diagram.md`](../../docs/libs/fin-commander-imports/dependency-diagram.md)
- import pipeline: [`../../docs/libs/fin-commander-imports/import-pipeline.md`](../../docs/libs/fin-commander-imports/import-pipeline.md)
- provider architecture: [`../../docs/libs/fin-commander-imports/provider-architecture.md`](../../docs/libs/fin-commander-imports/provider-architecture.md)

## Public API

- `FinCommanderImportWorkbenchComponent`
- `FinCommanderImportRegistryService`
- provider manifest and draft/preview/provider types

## Nx Commands

```bash
pnpm exec nx test fin-commander-imports
pnpm exec nx lint fin-commander-imports
```
