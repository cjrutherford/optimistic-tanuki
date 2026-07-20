import { expect, test } from '@playwright/test';

const OWNER_EMAIL = 'owner-accountant@localbusiness.test';
const OWNER_PASSWORD = 'BusinessOwnerPass123!';

test('owner manages a multi-target campaign through its lifecycle', async ({
  page,
}) => {
  const campaignName = `Slice 16.1 evaluation ${Date.now()}`;

  await page.goto('/auth');
  await page.getByLabel('Email').fill(OWNER_EMAIL);
  await page.getByLabel('Password').fill(OWNER_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/owner\/dashboard$/);

  await page.getByRole('link', { name: 'Campaigns' }).click();
  await expect(page).toHaveURL(/\/owner\/campaigns$/);
  await expect(
    page.getByRole('heading', { name: 'Campaign control room' })
  ).toBeVisible();
  await page.getByLabel('Name').fill(campaignName);

  const targets = page.locator('.target');
  await expect(targets.first()).toBeVisible();
  await targets.first().locator('input[type="checkbox"]').first().check();
  const communityTarget = targets.filter({ hasText: 'community' }).first();
  await expect(communityTarget).toBeVisible();
  await communityTarget.locator('input[type="checkbox"]').first().check();

  const channelTarget = targets.first();
  await channelTarget
    .getByText('pre-roll', { exact: true })
    .locator('input')
    .check();
  await expect(
    communityTarget.getByText('mid-roll', { exact: true })
  ).toHaveCount(0);

  await page
    .locator('[data-placement="on-page"]')
    .getByLabel('Headline')
    .fill('Local campaign evaluation');
  await page
    .locator('[data-placement="pre-roll"]')
    .getByLabel('Headline')
    .fill('MetroCast roll evaluation');
  await page.getByRole('button', { name: 'Create draft campaign' }).click();

  const campaign = page.locator('.campaign').filter({ hasText: campaignName });
  await expect(campaign).toContainText('draft');
  await campaign.getByRole('button', { name: 'Edit' }).click();
  await page.getByLabel('Name').fill(`${campaignName} edited`);
  await page.getByRole('button', { name: 'Save campaign draft' }).click();

  const editedCampaign = page
    .locator('.campaign')
    .filter({ hasText: `${campaignName} edited` });
  await editedCampaign.getByRole('button', { name: 'Activate' }).click();
  await expect(editedCampaign).toContainText('active');
  await editedCampaign.getByRole('button', { name: 'Pause' }).click();
  await expect(editedCampaign).toContainText('paused');
  await editedCampaign.getByRole('button', { name: 'Archive' }).click();
  await expect(editedCampaign).toContainText('archived');
  await expect(
    editedCampaign.getByRole('button', { name: 'Activate' })
  ).toHaveCount(0);
});
