# Test Coverage Action Plan - 80% Target

## Current Status

**Repository:** optimistic-tanuki monorepo
**Target:** 80% code coverage (statements, branches, functions, lines)
**Test Command:** `pnpm exec nx run-many --target=test --all --configuration=ci`

### Issues Identified

1. **Jest Config Syntax Errors** - Fixed duplicate closing braces
2. **Test Compilation Errors** - Common in Angular component tests
3. **Coverage Gaps** - Most projects below 80% thresholds

## Priority Projects for 80% Coverage

### Tier 1: Quick Wins (Need minimal work)

| Project        | Current Lines | Gap | Status      |
| -------------- | ------------- | --- | ----------- |
| store          | ~80%          | ~0% | ✓ Passing   |
| chat-collector | 92.2%         | -   | Investigate |
| theme-models   | 100%          | -   | ✓ Passing   |

### Tier 2: Moderate Effort (Need additional tests)

| Project          | Current Lines | Gap    | Status                   |
| ---------------- | ------------- | ------ | ------------------------ |
| permissions      | 79.17%        | +0.83% | Add branch tests         |
| project-planning | 78.22%        | +1.78% | Add service tests        |
| assets           | 76.6%         | +3.4%  | Add error handling tests |
| social           | 75.5%         | +4.5%  | Fix config, add tests    |

### Tier 3: Significant Work Required

| Project            | Current                       | Gap            | Notes                               |
| ------------------ | ----------------------------- | -------------- | ----------------------------------- |
| forgeofwill        | 75.59% lines, 49.69% branches | +30% branches  | Angular app - needs component tests |
| telos-docs-service | 88.99% lines, 25% branches    | +55% branches  | Error handling paths                |
| authentication     | 91.78% lines, 72.6% branches  | +7.4% branches | Auth flow branches                  |

## Immediate Actions

### 1. Fix Jest Configuration Files

```bash
# Verify all jest configs parse correctly
pnpm exec nx test <project> --verbose
```

### 2. Fix Angular Component Test Files

Focus areas:

- common-ui: modal, table, grid, accordion, pagination components
- form-ui: All component tests
- social-ui: Socket-related test fixes

### 3. Add Missing Unit Tests

Create tests for uncovered branches in:

- permissions.service.ts - searchPermissions, role assignment logic
- roles.service.ts - error handling paths
- blog services - validation branches

## Test Writing Guidelines

### For NestJS Services

```typescript
describe('ServiceMethod', () => {
  it('should handle success case', async () => {});
  it('should handle error case', async () => {});
  it('should handle empty input', async () => {});
  it('should validate input parameters', async () => {});
});
```

### For Angular Components

```typescript
describe('Component', () => {
  it('should initialize correctly', () => {});
  it('should handle input changes', () => {});
  it('should emit output events', () => {});
  it('should handle user interactions', () => {});
});
```

## Running Tests

### Unit Tests with Coverage

```bash
# All projects
pnpm exec nx run-many --target=test --all --configuration=ci

# Single project
pnpm exec nx run <project>:test:ci

# With verbose output
pnpm exec nx run <project>:test:ci --verbose
```

### E2E Tests (Backend Services)

```bash
# Note: Requires Docker services running
pnpm exec nx run-many --target=e2e --all
```

## Coverage Reporting

After running tests, view coverage in:

- `coverage/<project>/index.html` - HTML report
- `coverage/<project>/coverage-summary.json` - JSON summary

## Next Steps

1. **Today**: Fix all Jest config syntax errors
2. **This Week**: Add tests for Tier 1 and Tier 2 projects
3. **This Sprint**: Address Tier 3 projects with comprehensive test additions
4. **Ongoing**: Maintain 80% coverage for new code

## Success Criteria

- All 50 projects have passing tests
- No coverage threshold failures
- E2E tests pass for backend services
- Playwright E2E tests pass (after dependency installation)

## Dependencies Required

For Playwright E2E tests:

```bash
sudo apt-get install libicu74 libxml2 libgtk-3-0 libnss3 libnspr4 \
  libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
  libasound2 libpango-1.0-0 libcairo2
```

---

_Plan generated: February 10, 2026_
