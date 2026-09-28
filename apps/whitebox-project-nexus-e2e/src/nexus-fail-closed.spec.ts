import { test, expect } from '@playwright/test';

// Fail-closed contract for the Project Nexus SPA served WITHOUT a backend.
// Every route must render a truthful unavailable/empty state and must never
// display fabricated schedules, drawings, photos, or change orders.

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

test('portal renders without demo content and validates project ids', async ({
  page,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Project Nexus' })
  ).toBeVisible();
  const body = await page.textContent('body');
  expect(body).not.toContain('demo-project');

  await page.getByLabel('Open a project').fill('not-a-uuid');
  await expect(
    page
      .locator('.project-open-card')
      .getByRole('button', { name: 'Open schedule' })
  ).toBeDisabled();

  await page
    .getByLabel('Open a project')
    .fill('11111111-1111-4111-8111-111111111111');
  await page
    .locator('.project-open-card')
    .getByRole('button', { name: 'Open schedule' })
    .click();
  await expect(page).toHaveURL(
    '/projects/11111111-1111-4111-8111-111111111111/milestones'
  );
});

test('milestones show unavailable state, never fabricated rows', async ({
  page,
}) => {
  await page.goto(`/projects/${PROJECT_ID}/milestones`);
  await expect(
    page.getByText(
      'The schedule is unavailable. No milestone data is displayed.'
    )
  ).toBeVisible();
  await expect(page.locator('.gantt-row')).toHaveCount(0);
});

test('drawings show unavailable state, never fabricated rows', async ({
  page,
}) => {
  await page.goto(`/projects/${PROJECT_ID}/drawings`);
  await expect(
    page.getByText('The drawing manifest is unavailable. Nothing is displayed.')
  ).toBeVisible();
  await expect(page.locator('.manifest-table tbody tr')).toHaveCount(0);
});

test('photo locker starts empty without claiming sealed evidence', async ({
  page,
}) => {
  await page.goto(`/projects/${PROJECT_ID}/photos`);
  await expect(
    page.getByText('No inspection photos are sealed for this project yet.')
  ).toBeVisible();
  await expect(page.locator('.photo-card')).toHaveCount(0);
  await expect(page.locator('.photo-hash')).toHaveCount(0);
});

test('change orders show unavailable state with a usable signing form', async ({
  page,
}) => {
  await page.goto(`/projects/${PROJECT_ID}/change-orders`);
  await expect(
    page.getByText('Change orders are unavailable. Nothing is displayed.')
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Submit a change order' })
  ).toBeVisible();
  await expect(page.getByLabel('Owner signature pad')).toBeVisible();
  await expect(page.getByLabel('Contractor signature pad')).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Submit for approval' })
  ).toBeDisabled();
});
