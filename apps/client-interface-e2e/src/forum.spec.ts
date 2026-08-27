import { expect, test } from '@playwright/test';
import { registerAndCreateProfile } from '../../e2e/support/workspace-ui';

test.describe('Forum access', () => {
  test('allows an anonymous visitor to read seeded topics', async ({
    page,
  }) => {
    const topicsResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/forum/topics') &&
        response.request().method() === 'GET'
    );

    await page.goto('/forum');
    const topicsResponse = await topicsResponsePromise;
    const topics = (await topicsResponse.json()) as Array<{
      title: string;
      appScope: string;
    }>;

    await expect(page).toHaveURL(/\/forum/);
    await expect(page.getByText('Community Introductions')).toBeVisible();
    expect(topicsResponse.status()).toBe(200);
    expect(topics.map((topic) => topic.title)).toEqual(
      expect.arrayContaining([
        'Community Introductions',
        'Local Ideas and Coordination',
      ])
    );
    expect(topics.every((topic) => topic.appScope === 'client-interface')).toBe(
      true
    );
    await expect(
      page.getByRole('button', { name: 'Create New Topic' })
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Create New Thread' })
    ).toHaveCount(0);
  });

  test('opens a seeded topic and loads its scoped thread list', async ({
    page,
  }) => {
    await page.goto('/forum');
    const topicCard = page.getByText('Community Introductions', {
      exact: true,
    });
    await expect(topicCard).toBeVisible();

    const threadsResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/forum/topic/') &&
        response.url().endsWith('/threads') &&
        response.request().method() === 'GET'
    );
    await topicCard.click();
    const threadsResponse = await threadsResponsePromise;

    expect(threadsResponse.status()).toBe(200);
    await expect(page).toHaveURL(/\/forum\/topic\/[0-9a-f-]+$/);
    await expect(page.getByText('No threads in this topic yet.')).toBeVisible();
  });

  test('renders the forum shell for an authenticated profile', async ({
    page,
  }) => {
    const timestamp = Date.now();
    await registerAndCreateProfile(page, {
      firstName: 'Forum',
      lastName: 'Member',
      email: `forum-member-${timestamp}@example.test`,
      password: 'Password123!',
      profileName: `Forum Member ${timestamp}`,
      bio: 'Forum test profile',
    });

    const topicsResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/api/forum/topics') &&
        response.request().method() === 'GET'
    );
    await page.goto('/forum');
    const topicsResponse = await topicsResponsePromise;
    const topics = (await topicsResponse.json()) as Array<{
      title: string;
      appScope: string;
    }>;
    const headers = topicsResponse.request().headers();
    expect(
      topicsResponse.ok(),
      `forum topics request failed: ${topicsResponse.status()} ${topicsResponse.url()}`
    ).toBeTruthy();
    expect(headers['x-ot-appscope']).toBe('client-interface');
    expect(
      topics.every((topic) => topic.appScope === 'client-interface')
    ).toBeTruthy();
    expect(topics.map((topic) => topic.title)).not.toContain(
      'Project Execution'
    );
    await expect(page).toHaveURL(/\/forum/);
    await expect(page.locator('.forum-shell')).toBeVisible();
    await expect(page.getByText('Forum Topics')).toBeVisible();
  });
});
