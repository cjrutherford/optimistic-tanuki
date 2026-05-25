# Assets Operations

## Local Runbook

Primary commands:

```bash
pnpm exec nx build assets
pnpm exec nx test assets
pnpm exec nx serve assets
```

For full-stack local development:

```bash
pnpm run docker:dev
```

Gateway-facing route:

- `http://localhost:3000/api/assets`

## Configuration Checklist

Verify these before startup or incident triage:

1. `POSTGRES_USER`
2. `POSTGRES_PASSWORD`
3. `STORAGE_STRATEGY`
4. `LOCAL_STORAGE_PATH` for local storage mode
5. `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION` for network storage mode

## Migrations

```bash
pnpm exec nx run assets:typeorm:migration:generate --name=<migration-name>
pnpm exec nx run assets:typeorm:migration:run
pnpm exec nx run assets:typeorm:migration:revert
```

## Common Failure Modes

### Asset creation fails validation

Checks:

- verify filename, MIME classification, type, and payload size
- inspect validation errors returned from `FileValidationService`

### Asset rejected by security checks

Checks:

- inspect virus-scan results and reported threats
- verify the scan provider is functioning in the current environment

### Binary content persists incorrectly

Checks:

- verify active storage strategy
- verify local path or S3 credentials
- verify storage adapter create and read behavior

### Asset exists in DB but content cannot be read

Checks:

- verify adapter read permissions and storage backend health
- verify the persisted asset handle matches adapter expectations

## Related Diagrams

- [Dependency Diagram](./dependency-diagram.md)
- [Asset Lifecycle](./asset-lifecycle.md)
- [Storage Strategy](./storage-strategy.md)
- [Migration Procedure](./migration-procedure.md)
