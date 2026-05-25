# Authentication Operations

## Local Runbook

Primary commands:

```bash
pnpm exec nx build authentication
pnpm exec nx test authentication
pnpm exec nx serve authentication
```

For stack-based local development, use:

```bash
pnpm run docker:dev
```

## Configuration Checklist

Verify these before startup or incident triage:

1. `POSTGRES_USER`
2. `POSTGRES_PASSWORD`
3. `JWT_SECRET`
4. OAuth provider environment variables such as `GOOGLE_CLIENT_ID`
5. presence of `src/assets/config.yaml` or `src/assets/config.yaml.sample`

## Migrations

```bash
pnpm exec nx run authentication:typeorm:migration:generate --name=<migration-name>
pnpm exec nx run authentication:typeorm:migration:run
pnpm exec nx run authentication:typeorm:migration:revert
```

The service points TypeORM CLI commands at `src/app/staticDatabase.ts` with `ts-node` registration, so migration workflows depend on a working TypeScript runtime and correct app config.

## Common Failure Modes

### Service fails on startup with config error

Checks:

- verify `config.yaml` or `config.yaml.sample` exists in `src/assets`
- verify database and JWT values are present

### Login fails for valid user

Checks:

- verify user lookup normalizes email correctly
- verify `keyData.salt` exists for password validation
- verify MFA secret and provided token are in sync

### OAuth providers missing from public config

Checks:

- verify the provider config is enabled
- verify client ID, client secret, and redirect URI are all populated
- review [`../../../apps/authentication/OAUTH_SETUP.md`](../../../apps/authentication/OAUTH_SETUP.md)

### Key material is unavailable after registration

Checks:

- verify the cache directory used by `KeyService`
- verify write permissions in the container or host filesystem

## Related Diagrams

- [Dependency Diagram](./dependency-diagram.md)
- [Auth Flow](./auth-flow.md)
- [Data Model Flow](./data-model-flow.md)
- [Migration Procedure](./migration-procedure.md)
