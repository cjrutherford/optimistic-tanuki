# Telos Docs Service Operations

## Local Runbook

Primary commands:

```bash
pnpm exec nx build telos-docs-service
pnpm exec nx test telos-docs-service
pnpm exec nx serve telos-docs-service
```

For full local development:

```bash
pnpm run docker:dev
```

Gateway-facing route:

- `http://localhost:3000/api/telos-docs-service`

## Configuration Checklist

Verify these before startup or incident triage:

1. `DATABASE_HOST`
2. `DATABASE_PORT`
3. `DATABASE_USER`
4. `DATABASE_PASSWORD`
5. `DATABASE_NAME`

## Common Failure Modes

### Service fails to start

Checks:

- verify the config file exists and parses
- verify database credentials and connectivity

### One Telos domain works while another fails

Checks:

- inspect the corresponding domain controller and service
- verify repository wiring for the affected entity class

### Seed or benchmark tasks produce inconsistent data

Checks:

- inspect `seed-persona.ts` and helper functions
- verify the database is in the expected baseline state before seeding

## Related Diagrams

- [Dependency Diagram](./dependency-diagram.md)
- [Data Flow](./data-flow.md)
- [Domain Layout](./domain-layout.md)
- [Seeding Procedure](./seeding-procedure.md)
