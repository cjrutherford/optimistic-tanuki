# E2E Test Docker Compose Files

This directory contains independent Docker Compose files for running E2E tests against specific microservices and UI applications.

## Structure

Each E2E test has its own Docker Compose file that includes only the necessary services for that specific test:

### Microservice E2E Tests

- `docker-compose.authentication-e2e.yaml` - Authentication service tests
- `docker-compose.blogging-e2e.yaml` - Blogging service tests
- `docker-compose.permissions-e2e.yaml` - Permissions service tests
- `docker-compose.profile-e2e.yaml` - Profile service tests
- `docker-compose.social-e2e.yaml` - Social service tests
- `docker-compose.assets-e2e.yaml` - Assets service tests
- `docker-compose.gateway-e2e.yaml` - Gateway integration tests (includes dependent services)

### UI E2E Tests

- `docker-compose.digital-homestead-e2e.yaml` - Digital Homestead UI tests with backend
- `docker-compose.owner-console-e2e.yaml` - Owner Console UI tests with backend

## Usage

### Running a specific E2E test environment

```bash
# Start the authentication E2E environment
docker-compose -f e2e/docker-compose.authentication-e2e.yaml up -d

# Run the E2E tests
npx nx e2e authentication-e2e

# Clean up
docker-compose -f e2e/docker-compose.authentication-e2e.yaml down -v
```

### Running full browser-based E2E tests

For the full browser-based E2E test suite, use the main `docker-compose.yaml` file at the repository root:

```bash
# Start the full environment
docker-compose up -d

# Run Playwright browser tests
npx playwright test

# Clean up
docker-compose down -v
```

## Environment Variables

All E2E environments use consistent environment variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `POSTGRES_USER` | postgres | Database username |
| `POSTGRES_PASSWORD` | postgres | Database password |
| `POSTGRES_DB` | postgres | Database name |
| `JWT_SECRET` | e2e-test-jwt-secret | JWT signing secret for testing |

## CI/CD Integration

These Docker Compose files are used by the GitHub Actions workflow defined in `.github/workflows/e2e-tests.yml`. The workflow:

1. **Microservices E2E Tests**: Runs isolated tests for each microservice
2. **UI E2E Tests**: Runs Playwright tests for UI applications with dev server
3. **Full Integration E2E Tests**: Uses the main `docker-compose.yaml` for full stack browser testing
4. **Browser E2E Suite**: Runs cross-browser tests (Chromium, Firefox, WebKit)

## Adding New E2E Tests

When adding a new microservice or UI application:

1. Create a new Docker Compose file: `docker-compose.<app-name>-e2e.yaml`
2. Include only the services required for that specific test
3. Update the GitHub workflow matrix if needed
4. Document the new file in this README
