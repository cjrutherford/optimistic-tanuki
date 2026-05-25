# System Configurator API Operations

## Local Runbook

```bash
pnpm exec nx build system-configurator-api
pnpm exec nx test system-configurator-api
pnpm exec nx serve system-configurator-api
```

## Operational Checklist

Verify:

1. DB configuration in `src/assets/config.yaml` or env overrides
2. migration state before startup
3. seed behavior on fresh environments
4. `PCPARTPICKER_SYNC_ON_START`
5. `PCPARTPICKER_SYNC_INTERVAL_MS`

## Common Failure Modes

- external sync failures due to HTML changes or rate limits
- stale catalog data after failed syncs
- schema mismatch between migrations and runtime expectations

## Related Diagrams

- [Dependency Diagram](./dependency-diagram.md)
- [Message Catalog](./message-catalog.md)
- [Startup Flow](./startup-flow.md)
- [Catalog Sync Flow](./catalog-sync-flow.md)
