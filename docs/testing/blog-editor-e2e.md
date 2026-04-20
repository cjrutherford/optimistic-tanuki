# Blog Editor E2E Testing Guide

## Overview

This document describes the E2E (End-to-End) tests for the Blog Editor component in the Digital Homestead application. These tests use Playwright to verify the rich text editing functionality and blog features.

## Test Coverage

### Blog Editor Component Tests

The blog editor tests verify the TipTap-based rich text editor with the following functionality:

#### Basic Functionality

- ✅ Editor loads correctly with TipTap
- ✅ Typing in the editor
- ✅ Title input functionality
- ✅ Content persistence during editing
- ✅ Undo/Redo operations

#### Rich Text Formatting

- ✅ Bold formatting (Ctrl+B)
- ✅ Italic formatting (Ctrl+I)
- ✅ Headings (Markdown syntax: `# Heading`)
- ✅ Bullet lists (Markdown syntax: `- Item`)
- ✅ Text alignment (Center, Left, Right)
- ✅ Tables
- ✅ Code blocks (Markdown syntax: ` ```language `)

#### Advanced Features

- ✅ Image insertion via drag-and-drop
- ✅ Component injection (Callout boxes, code snippets, etc.)
- ✅ Save as draft functionality
- ✅ Form validation
- ✅ Publish functionality

### Blog Search Tests

- ✅ Search input visibility
- ✅ Search functionality with results
- ✅ No results message for non-existent searches

### Contact Form Tests

- ✅ Form display and required fields
- ✅ Email format validation
- ✅ Message length validation
- ✅ Successful form submission
- ✅ Honeypot field (hidden spam protection)

## Test File Location

```
apps/digital-homestead-e2e/src/blog-editor.spec.ts
```

## Running the Tests

### Prerequisites

1. Ensure the Digital Homestead application is built:

   ```bash
   pnpm exec nx build digital-homestead
   ```

2. Ensure the backend services are running:
   ```bash
   docker-compose up -d
   ```

### Running E2E Tests

```bash
# Run all digital-homestead E2E tests
pnpm exec nx e2e digital-homestead-e2e

# Run only blog editor tests
pnpm exec nx e2e digital-homestead-e2e --grep="Blog Editor"

# Run in headed mode (see browser)
pnpm exec nx e2e digital-homestead-e2e --headed

# Run in debug mode
pnpm exec nx e2e digital-homestead-e2e --debug

# Run specific test
pnpm exec nx e2e digital-homestead-e2e --grep="should allow typing in the editor"
```

### Watch Mode

```bash
pnpm exec nx e2e digital-homestead-e2e --ui
```

This opens the Playwright UI where you can:

- Select specific tests to run
- View test execution in real-time
- Debug failing tests
- View screenshots and traces

## Test Structure

### Blog Editor Tests

```typescript
test.describe('Blog Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/blog/new');
    await page.waitForSelector('.prosemirror-editor');
  });

  test('test description', async ({ page }) => {
    // Test implementation
  });
});
```

### Key Selectors

The tests use flexible selectors to handle various implementations:

```typescript
// Editor
'.prosemirror-editor';

// Title input
'input[placeholder*="title" i], input[name="title"]';

// Toolbar
'.rich-text-toolbar, [class*="toolbar"]';

// Component selector
'[class*="component-selector"]';

// Success messages
'.success, .toast, [class*="success"]';

// Error messages
'.error, [class*="error"], .invalid-feedback';
```

## Test Scenarios

### 1. Basic Editing

**Test:** `should allow typing in the editor`

**Steps:**

1. Click into the editor
2. Type some content
3. Verify content appears

**Expected:** Text appears in the editor

### 2. Rich Text Formatting

**Test:** `should support rich text formatting`

**Steps:**

1. Type text
2. Select all (Ctrl+A)
3. Apply formatting (Ctrl+B for bold)
4. Verify formatting applied

**Expected:** Text is wrapped in `<strong>` or `<b>` tags

### 3. Component Injection

**Test:** `should support component injection`

**Steps:**

1. Click "Add Component" button
2. Select a component (e.g., Callout Box)
3. Verify component appears in editor

**Expected:** Component is visible in the editor

### 4. Save as Draft

**Test:** `should save as draft`

**Steps:**

1. Fill title and content
2. Click "Save Draft" button
3. Wait for success indication

**Expected:** Draft is saved, success message shown

### 5. Form Validation

**Test:** `should validate required fields`

**Steps:**

1. Click submit without filling fields
2. Wait for validation

**Expected:** Error messages appear

## Testing Best Practices

### 1. Wait for Elements

Always wait for elements to be visible before interacting:

```typescript
await page.waitForSelector('.prosemirror-editor', { timeout: 10000 });
```

### 2. Use Flexible Selectors

Use multiple selectors to handle different implementations:

```typescript
const titleInput = page.locator('input[placeholder*="title" i], input[name="title"]').first();
```

### 3. Soft Checks

For optional features, use soft checks:

```typescript
if (await componentButton.isVisible({ timeout: 2000 }).catch(() => false)) {
  // Test the feature
}
```

### 4. Timeouts

Add appropriate timeouts for async operations:

```typescript
await page.waitForTimeout(1000); // Give time for async operations
```

### 5. Test Isolation

Each test should be independent and not rely on previous test state.

## Debugging Failed Tests

### 1. View Screenshots

Playwright automatically captures screenshots on failure:

```
test-results/
  blog-editor-should-allow-typing/
    test-failed-1.png
```

### 2. View Traces

Enable trace mode to debug:

```bash
pnpm exec nx e2e digital-homestead-e2e --trace=on
```

View traces:

```bash
pnpm exec playwright show-trace trace.zip
```

### 3. Debug Mode

Run in debug mode to step through tests:

```bash
pnpm exec nx e2e digital-homestead-e2e --debug
```

### 4. Console Logs

Check console output for errors:

```typescript
page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build application
        run: pnpm exec nx build digital-homestead

      - name: Start services
        run: docker-compose up -d

      - name: Wait for services
        run: pnpm exec wait-on http://localhost:3000/health

      - name: Run E2E tests
        run: pnpm exec nx e2e digital-homestead-e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## Known Issues & Workarounds

### Issue 1: Editor not loading

**Symptom:** Test fails with "Selector '.prosemirror-editor' not found"

**Solution:** Increase timeout or ensure application is fully loaded:

```typescript
await page.waitForSelector('.prosemirror-editor', { timeout: 15000 });
```

### Issue 2: Component injection fails

**Symptom:** Component selector doesn't appear

**Solution:** Check if feature is behind a permission or authentication:

```typescript
// Login first if needed
await page.goto('/login');
await loginUser(page, credentials);
await page.goto('/blog/new');
```

### Issue 3: Form validation inconsistent

**Symptom:** Validation errors don't appear consistently

**Solution:** Add explicit waits and check multiple error selectors:

```typescript
await page.waitForTimeout(500);
const errors = await page.locator('.error, [class*="invalid"]').count();
expect(errors).toBeGreaterThan(0);
```

## Performance Testing

### Load Time Tests

```typescript
test('should load editor within 3 seconds', async ({ page }) => {
  const startTime = Date.now();
  await page.goto('/blog/new');
  await page.waitForSelector('.prosemirror-editor');
  const loadTime = Date.now() - startTime;

  expect(loadTime).toBeLessThan(3000);
});
```

### Typing Performance

```typescript
test('should handle rapid typing smoothly', async ({ page }) => {
  const editor = page.locator('.prosemirror-editor');
  await editor.click();

  const longText = 'A'.repeat(1000);
  const startTime = Date.now();
  await editor.type(longText);
  const typingTime = Date.now() - startTime;

  // Should type 1000 characters in under 5 seconds
  expect(typingTime).toBeLessThan(5000);
});
```

## Accessibility Testing

### Keyboard Navigation

```typescript
test('should support keyboard navigation', async ({ page }) => {
  await page.goto('/blog/new');

  // Tab through form fields
  await page.keyboard.press('Tab');
  await expect(page.locator(':focus')).toBeTruthy();

  // Continue tabbing
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');

  // Should reach editor
  const editorFocused = await page.locator('.prosemirror-editor:focus').count();
  expect(editorFocused).toBeGreaterThan(0);
});
```

### Screen Reader Support

```typescript
test('should have proper aria labels', async ({ page }) => {
  await page.goto('/blog/new');

  const titleInput = page.locator('input[name="title"]');
  const ariaLabel = await titleInput.getAttribute('aria-label');

  expect(ariaLabel || '').toContain('title');
});
```

## Next Steps

1. **Expand Coverage**

   - Add tests for image galleries
   - Test all injectable components
   - Add tests for collaborative editing

2. **Visual Regression Testing**

   - Add Playwright screenshot comparison
   - Test responsive layouts
   - Verify theme variations

3. **Performance Benchmarks**

   - Set up performance budgets
   - Monitor editor responsiveness
   - Track bundle size

4. **Cross-Browser Testing**
   - Test on Chrome, Firefox, Safari
   - Mobile browser testing
   - Different screen sizes

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [TipTap Documentation](https://tiptap.dev/)
- [Testing Best Practices](https://playwright.dev/docs/best-practices)
- [Accessibility Testing](https://playwright.dev/docs/accessibility-testing)

## Support

For issues or questions about the E2E tests:

1. Check the test logs in `test-results/`
2. Review screenshots and traces
3. Consult the Digital Homestead team
4. Open an issue in the repository
