import { expect, Locator, Page } from '@playwright/test';

const TEST_IMAGE_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9sXnVd0AAAAASUVORK5CYII=',
  'base64'
);

export async function openAppNavigation(page: Page): Promise<Locator> {
  const menuButton = page.locator('otui-app-bar otui-button').first();
  await expect(menuButton).toBeVisible();
  await menuButton.click();

  return expectVisibleSidebar(page);
}

export function visibleSidebar(page: Page): Locator {
  return page.locator('.nav-sidebar-card:visible').first();
}

export async function expectVisibleSidebar(page: Page): Promise<Locator> {
  const sidebar = visibleSidebar(page);
  await expect(sidebar).toBeVisible();
  return sidebar;
}

export async function sidebarNavButton(
  page: Page,
  label: string | RegExp
): Promise<Locator> {
  const sidebar = await openAppNavigation(page);
  const button = sidebar.getByRole('button', { name: label }).first();
  await expect(button).toBeVisible();
  return button;
}

export async function openProfileEditorFromSettings(
  page: Page
): Promise<Locator> {
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');

  const trigger = page.locator('[data-profile-editor-trigger]').first();
  await expect(trigger).toBeVisible();
  await trigger.click();

  const dialog = page.locator('.modal-dialog[aria-modal="true"]').first();
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function uploadTestImage(input: Locator): Promise<void> {
  await input.setInputFiles({
    name: 'test-image.png',
    mimeType: 'image/png',
    buffer: TEST_IMAGE_BUFFER,
  });
}

export async function submitProfileEditor(page: Page): Promise<void> {
  const submitButton = page
    .locator('otui-modal .dialog-actions otui-button[variant="success"]')
    .first();
  await expect(submitButton).toBeAttached();
  await submitButton.evaluate((element) => {
    (element as HTMLElement).click();
  });
}

export async function registerAndCreateProfile(
  page: Page,
  options: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    profileName: string;
    bio?: string;
  }
): Promise<void> {
  await page.goto('/register');
  await expect(page).toHaveURL(/\/register/);

  await page
    .locator('lib-text-input[formControlName="firstName"] input')
    .fill(options.firstName);
  await page
    .locator('lib-text-input[formControlName="lastName"] input')
    .fill(options.lastName);
  await page
    .locator('lib-text-input[formControlName="email"] input')
    .fill(options.email);
  await page
    .locator('lib-text-input[formControlName="password"] input')
    .fill(options.password);
  await page
    .locator('lib-text-input[formControlName="confirmation"] input')
    .fill(options.password);

  await page.click(
    'otui-button[type="submit"], otui-button:has-text("Register")',
    {
      force: true,
    }
  );

  await expect(page).toHaveURL(/\/login/, { timeout: 15000 });

  await page
    .locator('lib-text-input[formControlName="email"] input')
    .fill(options.email);
  await page
    .locator('lib-text-input[formControlName="password"] input')
    .fill(options.password);

  await page.click(
    'otui-button[type="submit"], otui-button:has-text("Login")',
    {
      force: true,
    }
  );

  await page.waitForURL((url) => !url.pathname.endsWith('/login'), {
    timeout: 15000,
  });

  if (!page.url().includes('/settings')) {
    await page.goto('/settings');
  }

  await page.waitForLoadState('networkidle');

  const profileNameInput = page
    .locator('lib-text-input[formControlName="profileName"] input')
    .first();
  await expect(profileNameInput).toBeVisible();
  await profileNameInput.fill(options.profileName);

  const bioInput = page
    .locator('lib-text-input[formControlName="bio"] input')
    .first();
  if (await bioInput.isVisible()) {
    await bioInput.fill(options.bio ?? '');
  }

  const submitButton = page.getByRole('button', { name: /submit/i }).first();
  await expect(submitButton).toBeVisible();
  await submitButton.click({ force: true });

  await page.waitForURL(/\/feed/, { timeout: 15000 }).catch(async () => {
    await page.waitForTimeout(1000);
  });
}
