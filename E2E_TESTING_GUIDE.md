# E2E Testing Guide

This guide explains how to run end-to-end (E2E) tests for the Optimistic Tanuki NX workspace.

## Overview

The workspace includes comprehensive E2E tests for:
- **Angular Applications** - Using Playwright
- **NestJS TCP Microservices** - Using NestJS ClientProxy
- **Gateway HTTP API** - Using Axios

## Prerequisites

1. Install dependencies:
```bash
npm install
```

2. Ensure Docker is running (required for microservice tests)

## Test Structure

### Angular Applications (Playwright)

The following applications have Playwright E2E tests:
- `client-interface-e2e`
- `forgeofwill-e2e`
- `digital-homestead-e2e`
- `christopherrutherford-net-e2e`

These tests verify:
- Page loading and rendering
- Navigation functionality
- Responsive design (mobile, tablet, desktop)
- Accessibility features
- Performance metrics

### NestJS Microservices (TCP)

The following microservices have E2E tests using NestJS ClientProxy:

#### Authentication Service (`authentication-e2e`)
Port: 3001
Tests:
- User registration
- User login
- Token validation
- Password reset
- Multi-factor authentication

#### Profile Service (`profile-e2e`)
Port: 3002
Tests:
- Create profile
- Get profile by ID
- Get all profiles
- Update profile
- Query profiles with filters

#### Social Service (`social-e2e`)
Port: 3003
Tests:
- Post CRUD operations
- Comment CRUD operations
- Vote operations (upvote, downvote, unvote)
- Attachment operations
- Follow/unfollow operations
- Get followers/following

#### Assets Service (`assets-e2e`)
Port: 3005
Tests:
- Create asset
- Retrieve asset metadata
- Read asset data
- Remove asset

#### Blogging Service (`blogging-e2e`)
Port: 3011
Tests:
- Blog post CRUD operations
- Event CRUD operations
- Publish/unpublish posts

### Gateway HTTP API (`gateway-e2e`)

Port: 3000
Tests:
- Authentication endpoints
- Health checks
- Swagger documentation availability

## Running Tests

### Run All E2E Tests

```bash
# Run all e2e tests
nx run-many --target=e2e --all
```

### Run Specific Application Tests

#### Angular Applications (Playwright)
```bash
# Client Interface
nx e2e client-interface-e2e

# Forge of Will
nx e2e forgeofwill-e2e

# Digital Homestead
nx e2e digital-homestead-e2e

# Christopher Rutherford Net
nx e2e christopherrutherford-net-e2e
```

#### Microservices (Jest + NestJS ClientProxy)
```bash
# Authentication
nx e2e authentication-e2e

# Profile
nx e2e profile-e2e

# Social
nx e2e social-e2e

# Assets
nx e2e assets-e2e

# Blogging
nx e2e blogging-e2e

# Gateway
nx e2e gateway-e2e
```

### Run Tests in Watch Mode

```bash
# Watch mode for specific e2e project
nx e2e authentication-e2e --watch
```

### Run Tests in CI Mode

```bash
# Run with coverage
nx e2e authentication-e2e --configuration=ci
```

## Test Setup

### Microservice Tests

Each microservice E2E test includes:

1. **Global Setup** (`src/support/global-setup.ts`)
   - Starts Docker containers for the service and dependencies
   - Waits for services to be ready
   - Sets up test database

2. **Global Teardown** (`src/support/global-teardown.ts`)
   - Stops and removes Docker containers
   - Cleans up test resources

3. **Test Setup** (`src/support/test-setup.ts`)
   - Configures test environment variables
   - Sets up test utilities

Example connection setup in tests:
```typescript
const client = ClientProxyFactory.create({
  transport: Transport.TCP,
  options: {
    host: '127.0.0.1',
    port: 3001, // Service-specific port
  },
});
await client.connect();
```

### Playwright Tests

Playwright tests are configured in `playwright.config.ts` for each Angular application:

- Automatically starts dev server before tests
- Supports multiple browsers (Chromium, Firefox, WebKit)
- Captures screenshots and traces on failure
- Tests responsive design across viewports

## Writing New Tests

### Adding a New Microservice Test

1. Use the ClientProxy pattern to connect to the microservice:
```typescript
import { ClientProxy, ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

let client: ClientProxy;

beforeAll(async () => {
  client = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: {
      host: '127.0.0.1',
      port: YOUR_SERVICE_PORT,
    },
  });
  await client.connect();
});

afterAll(async () => {
  await client.close();
});

it('should test command', async () => {
  const result = await firstValueFrom(
    client.send({ cmd: 'YOUR_COMMAND' }, payload)
  );
  expect(result).toBeDefined();
});
```

2. Ensure proper setup and teardown
3. Use meaningful test descriptions
4. Test both success and failure scenarios

### Adding a New Playwright Test

1. Follow the existing pattern:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Your assertions here
  });
});
```

2. Always wait for page load states
3. Test responsive design
4. Check accessibility

## Troubleshooting

### Microservice Tests

**Issue**: Connection timeout
- Ensure Docker containers are running
- Check if ports are available
- Verify service is listening on correct port

**Issue**: Database connection errors
- Ensure PostgreSQL container is healthy
- Check database migrations have run
- Verify connection credentials

### Playwright Tests

**Issue**: Element not found
- Add proper wait conditions (`waitForLoadState`, `waitForSelector`)
- Check if element is within viewport

**Issue**: Test timeout
- Increase timeout in test or config
- Check if dev server started successfully

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up created resources
3. **Meaningful Data**: Use descriptive test data (timestamps, unique IDs)
4. **Error Handling**: Test both success and failure paths
5. **Documentation**: Document complex test scenarios
6. **Performance**: Keep tests fast and focused
7. **Reliability**: Use proper wait conditions, avoid hardcoded delays

## CI/CD Integration

Tests can be integrated into CI/CD pipelines.

### GitHub Actions

A complete GitHub Actions workflow example is provided in `.github/workflows/e2e-tests.yml.example`.

To use it:
1. Copy the file: `cp .github/workflows/e2e-tests.yml.example .github/workflows/e2e-tests.yml`
2. Commit and push to your repository
3. Tests will run automatically on PRs and pushes to main/develop branches

Features of the example workflow:
- Runs microservice and UI tests in parallel
- Matrix strategy for concurrent test execution
- Uploads test results and artifacts
- Generates test summary
- Configurable timeout and retry logic

### Quick CI Integration

For a simpler setup:

```yaml
# Example GitHub Actions workflow
- name: Run E2E Tests
  run: |
    npm install
    nx run-many --target=e2e --all --configuration=ci
```

## Additional Resources

### Project Documentation
- [Test Coverage Report](./TEST_COVERAGE.md) - Detailed breakdown of all tests
- [Testing Quick Reference](./TESTING_QUICK_REFERENCE.md) - Quick commands and patterns

### External Documentation
- [Playwright Documentation](https://playwright.dev/)
- [NestJS Microservices](https://docs.nestjs.com/microservices/basics)
- [NX Testing](https://nx.dev/recipes/testing)
- [Jest Documentation](https://jestjs.io/)
