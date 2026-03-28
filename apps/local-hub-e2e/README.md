# Local Hub E2E Tests

This directory contains end-to-end tests for the Local Hub application using Playwright.

## Test Files

- `app.spec.ts` - Main application tests (public pages, API endpoints, auth, database)
- `permissions.spec.ts` - Permission validation and access control tests
- `donations.spec.ts` - Donation workflow tests with mock payment provider
- `classifieds.spec.ts` - Classifieds purchase flow tests with mock payments
- `business.spec.ts` - Business pages and Stripe Connect workflow tests

## Running Tests

### With NX (Recommended)

```bash
# Start docker services
nx run local-hub-e2e:up

# Run e2e tests
nx run local-hub-e2e:e2e

# Or run everything at once (start, test, stop) - builds images first
nx run local-hub-e2e:e2e-docker

# Or use npm script shorthand
npm run e2e:test:nx
```

### With Docker (Manual)

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
nx run local-hub-e2e:up
```

2. Run tests with custom BASE_URL:

```bash
BASE_URL=http://localhost:8087 npx playwright test
```

### Environment Variables

- `BASE_URL` - Frontend URL (default: http://localhost:8087)
- `GATEWAY_URL` - Gateway API URL (default: http://localhost:3000)
- `MOCK_PAYMENT_URL` - Mock payment server URL (default: http://localhost:3019)
- `POSTGRES_HOST` - Database host (default: localhost)
- `POSTGRES_PORT` - Database port (default: 5433)
- `POSTGRES_USER` - Database user (default: postgres)
- `POSTGRES_PASSWORD` - Database password (default: postgres)
- `POSTGRES_DB` - Database name (default: ot_local_hub)
- `CI` - Set to "true" for CI mode (disables server auto-start)
- `E2E_DOCKER` - Set to "true" to use Docker-based testing

## Mock Payment Server

The e2e tests include a mock payment server that simulates Helcim and Stripe APIs:

- **Helcim endpoints**: `/v2/helcim-pay/*` - Checkout sessions, payments, refunds
- **Stripe endpoints**: `/v1/*` - Payment intents, account links, transfers, refunds
- **Health check**: `/health` - Returns server status and available providers

The mock server is automatically started as part of the docker-compose setup.

## Test Fixtures

Test fixtures are located in `src/fixtures/`:

- `auth.fixture.ts` - Authentication helpers and test user management
- `helpers.ts` - Service wait helpers and utility functions

## Mock Infrastructure

The mock payment server is located in `src/mocks/payment-server.ts` and provides:

- Mock Helcim API for donation checkouts and refunds
- Mock Stripe API for payment intents, Connect onboarding, and transfers
- Test transaction storage for verification
- Health check endpoint

## Notes

- Tests are designed to work with Docker-based services
- The e2e docker-compose file starts all required services with proper health checks
- Database tests require a running PostgreSQL instance with proper credentials
- Payment tests use the mock server to avoid real payment provider calls
