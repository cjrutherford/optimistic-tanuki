# fin-commander-data-access Architecture

`fin-commander-data-access` provides Fin Commander models plus a scope-aware store and a future-facing API service.

## Main Responsibilities

- define plan, goal, scenario, overview, and scope models
- store plan state partitioned by tenant and profile scope
- enrich plan state with finance workspace summaries
- provide an API service boundary for future backend integration

## Consumers

- future Fin Commander feature and UI surfaces

Today the primary usable runtime layer is the localStorage-backed plan store.
