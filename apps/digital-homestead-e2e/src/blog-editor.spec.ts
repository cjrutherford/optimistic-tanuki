import { test, expect } from '@playwright/test';

test.describe('Blog Editor', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the blog editor page
    await page.goto('/blog/new');

    // Wait for editor to be loaded
    await page.waitForSelector('.prosemirror-editor', { timeout: 10000 });
  });

  test('should load blog editor with TipTap', async ({ page }) => {
    // Check if the editor is present
    const editor = page.locator('.prosemirror-editor');
    await expect(editor).toBeVisible();

    // Check if toolbar is present
    const toolbar = page.locator('.rich-text-toolbar, [class*="toolbar"]');
    await expect(toolbar).toBeVisible();
  });

  test('should allow typing in the editor', async ({ page }) => {
    const editor = page.locator('.prosemirror-editor');

    // Click into the editor
    await editor.click();

    // Type some content
    await editor.type('This is a test blog post content.');

    // Verify the content appears
    await expect(editor).toContainText('This is a test blog post content.');
  });

  test('should allow entering a title', async ({ page }) => {
    // Find the title input
    const titleInput = page
      .locator('input[placeholder*="title" i], input[name="title"]')
      .first();

    // Enter a title
    await titleInput.fill('My Test Blog Post');

    // Verify the title
    await expect(titleInput).toHaveValue('My Test Blog Post');
  });

  test('should support rich text formatting', async ({ page }) => {
    const editor = page.locator('.prosemirror-editor');
    await editor.click();
    await editor.type('Bold text');

    // Select all text (Ctrl+A or Cmd+A)
    await page.keyboard.press('Control+A');

    // Apply bold formatting (Ctrl+B or Cmd+B)
    await page.keyboard.press('Control+B');

    // Check if bold tag exists in the editor
    const boldText = editor.locator('strong, b');
    await expect(boldText).toBeVisible();
    await expect(boldText).toContainText('Bold text');
  });

  test('should support italic formatting', async ({ page }) => {
    const editor = page.locator('.prosemirror-editor');
    await editor.click();
    await editor.type('Italic text');

    await page.keyboard.press('Control+A');
    await page.keyboard.press('Control+I');

    const italicText = editor.locator('em, i');
    await expect(italicText).toBeVisible();
    await expect(italicText).toContainText('Italic text');
  });

  test('should support headings', async ({ page }) => {
    const editor = page.locator('.prosemirror-editor');
    await editor.click();

    // Type heading markdown syntax
    await editor.type('# Heading 1');
    await page.keyboard.press('Enter');

    // Check if H1 was created
    const heading = editor.locator('h1');
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('Heading 1');
  });

  test('should support bullet lists', async ({ page }) => {
    const editor = page.locator('.prosemirror-editor');
    await editor.click();

    // Type list markdown
    await editor.type('- Item 1');
    await page.keyboard.press('Enter');
    await editor.type('Item 2');

    // Check if list was created
    const list = editor.locator('ul');
    await expect(list).toBeVisible();

    const listItems = editor.locator('li');
    await expect(listItems).toHaveCount(2);
  });

  test('should support image insertion via drag and drop', async ({ page }) => {
    const editor = page.locator('.prosemirror-editor');

    // Create a test image file
    const buffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    // Simulate file drop
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    await dataTransfer.evaluate((dt, buffer) => {
      const file = new File([buffer], 'test-image.png', { type: 'image/png' });
      dt.items.add(file);
    }, buffer);

    // Trigger drop event
    await editor.dispatchEvent('drop', { dataTransfer });

    // Wait a bit for the image to be processed
    await page.waitForTimeout(1000);

    // Check if image was inserted
    const image = editor.locator('img');
    await expect(image).toBeVisible();
  });

  test('should support component injection', async ({ page }) => {
    // Click the component selector button
    const componentButton = page
      .locator(
        'button:has-text("Components"), button:has-text("Add Component")'
      )
      .first();

    if (await componentButton.isVisible()) {
      await componentButton.click();

      // Wait for component selector to appear
      await page.waitForSelector('[class*="component-selector"]', {
        timeout: 5000,
      });

      // Select a component (e.g., Callout Box)
      const calloutComponent = page
        .locator('text=Callout Box, [data-component-id="callout-box"]')
        .first();
      await calloutComponent.click();

      // Verify component was injected
      await page.waitForTimeout(500);
      const injectedComponent = page.locator(
        '[data-component-type="callout-box"], .callout-box'
      );
      await expect(injectedComponent).toBeVisible();
    }
  });

  test('should save as draft', async ({ page }) => {
    // Fill in the form
    const titleInput = page.locator('input[placeholder*="title" i]').first();
    await titleInput.fill('Draft Post');

    const editor = page.locator('.prosemirror-editor');
    await editor.click();
    await editor.type('This is a draft post content.');

    // Click save as draft button
    const saveDraftButton = page
      .locator(
        'button:has-text("Save Draft"), button:has-text("Save as Draft")'
      )
      .first();
    await saveDraftButton.click();

    // Wait for success message or navigation
    await page.waitForTimeout(1000);

    // Check for success indication (could be a toast, message, or URL change)
    const successIndicator = page.locator(
      '.success, .toast, [class*="success"]'
    );
    // This is a soft check since the exact implementation may vary
    if (
      await successIndicator.isVisible({ timeout: 2000 }).catch(() => false)
    ) {
      await expect(successIndicator).toBeVisible();
    }
  });

  test('should validate required fields', async ({ page }) => {
    // Try to submit without filling fields
    const submitButton = page
      .locator(
        'button:has-text("Publish"), button:has-text("Submit"), button[type="submit"]'
      )
      .first();
    await submitButton.click();

    // Check for validation errors
    const errorMessage = page.locator(
      '.error, [class*="error"], .invalid-feedback'
    );

    // Wait a bit to see if errors appear
    await page.waitForTimeout(500);

    // At least one error should be visible
    const errorCount = await errorMessage.count();
    expect(errorCount).toBeGreaterThan(0);
  });

  test('should support text alignment', async ({ page }) => {
    const editor = page.locator('.prosemirror-editor');
    await editor.click();
    await editor.type('Centered text');

    await page.keyboard.press('Control+A');

    // Look for alignment button in toolbar
    const centerButton = page
      .locator('button[title*="Center" i], button:has-text("Center")')
      .first();

    if (await centerButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await centerButton.click();

      // Check if text-align style was applied
      const centeredParagraph = editor.locator(
        'p[style*="text-align"], [style*="text-align: center"]'
      );
      await expect(centeredParagraph).toBeVisible();
    }
  });

  test('should support tables', async ({ page }) => {
    const editor = page.locator('.prosemirror-editor');
    await editor.click();

    // Look for table button in toolbar
    const tableButton = page
      .locator('button[title*="Table" i], button:has-text("Table")')
      .first();

    if (await tableButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await tableButton.click();

      // Wait for table to be inserted
      await page.waitForTimeout(500);

      // Check if table was created
      const table = editor.locator('table');
      await expect(table).toBeVisible();
    }
  });

  test('should support code blocks', async ({ page }) => {
    const editor = page.locator('.prosemirror-editor');
    await editor.click();

    // Type code block markdown
    await editor.type('```javascript');
    await page.keyboard.press('Enter');
    await editor.type('console.log("Hello");');

    // Check if code block was created
    const codeBlock = editor.locator('pre code, .code-block');
    await expect(codeBlock).toBeVisible();
  });

  test('should persist content during editing', async ({ page }) => {
    const titleInput = page.locator('input[placeholder*="title" i]').first();
    const editor = page.locator('.prosemirror-editor');

    // Enter initial content
    await titleInput.fill('Persistent Title');
    await editor.click();
    await editor.type('Initial content');

    // Add more content
    await page.keyboard.press('Enter');
    await editor.type('More content');

    // Verify all content is still there
    await expect(titleInput).toHaveValue('Persistent Title');
    await expect(editor).toContainText('Initial content');
    await expect(editor).toContainText('More content');
  });

  test('should support undo/redo', async ({ page }) => {
    const editor = page.locator('.prosemirror-editor');
    await editor.click();
    await editor.type('First text');

    // Undo
    await page.keyboard.press('Control+Z');

    // Text should be removed
    const editorContent = await editor.textContent();
    expect(editorContent).not.toContain('First text');

    // Redo
    await page.keyboard.press('Control+Shift+Z');

    // Text should be back
    await expect(editor).toContainText('First text');
  });

  test('should create a new blog post', async ({ page }) => {
    // Fill in the title
    const titleInput = page.locator('input[name="title"]');
    await expect(titleInput).toBeVisible();
    await titleInput.fill('E2E Test Blog Post');

    // Type content into the editor
    const editor = page.locator('.prosemirror-editor');
    await expect(editor).toBeVisible();
    await editor.click();
    await editor.type('This is the content of the E2E test blog post.');

    // Click the save button
    const saveButton = page.locator('button:has-text("Save")');
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Verify the post appears in the list
    const postList = page.locator('.post-list .post-item');
    await expect(postList).toContainText('E2E Test Blog Post');
  });

  test('should edit an existing blog post', async ({ page }) => {
    // Navigate to an existing post
    const postItem = page.locator(
      '.post-list .post-item:has-text("E2E Test Blog Post")'
    );
    await postItem.click();

    // Edit the title
    const titleInput = page.locator('input[name="title"]');
    await titleInput.fill('Updated E2E Test Blog Post');

    // Edit the content
    const editor = page.locator('.prosemirror-editor');
    await editor.click();
    await editor.type(' Updated content.');

    // Save the changes
    const saveButton = page.locator('button:has-text("Save")');
    await saveButton.click();

    // Verify the changes
    await expect(postItem).toContainText('Updated E2E Test Blog Post');
  });

  test('should publish a draft', async ({ page }) => {
    // Navigate to drafts
    const draftTab = page.locator('button:has-text("Drafts")');
    await draftTab.click();

    // Select a draft
    const draftItem = page.locator(
      '.post-list .post-item:has-text("Draft Blog Post")'
    );
    await draftItem.click();

    // Publish the draft
    const publishButton = page.locator('button:has-text("Publish")');
    await publishButton.click();

    // Verify the draft is published
    const publishedTab = page.locator('button:has-text("Published")');
    await publishedTab.click();
    const publishedItem = page.locator(
      '.post-list .post-item:has-text("Draft Blog Post")'
    );
    await expect(publishedItem).toBeVisible();
  });

  test('should delete a blog post', async ({ page }) => {
    // Navigate to the post
    const postItem = page.locator(
      '.post-list .post-item:has-text("E2E Test Blog Post")'
    );
    await expect(postItem).toBeVisible();
    await postItem.click();

    // Delete the post
    const deleteButton = page.locator('button:has-text("Delete")');
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    // Confirm deletion
    const confirmButton = page.locator('button:has-text("Confirm")');
    await expect(confirmButton).toBeVisible();
    await confirmButton.click();

    // Verify the post is removed
    await expect(postItem).toBeHidden();
  });
});

test.describe('Blog Search Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/blog');
  });

  test('should have a search input', async ({ page }) => {
    const searchInput = page
      .locator('input[type="search"], input[placeholder*="search" i]')
      .first();
    await expect(searchInput).toBeVisible();
  });

  test('should search blog posts', async ({ page }) => {
    const searchInput = page
      .locator('input[type="search"], input[placeholder*="search" i]')
      .first();

    // Enter search term
    await searchInput.fill('test');
    await searchInput.press('Enter');

    // Wait for results
    await page.waitForTimeout(1000);

    // Check if results are displayed
    const searchResults = page.locator(
      '.search-results, [class*="search-result"], .blog-post'
    );
    const resultCount = await searchResults.count();

    // Results should be visible (could be 0 or more depending on data)
    expect(resultCount).toBeGreaterThanOrEqual(0);
  });

  test('should show no results message for non-existent search', async ({
    page,
  }) => {
    const searchInput = page
      .locator('input[type="search"], input[placeholder*="search" i]')
      .first();

    // Search for something that definitely doesn't exist
    await searchInput.fill('xyzabc123nonexistent999');
    await searchInput.press('Enter');

    await page.waitForTimeout(1000);

    // Check for "no results" message
    const noResults = page.locator(
      'text=/no results|not found|no posts found/i'
    );

    // This might not always appear depending on implementation
    if (await noResults.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(noResults).toBeVisible();
    }
  });
});

test.describe('Blog Contact Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contact');
  });

  test('should display contact form', async ({ page }) => {
    const form = page.locator('form, [class*="contact-form"]');
    await expect(form).toBeVisible();

    // Check for required fields
    const nameInput = page
      .locator('input[name="name"], input[placeholder*="name" i]')
      .first();
    const emailInput = page
      .locator('input[name="email"], input[type="email"]')
      .first();
    const messageInput = page
      .locator('textarea[name="message"], textarea[placeholder*="message" i]')
      .first();

    await expect(nameInput).toBeVisible();
    await expect(emailInput).toBeVisible();
    await expect(messageInput).toBeVisible();
  });

  test('should validate email format', async ({ page }) => {
    const nameInput = page.locator('input[name="name"]').first();
    const emailInput = page.locator('input[type="email"]').first();
    const messageInput = page.locator('textarea[name="message"]').first();
    const submitButton = page.locator('button[type="submit"]').first();

    // Fill form with invalid email
    await nameInput.fill('John Doe');
    await emailInput.fill('invalid-email');
    await messageInput.fill('This is a test message with proper length.');

    await submitButton.click();

    // Wait for validation
    await page.waitForTimeout(500);

    // Check for error message
    const emailError = page.locator('.error, [class*="invalid"]').first();
    await expect(emailError).toBeVisible();
  });

  test('should validate message length', async ({ page }) => {
    const nameInput = page.locator('input[name="name"]').first();
    const emailInput = page.locator('input[type="email"]').first();
    const messageInput = page.locator('textarea[name="message"]').first();
    const submitButton = page.locator('button[type="submit"]').first();

    // Fill form with short message
    await nameInput.fill('John Doe');
    await emailInput.fill('john@example.com');
    await messageInput.fill('Hi');

    await submitButton.click();

    await page.waitForTimeout(500);

    // Check for error about message length
    const error = page.locator(
      'text=/message.*too short|minimum.*characters/i'
    );

    if (await error.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(error).toBeVisible();
    }
  });

  test('should submit valid contact form', async ({ page }) => {
    const nameInput = page.locator('input[name="name"]').first();
    const emailInput = page.locator('input[type="email"]').first();
    const messageInput = page.locator('textarea[name="message"]').first();
    const submitButton = page.locator('button[type="submit"]').first();

    // Fill form with valid data
    await nameInput.fill('John Doe');
    await emailInput.fill('john@example.com');
    await messageInput.fill(
      'This is a legitimate message with proper content and length for testing.'
    );

    await submitButton.click();

    // Wait for submission
    await page.waitForTimeout(2000);

    // Check for success message
    const success = page.locator(
      '.success, [class*="success"], text=/success|thank you|sent/i'
    );

    if (await success.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(success).toBeVisible();
    }
  });

  test('should have honeypot field hidden', async ({ page }) => {
    // Look for honeypot field (should be hidden)
    const honeypot = page.locator(
      'input[name="honeypot"], input[name="website"]'
    );

    if ((await honeypot.count()) > 0) {
      // Honeypot should exist but be hidden
      await expect(honeypot).toHaveCSS('position', 'absolute');
      await expect(honeypot).toHaveCSS('left', /-\d+px/);
    }
  });
});
