# Local Hub E2E Tests

This directory contains end-to-end tests for the Local Hub application using Playwright.

## Test Files

- `public-pages.spec.ts` - Tests for public pages (landing, communities, about, help)
- `authentication.spec.ts` - Tests for registration, login, and session management
- `member-actions.spec.ts` - Tests for community browsing, membership, posts, profile
- `database-verification.spec.ts` - Tests that verify data is correctly stored in the database
- `elections.spec.ts` - Tests for community election functionality
- `business.spec.ts` - Tests for business directory and listings
- `classifieds.spec.ts` - Tests for classifieds listings

## Running Tests

### With Docker (Recommended for CI)

1. Start the test infrastructure:

```bash
docker-compose -f docker-compose.local-hub-e2e.yaml up -d
```

2. Run tests:

```bash
docker-compose -f docker-compose.local-hub-e2e.yaml run e2e-test-runner
```

Or run tests manually:

```bash
docker-compose -f docker-compose.local-hub-e2e.yaml up -d
docker exec local_hub_e2e_runner npx playwright test
```

### Local Development

1. Start the services:

```bash
docker-compose -f docker-compose.local-hub-e2e.yaml up -d
```

2. Run tests with custom BASE_URL:

```bash
BASE_URL=http://localhost:8087 npx playwright test
```

### Environment Variables

- `BASE_URL` - Frontend URL (default: http://localhost:8087)
- `GATEWAY_URL` - Gateway API URL (default: http://localhost:3000)
- `POSTGRES_HOST` - Database host (default: localhost)
- `POSTGRES_PORT` - Database port (default: 5433)
- `POSTGRES_USER` - Database user (default: postgres)
- `POSTGRES_PASSWORD` - Database password (default: postgres)
- `POSTGRES_DB` - Database name (default: ot_local_hub)
- `CI` - Set to "true" for CI mode (disables server auto-start)
- `E2E_DOCKER` - Set to "true" to use Docker-based testing

## Test Fixtures

Test fixtures are located in `src/fixtures/`:

- `auth.fixture.ts` - Authentication helpers and test user management
- `helpers.ts` - Service wait helpers and utility functions

## Notes

- Tests are designed to work with Docker-based services
- The e2e docker-compose file starts all required services with proper health checks
- Database tests require a running PostgreSQL instance with proper credentials
