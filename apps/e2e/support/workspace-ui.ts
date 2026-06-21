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
