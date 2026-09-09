import type { BrowserContext, Cookie, Page } from '@playwright/test';
import { expect, test } from '../../../e2e/playwright-hermetic';
import { waitForHydration } from '../../../e2e/wait-for-hydration';

/**
 * Blog editor coverage for digital-homestead.
 *
 * The previous version of this file was written against a design that was
 * never built: it navigated to `/blog/new` (no such route — see
 * `apps/digital-homestead/src/app/app.routes.ts`, which only declares `blog`
 * and `blog/:id`) and waited on `.prosemirror-editor` (no such class — the
 * editor is `<tiptap-editor>` from `lib-blog-compose`). Every test therefore
 * failed in `beforeEach` before asserting anything. It also carried
 * `Blog Search Feature` and `Blog Contact Form` suites for a search box and a
 * `/contact` route that do not exist in this app at all; those have been
 * dropped rather than rewritten, because there is no implementation for them
 * to match.
 *
 * What the editor really is: the blog page renders `lib-blog-compose` inline
 * once `mode()` is `create` or `edit`, gated behind
 * `canEdit() = isAuthenticated() && hasFullAccess()`. So reaching it needs a
 * signed-in user who also holds an owner/author role.
 */

/** A role payload that satisfies PermissionService.checkFullAccess. */
function ownerRoles(profileId: string) {
  return [
    {
      id: 'e2e-user-role',
      profileId,
      roleId: 'e2e-role',
      appScopeId: 'digital-homestead',
      appScope: { id: 'digital-homestead', name: 'digital-homestead' },
      role: {
        id: 'e2e-role',
        name: 'digital_homesteader',
        description: 'Full blog access for the e2e run',
        permissions: [
          { id: 'p1', name: 'blog.post.create' },
          { id: 'p2', name: 'blog.post.update' },
          { id: 'p3', name: 'blog.post.delete' },
        ],
      },
    },
  ];
}

/**
 * Grant the signed-in user blog-editing rights.
 *
 * `apps/permissions/src/assets/default-permissions.json` seeds the
 * `digital_homesteader` role and the `blog.post.*` permissions, but it creates
 * no role *assignments*, and nothing in the e2e stack assigns one to the OAuth
 * fixture user. Rather than depend on a seed that does not exist, stub the one
 * endpoint PermissionService reads — the same technique
 * `apps/store-client-e2e` and `apps/system-configurator-e2e` already use. The
 * authentication half of the gate is still exercised for real.
 */
async function grantBlogEditAccess(page: Page): Promise<void> {
  await page.route('**/api/permissions/user-roles/**', async (route) => {
    const profileId = decodeURIComponent(
      new URL(route.request().url()).pathname.split('/').pop() ?? ''
    );
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ownerRoles(profileId)),
    });
  });
}

/** Deny blog-editing rights while leaving the user signed in. */
async function denyBlogEditAccess(page: Page): Promise<void> {
  await page.route('**/api/permissions/user-roles/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    })
  );
}

/**
 * Register an account and sign in with it, ending on `/blog`.
 *
 * This used to go through the fake OAuth provider, but digital-homestead no
 * longer offers OAuth: clicking a provider button did nothing observable —
 * no popup, no request, no error — so the buttons were withdrawn rather than
 * left silently inert. Email and password is the remaining way in.
 *
 * Registration goes over the API because this app has no register route; only
 * `login`, the email-action routes and `blog` are declared. It needs the app
 * headers, because the gateway resolves a canonical app id from x-ot-app-id,
 * x-ot-appscope or Origin and answers 400 when it cannot. The stack sets
 * AUTH_AUTO_VERIFY_EMAILS, so the account can sign in immediately.
 */
async function signIn(page: Page): Promise<void> {
  const email = `blog-editor-${Date.now()}-${
    test.info().parallelIndex
  }@example.test`;
  const password = 'Test@Password123';

  const registered = await page.request.post('/api/authentication/register', {
    headers: {
      'x-ot-appscope': 'digital-homestead',
      'x-ot-app-id': 'digital-homestead',
    },
    data: {
      email,
      fn: 'Blog',
      ln: 'Editor',
      password,
      confirm: password,
      bio: 'Blog editor e2e user',
    },
  });
  expect(
    registered.ok(),
    `register returned ${registered.status()}: ${await registered.text()}`
  ).toBe(true);

  await page.goto('/login');
  await waitForHydration(page);

  await page
    .locator('lib-text-input[formControlName="email"] input')
    .fill(email);
  await page
    .locator('lib-text-input[formControlName="password"] input')
    .fill(password);
  await page.getByRole('button', { name: 'Login' }).click();

  // onLogin() navigates to /blog once AuthStateService.login resolves.
  await expect(page).toHaveURL(/\/blog(?:\?|$)/, { timeout: 30_000 });
}

/**
 * Create a draft and open it in the editor.
 *
 * `startCreatePost()` posts a real "Untitled Draft", sets `mode` to `edit` and
 * then navigates to `/blog/:id` — but the component's route effect fires on
 * that navigation and resets `mode` back to `view`. So "New Post" lands on the
 * new draft in view mode, and "Edit Post" is the click that actually opens the
 * editor.
 */
async function openEditorOnNewDraft(page: Page): Promise<void> {
  await page.locator('.sidebar-header otui-button button').click();
  await expect(page).toHaveURL(/\/blog\/[^/]+$/, { timeout: 20_000 });

  await page.locator('.view-actions button:has-text("Edit Post")').click();
  await expect(editorBody(page)).toBeVisible({ timeout: 20_000 });
}

/** The contenteditable surface TipTap manages inside `<tiptap-editor>`. */
function editorBody(page: Page) {
  return page.locator('tiptap-editor .ProseMirror');
}

/** A toolbar button, addressed by the tooltip `RichTextToolbarComponent` sets. */
function tool(page: Page, tooltip: string) {
  return page.locator(`button.toolbar-btn[title="${tooltip}"]`);
}

/** The post title field — `lib-text-input` renders a plain `<input>` inside. */
function titleInput(page: Page) {
  return page.locator('lib-text-input#title input');
}

/**
 * Session cookies from the first sign-in, reused by the rest of the suite.
 *
 * Running the full OAuth popup flow in `beforeEach` cost this suite its job:
 * with ~18 tests, two CI retries each, and a login that could stall for the
 * 30s test timeout, it ran past the 35-minute job budget and was cancelled
 * before finishing. One sign-in per worker keeps the authentication real
 * while spending it once. Module scope means one worker process, which is
 * what CI uses; a second worker simply signs in again.
 */
let sessionCookies: Cookie[] | null = null;

async function authenticate(page: Page, context: BrowserContext) {
  if (sessionCookies) {
    await context.addCookies(sessionCookies);
    await page.goto('/blog', { waitUntil: 'domcontentloaded' });
    return;
  }

  await signIn(page);
  sessionCookies = await context.cookies();
}

test.describe('Blog editor', () => {
  // Serial, because the cost of this suite is per test: each one signs in (or
  // reuses the session), creates a real draft and opens the editor. If that
  // setup breaks, 18 tests times three CI attempts runs past the 35-minute job
  // budget and the job is cancelled — reporting nothing at all, which is how
  // this suite failed twice. Serial stops at the first failure and reports it.
  // The tests already share a session and are not independent.
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page, context }) => {
    await grantBlogEditAccess(page);
    await authenticate(page, context);
    await openEditorOnNewDraft(page);
    await editorBody(page).click();
  });

  test('renders the TipTap editor and its toolbar', async ({ page }) => {
    await expect(editorBody(page)).toBeVisible();
    await expect(page.locator('lib-rich-text-toolbar')).toBeVisible();
    await expect(tool(page, 'Bold (Ctrl+B)')).toBeVisible();
    await expect(titleInput(page)).toHaveValue('Untitled Draft');
  });

  test('accepts typed content', async ({ page }) => {
    await page.keyboard.type('This is a test blog post body.');
    await expect(editorBody(page)).toContainText(
      'This is a test blog post body.'
    );
  });

  test('accepts a new title', async ({ page }) => {
    await titleInput(page).fill('My Test Blog Post');
    await expect(titleInput(page)).toHaveValue('My Test Blog Post');
  });

  test('applies bold from the toolbar', async ({ page }) => {
    await page.keyboard.type('Bold text');
    await page.keyboard.press('Control+A');
    await tool(page, 'Bold (Ctrl+B)').click();

    await expect(editorBody(page).locator('strong')).toContainText('Bold text');
    await expect(tool(page, 'Bold (Ctrl+B)')).toHaveClass(/is-active/);
  });

  test('applies bold from the keyboard shortcut', async ({ page }) => {
    await page.keyboard.type('Shortcut bold');
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Control+B');

    await expect(editorBody(page).locator('strong')).toContainText(
      'Shortcut bold'
    );
  });

  test('applies italic from the toolbar', async ({ page }) => {
    await page.keyboard.type('Italic text');
    await page.keyboard.press('Control+A');
    await tool(page, 'Italic (Ctrl+I)').click();

    await expect(editorBody(page).locator('em')).toContainText('Italic text');
  });

  test('applies headings from the toolbar', async ({ page }) => {
    await page.keyboard.type('Heading 1');
    await tool(page, 'Heading 1').click();
    await expect(editorBody(page).locator('h1')).toContainText('Heading 1');

    await tool(page, 'Heading 2').click();
    await expect(editorBody(page).locator('h2')).toContainText('Heading 1');
  });

  test('builds a bullet list from the toolbar', async ({ page }) => {
    await tool(page, 'Bullet List').click();
    await page.keyboard.type('Item 1');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Item 2');

    await expect(editorBody(page).locator('ul')).toBeVisible();
    await expect(editorBody(page).locator('ul li')).toHaveCount(2);
  });

  test('builds a numbered list from the toolbar', async ({ page }) => {
    await tool(page, 'Numbered List').click();
    await page.keyboard.type('First');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second');

    await expect(editorBody(page).locator('ol li')).toHaveCount(2);
  });

  test('creates a blockquote from the toolbar', async ({ page }) => {
    await page.keyboard.type('Quoted line');
    await tool(page, 'Blockquote').click();

    await expect(editorBody(page).locator('blockquote')).toContainText(
      'Quoted line'
    );
  });

  test('creates a code block from the toolbar', async ({ page }) => {
    await tool(page, 'Code Block').click();
    await page.keyboard.type('console.log("Hello");');

    await expect(editorBody(page).locator('pre code')).toContainText(
      'console.log("Hello");'
    );
  });

  test('applies text alignment from the toolbar', async ({ page }) => {
    await page.keyboard.type('Centered text');
    await tool(page, 'Align Center').click();

    await expect(
      editorBody(page).locator('[style*="text-align: center"]')
    ).toContainText('Centered text');
  });

  test('inserts a table and exposes the table management tools', async ({
    page,
  }) => {
    await tool(page, 'Insert Table').click();

    const table = editorBody(page).locator('table');
    await expect(table).toBeVisible();
    await expect(table.locator('tr')).toHaveCount(3);

    // The toolbar grows a "Table Management" group only while the cursor sits
    // inside a table, so its presence doubles as proof the cursor landed there.
    await expect(tool(page, 'Add Row After')).toBeVisible();
    await tool(page, 'Add Row After').click();
    await expect(table.locator('tr')).toHaveCount(4);

    await tool(page, 'Delete Table').click();
    await expect(table).toHaveCount(0);
  });

  test('undoes and redoes from the toolbar', async ({ page }) => {
    await page.keyboard.type('First text');
    await expect(editorBody(page)).toContainText('First text');

    await tool(page, 'Undo (Ctrl+Z)').click();
    await expect(editorBody(page)).not.toContainText('First text');

    await tool(page, 'Redo (Ctrl+Y)').click();
    await expect(editorBody(page)).toContainText('First text');
  });

  test('opens the component selector', async ({ page }) => {
    await page.locator('button.toolbar-btn[title="Insert Component"]').click();

    const selector = page.locator('.component-selector');
    await expect(selector).toBeVisible();
    await expect(selector.locator('.selector-header h3')).toHaveText(
      'Insert Component'
    );

    await selector.locator('button:has-text("Cancel")').click();
    await expect(selector).toBeHidden();
  });

  test('keeps title and body together while editing', async ({ page }) => {
    await titleInput(page).fill('Persistent Title');
    await editorBody(page).click();
    await page.keyboard.type('Initial content');
    await page.keyboard.press('Enter');
    await page.keyboard.type('More content');

    await expect(titleInput(page)).toHaveValue('Persistent Title');
    await expect(editorBody(page)).toContainText('Initial content');
    await expect(editorBody(page)).toContainText('More content');
  });

  test('cancels back to the read view without saving the title', async ({
    page,
  }) => {
    await titleInput(page).fill('Discarded Title');
    await page.locator('.editor-actions button:has-text("Cancel")').click();

    await expect(page.locator('lib-blog-compose')).toBeHidden();
    await expect(page.locator('dh-blog-viewer')).toBeVisible();
    await expect(page.locator('dh-blog-viewer')).not.toContainText(
      'Discarded Title'
    );
  });

  test('saves as a draft and stays flagged as a draft', async ({ page }) => {
    const title = `Draft Post ${Date.now()}`;
    await titleInput(page).fill(title);
    await editorBody(page).click();
    await page.keyboard.type('This is a draft post body.');

    await page
      .locator('.editor-actions button:has-text("Save as Draft")')
      .click();

    await expect(page.locator('.draft-banner')).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.locator('.post-list .post-item.draft', { hasText: title })
    ).toBeVisible();
  });

  test('publishes the draft and clears the draft banner', async ({ page }) => {
    const title = `Published Post ${Date.now()}`;
    await titleInput(page).fill(title);
    await editorBody(page).click();
    await page.keyboard.type('This post is going live.');

    await page.locator('.editor-actions button:has-text("Publish")').click();

    await expect(page.locator('.draft-banner')).toBeHidden({
      timeout: 20_000,
    });
    await expect(
      page.locator('.post-list .post-item', { hasText: title })
    ).toBeVisible();
  });
});

test.describe('Blog editor access control', () => {
  test('hides the editor entry points from anonymous visitors', async ({
    page,
  }) => {
    await page.goto('/blog', { waitUntil: 'domcontentloaded' });

    await expect(page.locator('.sidebar-header otui-button')).toHaveCount(0);
    await expect(page.locator('lib-blog-compose')).toHaveCount(0);
    await expect(
      page.locator('.welcome-message a[href*="login"]')
    ).toBeVisible();
  });

  test('tells a signed-in user without a role that access is read-only', async ({
    page,
  }) => {
    await denyBlogEditAccess(page);
    await signIn(page);

    await expect(page.locator('.welcome-message')).toContainText(
      'You have read-only access.'
    );
    await expect(page.locator('.sidebar-header otui-button')).toHaveCount(0);
  });
});
