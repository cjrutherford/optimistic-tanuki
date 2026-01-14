# CI/CD Pipeline Documentation

## Overview

This document describes the comprehensive CI/CD pipeline implementation for the Optimistic Tanuki monorepo. The pipeline uses GitHub Actions with Nx to provide efficient, parallelized workflows that only run affected projects.

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GitHub Actions                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   CI Main    │  │  Unit Tests  │  │     Lint     │          │
│  │   Pipeline   │  │  (Affected)  │  │  (Affected)  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │    Build     │  │   Coverage   │  │   E2E Tests  │          │
│  │  (Affected)  │  │   Reporting  │  │ (Microserv.) │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Performance │  │   Security   │  │ Dependency   │          │
│  │   Testing    │  │   Scanning   │  │   Updates    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐                             │
│  │    Deploy    │  │  Docker Pub  │                             │
│  │ (Staging/Prod)│  │              │                             │
│  └──────────────┘  └──────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

## Workflows

### 1. CI Main Pipeline (`ci.yml`)

**Trigger:** Pull requests, pushes to main/develop/MVP-polish
**Purpose:** Primary CI validation with affected commands

**Jobs:**

- **Validate** (10 min)
  - Check code formatting
  - Validate Nx workspace
- **Affected Build & Test** (30 min)
  - Parallel execution of lint, test, build
  - Only runs for affected projects
  - Matrix strategy for parallel jobs

**Optimization:**

- Uses `nx affected` to run only changed projects
- Parallel execution with max 3 concurrent jobs
- Caches npm dependencies for faster runs

### 2. Unit Tests (`unit-tests.yml`)

**Trigger:** Pull requests, pushes to main/develop
**Purpose:** Comprehensive unit test coverage

**Jobs:**

- **Unit Tests (Affected)** (20 min)
  - Runs tests for affected projects only
  - Generates coverage reports
  - Parallel execution (3 jobs)
- **Unit Tests (All)** (30 min)
  - Runs on schedule or manual trigger
  - Complete test suite for all projects
  - Weekly full validation

**Features:**

- Code coverage collection
- Coverage summary in GitHub Actions summary
- Artifact upload for coverage reports

### 3. Lint (`lint.yml`)

**Trigger:** Pull requests, pushes to main/develop
**Purpose:** Code quality validation

**Jobs:**

- **Lint (Affected)** (15 min)
  - Lints affected projects
  - Checks code formatting
- **Lint (All)** (20 min)
  - Weekly full lint check
  - Ensures no drift in code quality

### 4. Build (`build.yml`)

**Trigger:** Pull requests, pushes to main/develop
**Purpose:** Verify all projects build successfully

**Jobs:**

- **Build (Affected)** (30 min)
  - Production builds of affected projects
  - Parallel execution
- **Build (All)** (60 min)
  - Weekly full build verification
- **Docker Build Check** (45 min)
  - Validates Docker images build
  - Tests container startup
  - Matrix strategy for all services

**Services Tested:**

- authentication
- gateway
- profile
- social
- assets
- blogging
- project-planning
- permissions

### 5. Code Coverage (`coverage.yml`)

**Trigger:** Pull requests, pushes to main/develop
**Purpose:** Track and report test coverage

**Features:**

- Generates comprehensive coverage reports
- Creates coverage badges
- Posts PR comments with coverage data
- Uploads to Codecov
- Color-coded coverage indicators:
  - ✅ Good: ≥80%
  - ⚠️ Fair: 60-79%
  - ❌ Poor: <60%

**Coverage Metrics:**

- Statements coverage
- Branch coverage
- Function coverage
- Line coverage

### 6. E2E Tests (`e2e-tests.yml`)

**Trigger:** Pull requests, pushes to main/develop
**Purpose:** End-to-end testing across services

**Jobs:**

- **Microservices E2E** (30 min)
  - Tests each microservice independently
  - Matrix strategy for 11 services
- **UI E2E** (30 min)
  - Playwright tests for UI applications
  - Matrix strategy for 5 applications
- **Browser E2E Full Stack** (60 min)
  - Tests complete application stack
  - Cross-browser testing (Chromium, Firefox, WebKit)
- **Test Summary**
  - Aggregates results from all E2E jobs
  - Provides unified pass/fail status

### 7. Deploy (`deploy.yml`)

**Trigger:** Pushes to main, manual workflow dispatch
**Purpose:** Automated deployment to environments

**Environments:**

- **Staging**
  - Auto-deploys on main branch push
  - Runs smoke tests after deployment
- **Production**
  - Manual approval required
  - Requires staging deployment success
  - Creates GitHub release
  - Tags Docker images

**Deployment Flow:**

```
1. Build all projects (production config)
2. Build and tag Docker images
3. Push images to registry
4. Deploy to environment
5. Run smoke tests
6. Create release (production only)
```

### 8. Performance Testing (`performance.yml`)

**Trigger:** Pull requests to main, manual dispatch
**Purpose:** Performance validation and load testing

**Jobs:**

- **Lighthouse Performance Audit**
  - Tests digital-homestead, owner-console, forgeofwill
  - Measures:
    - Performance score
    - Accessibility
    - Best practices
    - SEO
- **Load Testing**
  - Uses k6 for load tests
  - Simulates user traffic patterns
  - Thresholds:
    - 95% of requests < 500ms
    - Error rate < 5%
  - Load stages:
    - Ramp up to 10 users (30s)
    - Hold at 10 users (1m)
    - Ramp up to 50 users (30s)
    - Hold at 50 users (1m)
    - Ramp down (30s)

### 9. Dependency Updates (`dependency-updates.yml`)

**Trigger:** Weekly schedule (Monday 9 AM UTC), manual dispatch
**Purpose:** Monitor and report dependency status

**Features:**

- Checks for outdated dependencies
- Runs security audit (npm audit)
- Reports vulnerabilities by severity:
  - Critical
  - High
  - Moderate
  - Low
- Generates weekly summary

**Dependabot Integration:**

- Automated PR creation for updates
- Grouped updates:
  - Production dependencies (minor/patch)
  - Development dependencies (minor/patch)
  - Nx dependencies
  - Angular dependencies
  - NestJS dependencies
- Ignores major version updates (stability)
- Updates GitHub Actions and Docker images

### 10. Security Scanning (`njsscan.yml`)

**Existing workflow for static security analysis**

### 11. Docker Publishing (`docker-publish.yml`)

**Existing workflow for publishing Docker images**

## Nx Affected Commands

The pipeline extensively uses Nx affected commands for efficiency:

```bash
# Only run tests for affected projects
npx nx affected -t test --parallel=3

# Only lint affected projects
npx nx affected -t lint --parallel=3

# Only build affected projects
npx nx affected -t build --parallel=3
```

**Benefits:**

- ⚡ Faster CI runs (only test what changed)
- 💰 Reduced CI costs (less compute time)
- 🔄 Better developer experience (faster feedback)

## Branch Protection

Recommended branch protection rules for `main`:

- ✅ Require pull request reviews (1+ approval)
- ✅ Require status checks to pass:
  - CI Main Pipeline
  - Unit Tests (Affected)
  - Lint (Affected)
  - Build (Affected)
  - E2E Tests (relevant jobs)
- ✅ Require branches to be up to date
- ✅ Require linear history
- ✅ Include administrators

## Caching Strategy

**npm dependencies:**

```yaml
- uses: actions/setup-node@v4
  with:
    cache: 'npm'
```

**Nx computation cache:**

- Configured in `nx.json`
- Caches build artifacts, test results, lint results
- Significantly speeds up repeated operations

## Secrets Required

### Docker Hub

- `DOCKER_USERNAME`
- `DOCKER_PASSWORD`

### Deployment

- `STAGING_URL`
- `PRODUCTION_URL`

### Coverage Reporting

- `CODECOV_TOKEN` (optional, for Codecov integration)

## Artifacts

All workflows upload artifacts for debugging and analysis:

**Retention Periods:**

- Coverage reports: 30 days
- Test results: 30 days
- Build artifacts: 7 days
- Docker logs: 7 days
- Performance results: 30 days

## Monitoring & Alerting

**GitHub Actions Summary:**

- Each workflow generates detailed summaries
- Visible in the Actions tab
- Includes test results, coverage data, performance metrics

**PR Comments:**

- Coverage reports posted as PR comments
- Automatically updates on new commits

## Best Practices

### For Developers

1. **Run affected commands locally before pushing:**

   ```bash
   npx nx affected:test
   npx nx affected:lint
   npx nx affected:build
   ```

2. **Check formatting:**

   ```bash
   npx nx format:check
   ```

3. **Fix formatting issues:**
   ```bash
   npx nx format:write
   ```

### For Reviewers

1. Check CI status before approving PRs
2. Review coverage reports in PR comments
3. Ensure no security vulnerabilities introduced
4. Verify affected projects are appropriate for the changes

## Troubleshooting

### CI Failing on Unrelated Projects

**Cause:** Nx affected detection may be too broad
**Solution:** Check `.nxignore` and `nx.json` configuration

### Out of Memory Errors

**Cause:** Too many parallel jobs
**Solution:** Reduce `maxParallel` setting or increase runner memory

### Flaky E2E Tests

**Cause:** Timing issues, network instability
**Solution:**

- Add retries to E2E tests
- Increase timeout values
- Use better wait strategies

### Slow CI Runs

**Solutions:**

1. Ensure caching is working
2. Use `nx affected` instead of `run-many`
3. Increase parallelization
4. Consider Nx Cloud for distributed task execution

## Future Enhancements

### Planned Improvements

1. **Nx Cloud Integration**

   - Distributed task execution
   - Remote caching
   - 5-10x faster CI runs

2. **Visual Regression Testing**

   - Percy or Chromatic integration
   - Automated visual diff detection

3. **Canary Deployments**

   - Gradual rollout to production
   - Automated rollback on errors

4. **Performance Budgets**

   - Fail CI if bundle size exceeds limits
   - Track performance metrics over time

5. **Security Scanning Enhancements**
   - Container scanning
   - SAST (Static Application Security Testing)
   - DAST (Dynamic Application Security Testing)

## Metrics & SLOs

### Service Level Objectives (SLOs)

**CI Pipeline:**

- P95 duration: < 20 minutes (affected)
- Success rate: > 95%
- Flakiness: < 2%

**Deployments:**

- Staging deployment: < 15 minutes
- Production deployment: < 20 minutes
- Rollback time: < 5 minutes

**Test Coverage:**

- Critical paths: > 90%
- Overall: > 85%
- New code: > 80%

## Support & Documentation

**Internal Resources:**

- [Nx Documentation](https://nx.dev)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)

**Project-Specific:**

- See individual workflow files for detailed configuration
- Check `nx.json` for Nx settings
- Review `package.json` for available scripts

---

**Last Updated:** 2026-01-06  
**Maintainer:** @cjrutherford  
**Version:** 1.0.0
