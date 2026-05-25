# Billing Operations

## Local Runbook

```bash
pnpm exec nx build billing
pnpm exec nx test billing
pnpm exec nx serve billing
```

## Configuration Checklist

Verify:

1. `BILLING_HOST`
2. `BILLING_PORT`
3. `BILLING_DB_HOST` / fallback `DB_HOST`
4. `BILLING_DB_PORT` / fallback `DB_PORT`
5. `BILLING_DB_USER` / fallback `DB_USER`
6. `BILLING_DB_PASSWORD` / fallback `DB_PASSWORD`
7. `BILLING_DB_NAME` / fallback `DB_NAME`
8. `DB_SYNCHRONIZE`
9. `DB_LOGGING`

## Common Failure Modes

- duplicate usage events due to caller-side idempotency gaps
- invoice-preview discrepancies caused by stale or partial usage data
- schema drift if synchronize-style behavior is enabled incorrectly

## Related Diagrams

- [Dependency Diagram](./dependency-diagram.md)
- [Message Catalog](./message-catalog.md)
- [Data Flow](./data-flow.md)
