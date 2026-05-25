# Assets

The assets service manages uploaded and generated files for the platform. Its source lives under `apps/assets/src` with service code in `src/app` and entity definitions in `src/entities`.

## Documentation

- architecture: [`../../docs/services/assets/architecture.md`](../../docs/services/assets/architecture.md)
- operations: [`../../docs/services/assets/operations.md`](../../docs/services/assets/operations.md)
- dependency diagram: [`../../docs/services/assets/dependency-diagram.md`](../../docs/services/assets/dependency-diagram.md)
- asset lifecycle: [`../../docs/services/assets/asset-lifecycle.md`](../../docs/services/assets/asset-lifecycle.md)
- storage strategy: [`../../docs/services/assets/storage-strategy.md`](../../docs/services/assets/storage-strategy.md)
- migration procedure: [`../../docs/services/assets/migration-procedure.md`](../../docs/services/assets/migration-procedure.md)

## Local Development

Run it as part of the main stack:

```bash
pnpm run docker:dev
```

Primary local surface:

- gateway route: `http://localhost:3000/api/assets`

## Repo Role

- backend asset storage and retrieval
- file metadata and asset-related entity handling
- part of the canonical deployment inventory used by the k8s and CI flows

## Runtime Notes

- the service starts as a Nest TCP microservice rather than an HTTP server
- persistence is wired through `DatabaseModule.register({ name: 'assets' })`
- storage is selected at startup through `StorageModule.registerAsync(...)`
- uploads are validated and scanned before persistence
- the service can run against local filesystem storage or a network-backed S3-compatible adapter

## Key Configuration Inputs

- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `LOCAL_STORAGE_PATH`
- `STORAGE_STRATEGY`
- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `S3_REGION`

## Nx Commands

```bash
pnpm exec nx build assets
pnpm exec nx test assets
pnpm exec nx serve assets
```

## Migrations

```bash
pnpm exec nx run assets:typeorm:migration:generate --name=<migration-name>
pnpm exec nx run assets:typeorm:migration:run
pnpm exec nx run assets:typeorm:migration:revert
```
