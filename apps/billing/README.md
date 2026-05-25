# Billing

The billing service is a Nest TCP microservice for usage metering, usage-block accounting, and invoice preview orchestration.

## Documentation

- architecture: [`../../docs/services/billing/architecture.md`](../../docs/services/billing/architecture.md)
- operations: [`../../docs/services/billing/operations.md`](../../docs/services/billing/operations.md)
- dependency diagram: [`../../docs/services/billing/dependency-diagram.md`](../../docs/services/billing/dependency-diagram.md)
- message catalog: [`../../docs/services/billing/message-catalog.md`](../../docs/services/billing/message-catalog.md)
- data flow: [`../../docs/services/billing/data-flow.md`](../../docs/services/billing/data-flow.md)

## Runtime Notes

- runs as a Nest TCP microservice
- uses Postgres through shared billing data-access and database layers
- coordinates usage events, usage blocks, and invoice-preview flows
- relies on command-style message handling rather than public HTTP routes

## Key Configuration Inputs

- `BILLING_HOST`
- `BILLING_PORT`
- `BILLING_DB_HOST`
- `BILLING_DB_PORT`
- `BILLING_DB_USER`
- `BILLING_DB_PASSWORD`
- `BILLING_DB_NAME`
- fallback `DB_*`
- `DB_SYNCHRONIZE`
- `DB_LOGGING`

## Nx Commands

```bash
pnpm exec nx build billing
pnpm exec nx test billing
pnpm exec nx serve billing
```
