import { expect, Locator, Page, Response } from '@playwright/test';

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
  await expect(page).toHaveURL(/\/settings/);

  const trigger = page.locator('[data-profile-editor-trigger]').first();
  await expect(trigger).toBeVisible();
  await trigger.click();

  // The shared modal component exposes its accessible dialog on the page;
  // some clients render it inside `otui-modal`, while others render the
  // accessible host directly.  Target the public dialog contract rather than
  // an implementation tag so this fixture stays cross-client compatible.
  const dialog = page
    .locator(
      'otui-modal:visible, [role="dialog"]:visible, [role="alertdialog"]:visible'
    )
    .filter({ has: page.getByRole('heading', { name: 'Edit Profile' }) })
    .first();
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
  const dialog = page
    .locator(
      'otui-modal:visible, [role="dialog"]:visible, [role="alertdialog"]:visible'
    )
    .filter({ has: page.getByRole('heading', { name: 'Edit Profile' }) })
    .first();
  await expect(dialog).toBeVisible();
  const submitButton = dialog.getByRole('button', { name: 'Submit' }).first();
  await expect(submitButton).toBeVisible();
  await submitButton.click();
}

function isApiResponse(response: Response, path: string): boolean {
  return response.url().includes(path);
}

async function responseDetails(response: Response): Promise<string> {
  let body = '<unavailable>';
  try {
    body = (await response.text()).slice(0, 1_000);
  } catch {
    // The response can be consumed by the app before diagnostics are captured.
  }
  return `${response
    .request()
    .method()} ${response.url()} -> ${response.status()} ${body}`;
}

async function expectSuccessfulResponse(
  response: Response,
  action: string
): Promise<void> {
  const details = await responseDetails(response);
  expect(response.ok(), `${action} failed; observed ${details}`).toBeTruthy();
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
  const registerPasswordInput = page.locator(
    'lib-text-input[formControlName="password"] input'
  );
  await registerPasswordInput.fill(options.password);
  await page
    .locator('lib-text-input[formControlName="confirmation"] input')
    .fill(options.password);

  const registerResponsePromise = page.waitForResponse((response) =>
    isApiResponse(response, '/authentication/register')
  );
  await page.getByRole('button', { name: /register/i }).click();
  const registerResponse = await registerResponsePromise;
  if (registerResponse.status() === 409) {
    // The test may be retried after the account was persisted but before the
    // original browser completed its redirect. Reuse that account safely.
    await page.goto('/login');
  } else {
    await expectSuccessfulResponse(registerResponse, 'registration');
    await expect(page).toHaveURL(/\/login/);
  }

  await page
    .locator('lib-text-input[formControlName="email"] input')
    .fill(options.email);
  const loginPasswordInput = page.locator(
    'lib-text-input[formControlName="password"] input'
  );
  await loginPasswordInput.fill(options.password);

  const loginResponsePromise = page.waitForResponse((response) =>
    isApiResponse(response, '/authentication/login')
  );
  // The login card animates into place, which can keep the submit button's
  // bounding box unstable even though the native form is ready. Submitting
  // from the focused password field follows the normal user/browser form path
  // without depending on a transient pointer target.
  await loginPasswordInput.press('Enter');
  await expectSuccessfulResponse(await loginResponsePromise, 'login');

  await page.waitForURL((url) => !url.pathname.endsWith('/login'), {
    timeout: 15000,
  });

  const dialog = await openProfileEditorFromSettings(page);

  const profileNameInput = dialog
    .locator('lib-text-input[formControlName="profileName"] input')
    .first();
  await expect(profileNameInput).toBeVisible();
  await profileNameInput.fill(options.profileName);

  const bioInput = dialog
    .locator('lib-text-area[formControlName="bio"] textarea')
    .first();
  await expect(bioInput).toBeVisible();
  await bioInput.fill(options.bio ?? '');

  const profileResponsePromise = page.waitForResponse(
    (response) =>
      isApiResponse(response, '/api/profile') &&
      ['POST', 'PUT'].includes(response.request().method())
  );
  await submitProfileEditor(page);
  await expectSuccessfulResponse(await profileResponsePromise, 'profile save');
  await expect(dialog).not.toBeVisible();
}
