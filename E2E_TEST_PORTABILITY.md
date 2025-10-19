# E2E Test Portability Guide

This document ensures that all E2E tests in this workspace are portable and can run consistently across different environments.

## Test Portability Checklist

### ✅ Environment Independence
- [x] Tests use relative paths, not absolute paths
- [x] Tests use environment variables for configuration
- [x] No hardcoded localhost references (uses configurable base URLs)
- [x] Docker containers for microservices use isolated networks

### ✅ Browser Compatibility
- [x] Playwright tests support Chromium, Firefox, and WebKit
- [x] Browser installation automated via `npx playwright install`
- [x] Configs allow running specific browsers or all browsers

### ✅ Dependency Management
- [x] All dependencies listed in package.json
- [x] Package-lock.json committed for reproducible builds
- [x] No global dependencies required
- [x] Docker images use specific versions, not `latest`

### ✅ Database Independence
- [x] Microservice tests use isolated test databases
- [x] Test data generated dynamically (timestamps, unique IDs)
- [x] No test pollution between test runs
- [x] Automatic cleanup after tests

### ✅ Network Isolation
- [x] TCP microservices use configurable ports
- [x] Default ports documented and configurable
- [x] Tests can run in parallel without port conflicts
- [x] Docker compose files create isolated networks

### ✅ CI/CD Ready
- [x] GitHub Actions workflow configured
- [x] Tests run in CI environment without modifications
- [x] Artifacts uploaded for debugging
- [x] Test reports generated automatically

## System Requirements

### Minimum Requirements
- **Node.js**: v18.0.0 or higher
- **npm**: v8.0.0 or higher
- **Docker**: v20.0.0 or higher (for microservice tests)
- **RAM**: 4GB minimum, 8GB recommended
- **Disk Space**: 5GB for dependencies and browsers

### Operating Systems Supported
- ✅ **Linux**: Ubuntu 20.04+, Debian 10+, RHEL 8+
- ✅ **macOS**: 11.0+ (Big Sur and later)
- ✅ **Windows**: 10+ (via WSL2 recommended)

### Browser Requirements (Playwright)
- **Chromium**: ~300MB
- **Firefox**: ~100MB
- **WebKit**: ~100MB

Total: ~500MB for all browsers

## Running Tests in Different Environments

### Local Development
```bash
# First time setup
npm install
npx playwright install

# Run all tests
nx run-many --target=e2e --all

# Run specific test
nx e2e authentication-e2e
```

### Docker Environment
```bash
# Build and run in containers
docker-compose -f docker-compose.yaml up -d

# Run tests against Docker services
nx run-many --target=e2e --all
```

### CI/CD (GitHub Actions)
Tests automatically run on:
- Pull requests to main/develop
- Pushes to main/develop
- Manual workflow dispatch

### WSL2 (Windows)
```bash
# Install WSL2 and Ubuntu
wsl --install

# Inside WSL2
sudo apt update
sudo apt install nodejs npm docker.io
npm install
npx playwright install --with-deps
```

## Port Configuration

All services use configurable ports with sensible defaults:

| Service | Default Port | Environment Variable |
|---------|--------------|---------------------|
| Gateway | 3000 | `PORT` |
| Authentication | 3001 | `AUTHENTICATION_PORT` |
| Profile | 3002 | `PROFILE_PORT` |
| Social | 3003 | `SOCIAL_PORT` |
| Assets | 3005 | `ASSETS_PORT` |
| Blogging | 3011 | `BLOGGING_PORT` |

### Changing Ports
```bash
# Set custom port for a service
export AUTHENTICATION_PORT=4001

# Run tests with custom port
nx e2e authentication-e2e
```

## Test Data Management

### Dynamic Test Data
All tests generate unique test data using:
- Timestamps: `test-${Date.now()}`
- UUIDs: Generated per test run
- Unique identifiers: No hardcoded test data

### Test Isolation
- Each test creates its own data
- Tests clean up after themselves
- No shared state between tests
- Parallel execution safe

## Troubleshooting Portability Issues

### Issue: Port Already in Use
```bash
# Check what's using the port
lsof -i :3001

# Kill the process
kill -9 <PID>

# Or use a different port
export AUTHENTICATION_PORT=4001
```

### Issue: Docker Not Available
```bash
# Check Docker status
docker --version
docker ps

# Start Docker service (Linux)
sudo systemctl start docker

# Or use Colima (macOS)
colima start
```

### Issue: Playwright Browser Installation Fails
```bash
# Install with system dependencies
npx playwright install --with-deps

# Or install specific browser
npx playwright install chromium

# Check installation
ls ~/.cache/ms-playwright/
```

### Issue: Tests Timeout
```bash
# Increase timeout in jest.config.ts
testTimeout: 60000  // 60 seconds

# Or in Playwright config
timeout: 60000
```

### Issue: Database Connection Errors
```bash
# Check if database is running
docker ps | grep postgres

# Restart database container
docker-compose restart db

# Check database logs
docker-compose logs db
```

## Best Practices for Test Portability

1. **Use Configuration Files**: Never hardcode environment-specific values
2. **Isolate Test Data**: Use unique identifiers for all test data
3. **Clean Up Resources**: Always clean up after tests (databases, files, etc.)
4. **Handle Timing**: Use proper wait conditions, not arbitrary delays
5. **Mock External Services**: Don't rely on external APIs in tests
6. **Version Lock Dependencies**: Use package-lock.json for reproducibility
7. **Document Assumptions**: Clearly document any environment assumptions

## Verification Steps

To verify test portability in a new environment:

```bash
# 1. Clone the repository
git clone https://github.com/cjrutherford/optimistic-tanuki.git
cd optimistic-tanuki

# 2. Install dependencies
npm install

# 3. Install browsers
npx playwright install

# 4. Start required services (if testing microservices)
docker-compose up -d

# 5. Run all tests
nx run-many --target=e2e --all

# 6. Verify all tests pass
# Expected: All 15 e2e projects should pass
```

## Continuous Improvement

This portability guide is maintained alongside the tests. When adding new tests:

- [ ] Verify tests run on Linux, macOS, and Windows
- [ ] Document any new dependencies or requirements
- [ ] Update this guide with new configurations
- [ ] Test in CI environment before merging
- [ ] Ensure tests can run in parallel

## Resources

- [NX Testing Documentation](https://nx.dev/recipes/testing)
- [Playwright Documentation](https://playwright.dev/)
- [Jest Documentation](https://jestjs.io/)
- [Docker Documentation](https://docs.docker.com/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
