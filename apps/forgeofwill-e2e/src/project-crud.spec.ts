import { expect, test } from '@playwright/test';

test.describe('Forge project CRUD', () => {
  test('an authenticated planner creates, reads, updates, and deletes a project', async ({
    page,
    context,
  }) => {
    const suffix = `${Date.now()}-${test.info().parallelIndex}`;
    const email = `forge-project-${suffix}@example.test`;
    const password = 'Password123!';
    const projectName = `Launch plan ${suffix}`;
    const updatedProjectName = `Launch plan revised ${suffix}`;
    const description = 'A project created by the authenticated Forge planner.';
    const updatedDescription =
      'The planner updated this project through Forge.';

    await page.goto('/register');
    await page
      .locator('lib-text-input[formControlName="firstName"] input')
      .fill('Forge');
    await page
      .locator('lib-text-input[formControlName="lastName"] input')
      .fill('Planner');
    await page
      .locator('lib-text-input[formControlName="email"] input')
      .fill(email);
    await page
      .locator('lib-text-input[formControlName="password"] input')
      .fill(password);
    await page
      .locator('lib-text-input[formControlName="confirmation"] input')
      .fill(password);
    await page.getByRole('button', { name: /adventure/i }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page
      .locator('lib-text-input[formControlName="email"] input')
      .fill(email);
    await page
      .locator('lib-text-input[formControlName="password"] input')
      .fill(password);
    await page.getByRole('button', { name: /login/i }).click();
    await page.waitForURL((url) => !url.pathname.endsWith('/login'));

    const forgeOrigin = new URL(page.url()).origin;
    const sessionCookie = (await context.cookies(forgeOrigin)).find(
      (cookie) => cookie.name === 'ot_session'
    );
    expect(sessionCookie).toEqual(
      expect.objectContaining({
        domain: new URL(forgeOrigin).hostname,
        httpOnly: true,
        path: '/',
      })
    );

    await page.goto('/projects?tab=active');
    await expect(page).toHaveURL(/\/projects\?tab=active$/);
    await expect(page.getByRole('main')).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/projects\?tab=active$/);
    await expect(page.getByRole('main')).toBeVisible();
    const createProject = page
      .getByRole('button', { name: /^(Create|Create New Project)$/ })
      .first();
    await expect(createProject).toBeVisible();
    const noProjectRegion = page.locator('.no-project-content');
    if (await noProjectRegion.isVisible()) {
      await expect(
        noProjectRegion.getByRole('heading', { name: 'No Project Selected' })
      ).toBeVisible();
      await expect(
        noProjectRegion.getByText(
          'Please select or create a project to view details.',
          { exact: true }
        )
      ).toBeVisible();
    }
    await createProject.click();
    await page
      .locator('lib-text-input[formControlName="projectName"] input')
      .fill(projectName);
    await page
      .locator('lib-text-area[formControlName="projectDescription"] textarea')
      .fill(description);
    await page.getByRole('button', { name: 'Submit' }).click();

    await expect(
      page.getByRole('heading', { name: `Project Overview: ${projectName}` })
    ).toBeVisible();
    await expect(page.locator('body')).toContainText(projectName);

    await page.getByRole('button', { name: 'Edit' }).click();
    await page
      .locator('lib-text-input[formControlName="projectName"] input')
      .fill(updatedProjectName);
    await page
      .locator('lib-text-area[formControlName="projectDescription"] textarea')
      .fill(updatedDescription);
    await page.getByRole('button', { name: 'Submit' }).click();

    await expect(
      page.getByRole('heading', {
        name: `Project Overview: ${updatedProjectName}`,
      })
    ).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole('heading', {
        name: `Project Overview: ${updatedProjectName}`,
      })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Edit' }).click();
    const editDialog = page.getByRole('alertdialog', {
      name: 'Edit Project',
    });
    await expect(editDialog).toBeVisible();
    await expect(
      editDialog.locator(
        'lib-text-area[formControlName="projectDescription"] textarea'
      )
    ).toHaveValue(updatedDescription);
    await page.keyboard.press('Escape');
    await expect(editDialog).toBeHidden();

    await page.getByRole('button', { name: 'Delete' }).click();
    const dialog = page.getByRole('alertdialog', { name: 'Delete Project?' });
    await expect(dialog).toContainText(updatedProjectName);
    await dialog.getByRole('button', { name: 'Delete Project' }).click();

    await expect(page.locator('body')).not.toContainText(updatedProjectName);

    await page.reload();

    await expect(page.getByRole('main')).toBeVisible();
    await expect(page.locator('body')).not.toContainText(updatedProjectName);

    await context.addCookies([
      {
        name: 'ot_session',
        value: 'forged-session-token',
        url: forgeOrigin,
        httpOnly: true,
      },
    ]);
    await page.goto('/projects?tab=active');
    await expect(page).toHaveURL(
      /\/login\?returnUrl=%2Fprojects%3Ftab%3Dactive$/
    );
  });
});
