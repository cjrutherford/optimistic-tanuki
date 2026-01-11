# Store Client E2E Tests

This directory contains end-to-end tests for the store-client application using Playwright.

## Test Files

- `example.spec.ts` - Main store functionality tests (catalog, donations, cart)
- `products.spec.ts` - Product display and management tests
- `donations.spec.ts` - Donation form and submission tests
- `integration.spec.ts` - Full backend-to-frontend integration tests

## Prerequisites

Before running the tests:

1. Build the store-client application:
   ```bash
   npx nx build store-client
   ```

2. Ensure the backend services are running (for integration tests):
   ```bash
   npm run docker:dev
   ```

   This will:
   - Start all required services (postgres, gateway, store, etc.)
   - Seed the database with dummy products and subscriptions
   - Make the store API available at `http://localhost:3000/api/store`

## Running Tests

### Run all e2e tests:
```bash
npx nx e2e store-client-e2e
```

### Run tests in headed mode (see browser):
```bash
npx nx e2e store-client-e2e --headed
```

### Run specific test file:
```bash
npx nx e2e store-client-e2e --grep "products"
```

### Run with UI mode (interactive):
```bash
npx playwright test --ui
```

## Test Categories

### Unit Tests (Mocked Backend)
Tests in `example.spec.ts` and `donations.spec.ts` that mock API responses to test frontend behavior in isolation.

### Integration Tests (Real Backend)
Tests in `integration.spec.ts` that connect to the actual backend services to verify end-to-end functionality.

## Seeded Data

The store is seeded with 8 products:
1. Premium Coffee Beans ($24.99) - physical
2. E-Book: Web Development Guide ($39.99) - digital
3. Premium Subscription ($9.99) - subscription
4. Handcrafted Ceramic Mug ($14.99) - physical
5. Online Course Access ($199.99) - digital
6. T-Shirt - Developer Edition ($29.99) - physical
7. Pro Subscription ($99.99) - subscription
8. Laptop Sticker Pack ($12.99) - physical

## Debugging Tests

### View test report:
```bash
npx playwright show-report
```

### Generate trace on failure:
Traces are automatically generated on test failure and can be viewed in the report.

### Run single test in debug mode:
```bash
npx playwright test --debug --grep "should display the catalog page"
```

## CI/CD

These tests are designed to run in CI environments. The `playwright.config.ts` is configured to:
- Start the dev server automatically
- Run tests in parallel
- Generate reports and traces
- Support multiple browsers (Chrome, Firefox, Safari)

## Troubleshooting

### "Connection refused" errors
- Ensure backend services are running: `docker compose ps`
- Check service logs: `docker compose logs store gateway`
- Verify services are healthy: `docker compose exec store wget -O- http://localhost:3009` (should not error)

### Tests timing out
- Increase timeout in test: `test.setTimeout(60000)`
- Check if backend is seeded: `docker compose exec store ls -la /usr/src/app/seed-store.js`
- Run seed manually: `docker compose exec store node /usr/src/app/seed-store.js`

### Products not appearing
- Verify API endpoint: `curl http://localhost:3000/api/store/products`
- Check gateway logs: `docker compose logs gateway`
- Ensure store service is running: `docker compose ps store`
