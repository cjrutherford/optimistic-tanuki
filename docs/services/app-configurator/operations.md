# App Configurator Operations

## Local Runbook

```bash
pnpm exec nx build app-configurator
pnpm exec nx test app-configurator
pnpm exec nx serve app-configurator
```

## Operational Checklist

Verify:

1. DB configuration and connectivity
2. migration state
3. whether demo seed should run in the current environment
4. `synchronize` behavior outside production
5. any Redis-related settings documented by the config layer

## Common Failure Modes

- schema drift due to mixed migration and synchronize behavior
- duplicate or stale demo records after repeated bootstrap seeding
- configuration lookup mismatch by name or domain

## Related Diagrams

- [Dependency Diagram](./dependency-diagram.md)
- [Message Catalog](./message-catalog.md)
- [Startup Flow](./startup-flow.md)
- [Config Document Flow](./config-document-flow.md)
