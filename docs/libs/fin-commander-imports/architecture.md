# fin-commander-imports Architecture

`fin-commander-imports` contains the import workbench UI and the import-provider registry used to preview and commit normalized transactions.

## Main Responsibilities

- present the import workbench UI
- dynamically load built-in or future providers
- normalize provider input into preview and draft transaction structures
- commit accepted transactions through finance services

## Consumers

- future Fin Commander import pages and dashboards

The key extension point is the provider manifest and registry contract.
