# System Configurator API

The system-configurator-api service is a Nest TCP microservice for hardware catalog lookup, compatibility checks, pricing, saved configurations, and order creation.

## Documentation

- architecture: [`../../docs/services/system-configurator-api/architecture.md`](../../docs/services/system-configurator-api/architecture.md)
- operations: [`../../docs/services/system-configurator-api/operations.md`](../../docs/services/system-configurator-api/operations.md)
- dependency diagram: [`../../docs/services/system-configurator-api/dependency-diagram.md`](../../docs/services/system-configurator-api/dependency-diagram.md)
- message catalog: [`../../docs/services/system-configurator-api/message-catalog.md`](../../docs/services/system-configurator-api/message-catalog.md)
- startup flow: [`../../docs/services/system-configurator-api/startup-flow.md`](../../docs/services/system-configurator-api/startup-flow.md)
- catalog sync flow: [`../../docs/services/system-configurator-api/catalog-sync-flow.md`](../../docs/services/system-configurator-api/catalog-sync-flow.md)

## Runtime Notes

- runs as a Nest TCP microservice
- seeds catalog data during startup
- can run optional PCPartPicker sync work on startup or on an interval
- persists catalog, order, and saved-configuration state in Postgres

## Nx Commands

```bash
pnpm exec nx build system-configurator-api
pnpm exec nx test system-configurator-api
pnpm exec nx serve system-configurator-api
```
