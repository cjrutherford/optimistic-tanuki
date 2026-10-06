import { expect, test } from '@playwright/test';
import { getBaseUrl } from './fixtures/helpers';
import {
  apiUrl,
  createAuthenticatedSession,
  localHubAuthHeaders,
} from './helpers/local-hub-api';

/**
 * Daylight in Towne Square (plan slice P4.5): a town page shows its
 * briefing, a reader moves between editions, and a resident signs up as a
 * contributor and reports something. The stack seeds Adel's page and two of
 * its briefings (24 and 25 September 2026), and review answers from a
 * deterministic stub (D28).
 */

test.describe('Daylight briefings', () => {
  test('server-renders a briefing page, so the text is there without JavaScript', async ({
    request,
  }) => {
    const response = await request.get(`${getBaseUrl()}/city/adel-ga/briefing`);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain('No new public business in Adel');
    expect(html).toContain('Friday, September 25, 2026');
    // The pipeline's own title is dropped; the page names the town instead.
    expect(html).not.toContain('Adel, GA — daily briefing');
  });

  test('shows the latest briefing on the town page and moves between editions', async ({
    page,
  }) => {
    await page.goto('/city/adel-ga');
    const section = page.locator('.city-briefing-section');
    await expect(
      section.getByRole('heading', { name: 'Daylight' })
    ).toBeVisible();
    await expect(section.locator('time')).toHaveText(
      'Friday, September 25, 2026'
    );
    await expect(
      section.getByRole('heading', { name: 'No new public business in Adel' })
    ).toBeVisible();

    await section
      .getByRole('link', { name: 'Resident reports and past editions' })
      .click();
    await expect(page).toHaveURL('/city/adel-ga/briefing');
    await expect(
      page.getByRole('heading', { name: 'Adel', exact: true })
    ).toBeVisible();

    await page
      .getByRole('navigation', { name: 'Editions from the last four weeks' })
      .getByRole('link', { name: 'Thursday, September 24, 2026' })
      .click();
    await expect(page).toHaveURL('/city/adel-ga/briefing/2026-09-24');
    await expect(page.locator('app-city-briefing time')).toHaveText(
      'Thursday, September 24, 2026'
    );
  });

  test('says plainly when a day has no briefing', async ({ page }) => {
    await page.goto('/city/adel-ga/briefing/2026-09-01');
    await expect(
      page.getByText(
        'There is no Adel briefing for Tuesday, September 1, 2026.'
      )
    ).toBeVisible();
  });
});

test.describe('Becoming a Daylight contributor', () => {
  test('signs up from the report page, reports, and sees the review', async ({
    browser,
  }) => {
    const context = await browser.newContext({ baseURL: getBaseUrl() });
    try {
      const session = await createAuthenticatedSession(context.request, {
        withBrowserCookie: true,
      });
      const page = await context.newPage();

      // A new account reads, but has to sign up before it can report (D27).
      await page.goto('/city/adel-ga/report');
      await page.getByRole('link', { name: 'become a contributor' }).click();
      await expect(page).toHaveURL(/\/contribute\?returnUrl=/);
      await expect(
        page.getByRole('heading', { name: 'What you are agreeing to' })
      ).toBeVisible();
      const join = page.getByRole('button', { name: 'Become a contributor' });
      await expect(join).toBeDisabled();
      // Reports are signed with the local-hub display name, which starts as
      // the registered name; the contributor picks a handle instead (P5.1).
      const handleField = page.getByLabel('Your handle');
      await expect(handleField).toHaveValue('Test User');
      const handle = `watcher${Date.now().toString(36)}`;
      await handleField.fill(handle);
      await page
        .getByLabel('I have read these and want to contribute to Daylight.')
        .check();
      await join.click();
      await expect(
        page.getByText("You're a Daylight contributor.")
      ).toBeVisible();
      await expect(
        page.getByText(`Your reports are published as ${handle}.`)
      ).toBeVisible();

      await page.getByRole('link', { name: 'Carry on where you were' }).click();
      await expect(page).toHaveURL('/city/adel-ga/report');
      await expect(
        page.getByRole('heading', { name: 'Report from Adel' })
      ).toBeVisible();

      const subject = `Love Avenue repaving ${Date.now()}`;
      await page.getByLabel('In a few words').fill(subject);
      await page.getByLabel('When did it happen?').fill('2026-09-22');
      await page
        .locator('lib-text-area textarea')
        .fill(
          'The city council voted four to one to repave Love Avenue this autumn.'
        );
      await page.getByLabel('I saw or heard this myself.').check();
      await page
        .getByLabel(
          'The words are mine, apart from any quotation I have credited.'
        )
        .check();
      await page.getByRole('button', { name: 'Send report' }).click();

      // Review passes it. The copying check fails closed here, since the e2e
      // stack loads no news corpus to compare against, so the report waits
      // for evidence and says exactly why.
      const trail = page.locator('civic-review-trail');
      await expect(trail).toContainText('Waiting for evidence.', {
        timeout: 60_000,
      });
      await expect(trail).toContainText(
        'Nothing in it needs to wait. It is recorded and can be corroborated.'
      );
      await expect(trail).toContainText(
        'no published articles are loaded to compare against'
      );

      // The account's own list has it, with the same outcome.
      const mine = await context.request.get(
        apiUrl('/api/local-hub/contributions/mine'),
        { headers: localHubAuthHeaders(session.token) }
      );
      expect(mine.ok()).toBeTruthy();
      const reports = (await mine.json()).data as {
        subject: { text: string };
        state: string;
      }[];
      expect(
        reports.find((report) => report.subject.text === subject)?.state
      ).toBe('held');
    } finally {
      await context.close();
    }
  });
});
