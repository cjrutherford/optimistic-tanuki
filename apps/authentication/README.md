# Authentication

The authentication service handles login, identity, tokens, and related user security flows. Its source lives in `apps/authentication/src`, with domain areas for users, tokens, key data, and cache behavior.

## Documentation

- architecture: [`../../docs/services/authentication/architecture.md`](../../docs/services/authentication/architecture.md)
- operations: [`../../docs/services/authentication/operations.md`](../../docs/services/authentication/operations.md)
- dependency diagram: [`../../docs/services/authentication/dependency-diagram.md`](../../docs/services/authentication/dependency-diagram.md)
- auth flow: [`../../docs/services/authentication/auth-flow.md`](../../docs/services/authentication/auth-flow.md)
- data model flow: [`../../docs/services/authentication/data-model-flow.md`](../../docs/services/authentication/data-model-flow.md)
- migration procedure: [`../../docs/services/authentication/migration-procedure.md`](../../docs/services/authentication/migration-procedure.md)
- oauth setup: [`./OAUTH_SETUP.md`](./OAUTH_SETUP.md)

## Local Development

Run it as part of the main stack:

```bash
pnpm run docker:dev
```

Primary local surface:

- gateway route: `http://localhost:3000/api/authentication`

## Repo Role

- user login and token issuance
- authentication checks for the broader gateway-facing platform
- part of the canonical deployment inventory used by CI and k8s validation

## Runtime Notes

- the service starts as a Nest TCP microservice rather than an HTTP server
- the listen port comes from `listenPort` in `src/config.ts`
- persistence is wired through `DatabaseModule.register({ name: 'authentication' })`
- JWT issuance, MFA validation, password policy enforcement, OAuth config validation, and key generation are assembled in `src/app/app.module.ts`
- private key material is written to a local cache path by `KeyService`, while public key and salt data are persisted in the database

## Key Environment Variables

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `GOOGLE_*`, `GITHUB_*`, `MICROSOFT_*`, `FACEBOOK_*`

See [`./OAUTH_SETUP.md`](./OAUTH_SETUP.md) and [`../../docs/services/authentication/operations.md`](../../docs/services/authentication/operations.md) for the full operational breakdown.

## Nx Commands

```bash
pnpm exec nx build authentication
pnpm exec nx test authentication
pnpm exec nx serve authentication
```

## Migrations

```bash
pnpm exec nx run authentication:typeorm:migration:generate --name=<migration-name>
pnpm exec nx run authentication:typeorm:migration:run
pnpm exec nx run authentication:typeorm:migration:revert
```
