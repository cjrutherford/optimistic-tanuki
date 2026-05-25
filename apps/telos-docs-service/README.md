# Telos Docs Service

The telos-docs-service manages documentation-oriented data for the platform. Its source lives in `apps/telos-docs-service/src/app` with persona, profile, and project-specific Telos areas split into separate folders.

## Documentation

- architecture: [`../../docs/services/telos-docs-service/architecture.md`](../../docs/services/telos-docs-service/architecture.md)
- operations: [`../../docs/services/telos-docs-service/operations.md`](../../docs/services/telos-docs-service/operations.md)
- dependency diagram: [`../../docs/services/telos-docs-service/dependency-diagram.md`](../../docs/services/telos-docs-service/dependency-diagram.md)
- data flow: [`../../docs/services/telos-docs-service/data-flow.md`](../../docs/services/telos-docs-service/data-flow.md)
- domain layout: [`../../docs/services/telos-docs-service/domain-layout.md`](../../docs/services/telos-docs-service/domain-layout.md)
- seeding procedure: [`../../docs/services/telos-docs-service/seeding-procedure.md`](../../docs/services/telos-docs-service/seeding-procedure.md)

## Local Development

Run it as part of the main stack:

```bash
pnpm run docker:dev
```

Primary local surface:

- gateway route: `http://localhost:3000/api/telos-docs-service`

## Repo Role

- backend documentation and telos-related content support
- used by broader platform features rather than as a standalone app surface
- included in the canonical deployment inventory

## Runtime Notes

- the service starts as a Nest TCP microservice on the configured `listenPort`
- persistence is wired through `DatabaseModule.register({ name: 'telos_docs' })`
- the main domain slices are `persona-telos`, `profile-telos`, and `project-telos`
- seed helpers and persona seed scripts exist under `src/app`
- the service is consumed by other platform workflows rather than a public standalone UI

## Key Configuration Inputs

- `DATABASE_HOST`
- `DATABASE_PORT`
- `DATABASE_USER`
- `DATABASE_PASSWORD`
- `DATABASE_NAME`

## Nx Commands

```bash
pnpm exec nx build telos-docs-service
pnpm exec nx test telos-docs-service
pnpm exec nx serve telos-docs-service
```
