# Local Hub E2E Tests

This project contains Playwright end-to-end tests for the Local Hub application.

## Coverage

Current suites include:

- public pages
- authentication
- member actions
- database verification
- elections
- business directory
- classifieds

## Running Tests

### Docker-based flow

The repo-level compose file for this suite is `docker-compose.local-hub-e2e.yaml`.

```bash
# From repo root
docker compose -f docker-compose.local-hub-e2e.yaml up -d
docker compose -f docker-compose.local-hub-e2e.yaml run --rm e2e-test-runner
```

Equivalent package scripts:

```bash
pnpm run e2e:docker:up
pnpm run e2e:docker:test
pnpm run e2e:docker:down
```

### Local Playwright run

If the required services are already running:

```bash
BASE_URL=http://localhost:8087 pnpm exec playwright test --config=apps/local-hub-e2e/playwright.config.ts
```

## Environment Variables

- `BASE_URL`: frontend URL, default `http://localhost:8087`
- `GATEWAY_URL`: gateway API URL, default `http://localhost:3000`
- `POSTGRES_HOST`: database host
- `POSTGRES_PORT`: database port
- `POSTGRES_USER`: database user
- `POSTGRES_PASSWORD`: database password
- `POSTGRES_DB`: database name
- `CI`: set to `"true"` for CI mode
- `E2E_DOCKER`: set to `"true"` for Docker-based testing

## Notes

- The suite is designed around Docker-backed dependencies.
- The compose file lives at the repo root, not inside `apps/local-hub-e2e/`.
- For the platform-wide local stack, see `pnpm run docker:dev` and the Docker docs in `docs/devops/docker-compose.md`.
